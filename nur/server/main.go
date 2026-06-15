package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	fmt.Println("NurCRM запускается...")

	if info, hasUpdate := checkUpdate(); hasUpdate {
		fmt.Printf("Доступна версия %s. Обновляем...\n", info.Version)
		err := downloadAndUpdate(info)
		if err != nil {
			fmt.Printf("Ошибка обновления: %v\n", err)
			fmt.Println("Запускаем текущую версию...")
		}
	}

	go startServer()

	openBrowser("http://localhost:3000")

	fmt.Println("NurCRM работает на http://localhost:3000")
	fmt.Println("Не закрывайте это окно")

	select {}
}

// getAppDir — корень приложения (рядом лежат build/, version.txt, NurCRM.exe).
// При go run . exe оказывается в кэше Go — ищем build/ относительно cwd и родителя.
func getAppDir() string {
	if dir := findDirContainingBuild(candidateDirs()...); dir != "" {
		return dir
	}

	if exePath, err := os.Executable(); err == nil {
		return filepath.Dir(exePath)
	}
	if cwd, err := os.Getwd(); err == nil {
		return cwd
	}
	return "."
}

func getExeDir() string {
	return getAppDir()
}

func candidateDirs() []string {
	var dirs []string

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		dirs = append(dirs, exeDir, filepath.Dir(exeDir))
	}

	if cwd, err := os.Getwd(); err == nil {
		dirs = append(dirs, cwd, filepath.Dir(cwd))
	}

	return dirs
}

func findDirContainingBuild(dirs ...string) string {
	seen := make(map[string]struct{}, len(dirs))

	for _, dir := range dirs {
		dir = filepath.Clean(dir)
		if dir == "" || dir == "." {
			continue
		}
		if _, ok := seen[dir]; ok {
			continue
		}
		seen[dir] = struct{}{}

		buildDir := filepath.Join(dir, "build")
		if info, err := os.Stat(buildDir); err == nil && info.IsDir() {
			return dir
		}
	}

	return ""
}
