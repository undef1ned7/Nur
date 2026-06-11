#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Использование: ./build-client.sh 1.0.5"
  exit 1
fi

echo "=============================="
echo " NurCRM Release Builder v$VERSION"
echo "=============================="

echo "$VERSION" > version.txt
echo "✅ version.txt → $VERSION"

echo "🔨 Сборка фронта..."
npm run build
echo "✅ build/ готов"

echo "🔨 Сборка NurCRM.exe..."
cd server
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o ../NurCRM.exe .
cd ..
echo "✅ NurCRM.exe готов"

ZIP_NAME="NurCRM-$VERSION.zip"
echo "📦 Упаковка в $ZIP_NAME..."
zip -r "$ZIP_NAME" NurCRM.exe version.txt build/
echo "✅ $ZIP_NAME готов"

echo "🚀 Загружаем на сервер..."
scp "$ZIP_NAME" user@app.nurcrm.kg:/var/www/downloads/
echo "✅ Загружено"

echo ""
echo "=============================="
echo "✅ Релиз $VERSION готов!"
echo ""
echo "Последний шаг: обновить версию"
echo "на бэке в /api/version/"
echo "=============================="
