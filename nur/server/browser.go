package main

import (
	"os/exec"
	"runtime"
	"time"
)

func openBrowser(url string) {
	time.Sleep(1 * time.Second)

	switch runtime.GOOS {
	case "windows":
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		exec.Command("open", url).Start()
	default:
		exec.Command("xdg-open", url).Start()
	}
}
