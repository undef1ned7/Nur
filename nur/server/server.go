package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
)

func startServer() {
	port := "3000"
	buildDir := filepath.Join(getAppDir(), "build")

	if _, err := os.Stat(buildDir); os.IsNotExist(err) {
		fmt.Printf("ОШИБКА: папка build/ не найдена по пути %s\n", buildDir)
		fmt.Println("Убедитесь что build/ лежит рядом с NurCRM.exe (или запускайте go run из папки server/)")
		return
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		filePath := filepath.Join(buildDir, filepath.Clean(r.URL.Path))

		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		}

		http.ServeFile(w, r, filepath.Join(buildDir, "index.html"))
	})

	fmt.Printf("Сервер запущен на порту %s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Printf("Ошибка сервера: %v\n", err)
	}
}
