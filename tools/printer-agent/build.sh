#!/bin/sh
# Сборка исполняемого файла агента печати.
# Windows: в папке dist появится printer-agent.exe
# macOS: в dist — .app бандл
# Требуется: pip install flet

cd "$(dirname "$0")"

if ! command -v flet >/dev/null 2>&1; then
    echo "Установите Flet: pip install flet"
    exit 1
fi

flet pack main.py -n printer-agent -y
if [ $? -ne 0 ]; then
    echo "Ошибка сборки."
    exit 1
fi

echo ""
echo "Готово. Результат в папке dist/"
ls -la dist/ 2>/dev/null || true
