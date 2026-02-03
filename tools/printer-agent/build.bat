@echo off
REM Сборка exe для агента печати (Windows).
REM Требуется: pip install flet
REM Результат: dist\printer-agent.exe

cd /d "%~dp0"

where flet >nul 2>nul
if errorlevel 1 (
    echo Установите Flet: pip install flet
    exit /b 1
)

flet pack main.py -n printer-agent -y
if errorlevel 1 (
    echo Ошибка сборки.
    exit /b 1
)

echo.
echo Готово: dist\printer-agent.exe
dir /b dist\*.exe 2>nul
