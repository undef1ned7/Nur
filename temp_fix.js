const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/Components/Sectors/Consulting/client-requests/client-requests.scss');
let content = fs.readFileSync(filePath, 'utf8');

// Заменить все color-mix с var(--border)
content = content.replace(/color-mix\(in srgb, var\(--border\) (\d+)%, (#[a-f0-9]+) (\d+)%\)/g, 'mix(#e5e7eb, $2, $1%)');

// Заменить все color-mix с двумя цветами
content = content.replace(/color-mix\(in srgb, (#[a-f0-9]+) (\d+)%, (#[a-f0-9]+) (\d+)%\)/g, 'mix($1, $3, $2%)');

// Заменить все var(--border) на #e5e7eb
content = content.replace(/var\(--border\)/g, '#e5e7eb');

// Сохранить
fs.writeFileSync(filePath, content);
console.log('Файл исправлен');
