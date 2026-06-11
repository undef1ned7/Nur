package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	versionFile = "version.txt"
	versionURL  = "https://app.nurcrm.kg/api/version/"
)

type VersionInfo struct {
	Version      string `json:"version"`
	ZipURL       string `json:"zip_url"`
	ReleaseNotes string `json:"release_notes"`
}

func getCurrentVersion() string {
	data, err := os.ReadFile(filepath.Join(getExeDir(), versionFile))
	if err != nil {
		return "0.0.0"
	}
	return strings.TrimSpace(string(data))
}

func checkUpdate() (*VersionInfo, bool) {
	client := &http.Client{Timeout: 5 * time.Second}

	resp, err := client.Get(versionURL)
	if err != nil {
		fmt.Println("Нет подключения, пропускаем проверку обновлений")
		return nil, false
	}
	defer resp.Body.Close()

	var info VersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, false
	}

	current := getCurrentVersion()
	fmt.Printf("Текущая версия: %s, Серверная версия: %s\n", current, info.Version)

	if info.Version == current || info.Version == "" {
		return nil, false
	}

	return &info, true
}

func downloadAndUpdate(info *VersionInfo) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("не удалось определить путь к exe: %w", err)
	}
	dir := filepath.Dir(exePath)
	zipPath := filepath.Join(dir, "update.zip")
	stagingDir := filepath.Join(dir, "update_staging")

	fmt.Printf("Скачиваем %s...\n", info.ZipURL)
	if err := downloadFile(zipPath, info.ZipURL); err != nil {
		return fmt.Errorf("ошибка скачивания: %w", err)
	}
	defer os.Remove(zipPath)

	fmt.Println("Устанавливаем обновление...")
	os.RemoveAll(stagingDir)
	if err := unzipTo(zipPath, stagingDir); err != nil {
		return fmt.Errorf("ошибка распаковки: %w", err)
	}
	defer os.RemoveAll(stagingDir)

	if err := applyStagingUpdate(stagingDir, dir, exePath); err != nil {
		return err
	}

	fmt.Println("Перезапускаем NurCRM...")
	if runtime.GOOS == "windows" {
		return restartWindows(dir, exePath)
	}

	cmd := exec.Command(exePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("ошибка перезапуска: %w", err)
	}

	os.Exit(0)
	return nil
}

func applyStagingUpdate(stagingDir, destDir, exePath string) error {
	stagingExe := filepath.Join(stagingDir, "NurCRM.exe")
	newExePath := filepath.Join(destDir, "NurCRM_new.exe")

	if info, err := os.Stat(stagingExe); err == nil && !info.IsDir() {
		os.Remove(newExePath)
		if err := copyFile(stagingExe, newExePath); err != nil {
			return fmt.Errorf("не удалось подготовить новый exe: %w", err)
		}
	}

	return copyDirContents(stagingDir, destDir, map[string]bool{
		"NurCRM.exe": true,
	})
}

func copyDirContents(srcDir, destDir string, skip map[string]bool) error {
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}

		base := filepath.Base(rel)
		if skip != nil && skip[base] && info.IsDir() == false {
			return nil
		}

		target := filepath.Join(destDir, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		return copyFile(path, target)
	})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}

	return out.Close()
}

func restartWindows(dir, exePath string) error {
	newExePath := filepath.Join(dir, "NurCRM_new.exe")
	if _, err := os.Stat(newExePath); os.IsNotExist(err) {
		cmd := exec.Command(exePath)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("ошибка перезапуска: %w", err)
		}
		os.Exit(0)
		return nil
	}

	updateScript := filepath.Join(dir, "update.bat")
	batContent := fmt.Sprintf(`@echo off
timeout /t 2 /nobreak > nul
move /y "%s" "%s"
start "" "%s"
del "%%~f0"
`, newExePath, exePath, exePath)

	if err := os.WriteFile(updateScript, []byte(batContent), 0755); err != nil {
		return fmt.Errorf("не удалось создать update.bat: %w", err)
	}

	if err := exec.Command("cmd", "/c", updateScript).Start(); err != nil {
		return fmt.Errorf("не удалось запустить update.bat: %w", err)
	}

	os.Exit(0)
	return nil
}

func downloadFile(destPath, url string) error {
	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, resp.Body)
	return err
}

func unzipTo(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	cleanDestDir := filepath.Clean(destDir)

	for _, f := range r.File {
		destPath := filepath.Join(destDir, f.Name)

		if !strings.HasPrefix(filepath.Clean(destPath)+string(os.PathSeparator), cleanDestDir+string(os.PathSeparator)) {
			continue
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, 0755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}

		outFile, err := os.Create(destPath)
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
		if err != nil {
			return err
		}
	}

	return nil
}
