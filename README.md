# NUR CRM Frontend

Многопрофильная CRM-система для управления бизнесом в различных отраслях.

## 📖 Документация

**Полная документация проекта доступна в файле [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**

## 🚀 Быстрый старт

### Требования

- Node.js >= 14.x
- npm >= 6.x или yarn >= 1.x

### Установка

```bash
# Клонируйте репозиторий
git clone <repository-url>

# Перейдите в директорию проекта
cd frontend-actual

# Установите зависимости
npm install
# или
yarn install
```

### Настройка окружения

Создайте файл `.env` в корне проекта:

```env
REACT_APP_API_BASE_URL=https://app.nurcrm.kg/api
```

### Запуск в режиме разработки

```bash
npm start
# или
yarn start
```

Приложение откроется по адресу [http://localhost:3000](http://localhost:3000)

## 📦 Доступные команды

### `npm start`

Запускает приложение в режиме разработки.  
Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### `npm test`

Запускает тестовый раннер в интерактивном режиме.

### `npm run build`

Создает production сборку в папке `build/`.  
Приложение оптимизировано для production и готово к деплою.

### `npm run eject`

**⚠️ Внимание: это необратимая операция!**

Извлекает конфигурацию Create React App в проект для полного контроля.

## ☕ Cafe: Wi‑Fi принтеры (XPrinter XP‑N160II / RAW 9100)

Сетевые чековые принтеры на порту **9100** принимают **RAW TCP** (JetDirect) — только байты ESC/POS, без HTTP. Браузер **не умеет** открывать сырой TCP (только HTTP, WebSocket, WebUSB). Поэтому прямой `fetch(http://IP:9100)` отправляет HTTP-запрос — принтер печатает всё подряд, включая заголовки (`POST / HTTP/1.1`, `Host: ...` и т.д.).

**Зачем нужен printer-bridge:** это маленький сервер, который принимает от браузера данные по HTTP и отправляет их на принтер **по сырому TCP**. Цепочка: браузер → HTTP → bridge → RAW TCP → принтер.

**Можно ли без printer-bridge?**

- **Печать по USB** — да, bridge не нужен. В приложении уже используется WebUSB: принтер подключается к тому же ПК, что и браузер.
- **Печать по Wi‑Fi** — из браузера без «посредника» нельзя. Кто-то должен открыть TCP-сокет и отправить байты. Варианты:
  1. **printer-bridge** (Node-скрипт в этом репо) — отдельный процесс, один файл, без зависимостей.
  2. **Ваш бэкенд** — добавить endpoint, который принимает `{ ip, port, data }` (data — base64 ESC/POS) и шлёт их в принтер по TCP (как в `tools/printer-bridge.mjs`, логика `sendRawToPrinter`). В настройках печати указать URL этого endpoint вместо bridge. **Спека для бэкенд-разработчика:** [docs/PRINT_BACKEND_API.md](docs/PRINT_BACKEND_API.md).

В проекте есть **printer-bridge** на Node (`tools/printer-bridge.mjs`) и **агент печати** на Python/Flet в каталоге **`tools/printer-agent`** — оба решают одну задачу (HTTP → сырой TCP на принтер). Можно использовать любой из них или свой сервер с тем же API.

### Запуск printer‑bridge

В отдельном терминале:

```bash
npm run printer-bridge
```

По умолчанию он слушает `http://127.0.0.1:5179/print`.

### Агент печати (Flet) — `tools/printer-agent`

Это **отдельная папка** в репозитории: не корень `tools`, а именно `tools/printer-agent`. Десктопное приложение с окном и логом; тот же протокол, что у bridge (POST `/print`, порт по умолчанию 5179). Запуск:

```bash
cd tools/printer-agent
pip install -r requirements.txt
python main.py
```

Детали и сборка exe: [tools/printer-agent/README.md](tools/printer-agent/README.md).

### Настройка (опционально)

- Поменять URL bridge:

```js
localStorage.setItem("cafe_printer_bridge_url", "http://127.0.0.1:5179/print");
```

### Запуск printer-bridge на сервере

Bridge использует только встроенные модули Node (`http`, `net`), отдельные npm-зависимости не нужны.

1. **Установите Node.js** (18+).

2. **Скопируйте на сервер один файл** `tools/printer-bridge.mjs` (или клонируйте репозиторий и запускайте из корня).

3. **Слушать на всех интерфейсах** (чтобы браузер с другого ПК мог слать печать):

```bash
PRINTER_BRIDGE_HOST=0.0.0.0 PRINTER_BRIDGE_PORT=5179 node tools/printer-bridge.mjs
```

Или из корня проекта:

```bash
PRINTER_BRIDGE_HOST=0.0.0.0 npm run printer-bridge
```

4. **Запуск как сервис** (чтобы bridge не падал при отключении терминала):

   - **pm2:**
     ```bash
     npm install -g pm2
     cd /path/to/nurVite
     PRINTER_BRIDGE_HOST=0.0.0.0 pm2 start "node tools/printer-bridge.mjs" --name printer-bridge
     pm2 save && pm2 startup
     ```
   - **systemd:** создайте `/etc/systemd/system/printer-bridge.service`:
     ```ini
     [Unit]
     Description=Printer Bridge (RAW TCP to Wi-Fi printers)
     After=network.target

     [Service]
     Type=simple
     WorkingDirectory=/path/to/nurVite
     Environment=PRINTER_BRIDGE_HOST=0.0.0.0
     Environment=PRINTER_BRIDGE_PORT=5179
     ExecStart=/usr/bin/node tools/printer-bridge.mjs
     Restart=on-failure

     [Install]
     WantedBy=multi-user.target
     ```
     Затем: `sudo systemctl daemon-reload && sudo systemctl enable printer-bridge && sudo systemctl start printer-bridge`

5. **Важно:** машина, где запущен printer-bridge, должна быть в одной сети с принтером (или иметь маршрут до `192.168.x.x`). Если приложение на облачном сервере (nurcrm.kg), а принтер в офисе — запускайте bridge **в офисе** (ПК/сервер в той же LAN, что и принтер), а в настройках печати в приложении укажите URL этого ПК (например `http://IP_ОФИСНОГО_ПК:5179/print`). Или пробросьте порт через SSH/VPN.

### Печать на проде: как должно работать и что сделать

**Как устроено:**

1. **Фронт** (nurcrm.kg) открыт у кассира в браузере. При печати чека или заказа на кухню браузер отправляет задание **по HTTP** на URL, указанный в настройках («Printer-bridge URL»).
2. **Printer-bridge** — это процесс, который слушает этот URL, принимает JSON `{ ip, port, data }`, декодирует `data` из base64 и **по сырому TCP** отправляет байты на принтер `ip:port`. Без bridge браузер не может слать сырой TCP на принтер — только HTTP; если слать HTTP прямо на принтер, на чеке печатаются заголовки.
3. **Принтер** (Wi‑Fi, порт 9100) получает только байты ESC/POS и печатает чек.

**Где что крутится:**

| Что | Где | Зачем |
|-----|-----|--------|
| Сайт (фронт) | VPS / хостинг (nurcrm.kg) | Кассир открывает в браузере |
| Бэкенд API | VPS | Данные, заказы, настройки — не печать |
| Printer-bridge | **В офисе/кафе** (ПК или мини-сервер в той же сети, что и принтер) | Доступен до принтера по `192.168.x.x`; браузер слает сюда, bridge шлёт на принтер |
| Принтер | Офис/кафе, Wi‑Fi (192.168.x.x:9100) или USB к тому же ПК | Печатает чек |

**Почему bridge в офисе:** VPS в облаке не видит сеть офиса (192.168.x.x). До принтера может достучаться только машина в той же LAN — поэтому bridge запускают там.

**Что сделать, чтобы на проде всё работало:**

1. **Задеплоить фронт** на прод (nurcrm.kg) как обычно. Никаких изменений на VPS для печати не нужно.
2. **В офисе/кафе** (где стоят принтеры):
   - Поставить Node.js (18+) на любой ПК или мини-сервер в той же сети, что и принтеры.
   - Скопировать туда файл `tools/printer-bridge.mjs` (или весь репо) и запустить:
     ```bash
     PRINTER_BRIDGE_HOST=0.0.0.0 node tools/printer-bridge.mjs
     ```
   - Чтобы bridge не падал при перезагрузке — запустить как сервис (pm2 или systemd, см. выше).
   - Узнать IP этого ПК в локальной сети (например `192.168.1.10`).
3. **В приложении** (Настройки → Печать):
   - В поле «Printer-bridge URL» указать URL bridge: `http://192.168.1.10:5179/print` (подставить свой IP).
   - Настроить принтер кассы (IP:порт принтера, например `192.168.1.200:9100`).
   - Настроить принтеры кухонь (для каждой кухни — свой принтер или тот же).
4. **Печать по USB:** если принтер подключён по USB к тому же ПК, где открыт браузер, bridge для него не нужен — работает WebUSB. URL bridge нужен только для **сетевых (Wi‑Fi)** принтеров.

**Несколько точек (несколько офисов/кафе):** в каждой точке — свой ПК с printer-bridge и свой IP. В настройках печати на каждом рабочем месте указывается URL bridge **своей** точки (тот ПК, который в той же сети, что и принтеры этой точки). Один общий URL на все точки не подойдёт, если принтеры в разных сетях.

**Итог:** на проде фронт на VPS, bridge — в офисе на ПК с доступом к принтеру, в настройках приложения прописан URL этого bridge. После этого чеки и заказы на кухню печатаются без заголовков на бумаге.

## 🎯 Основные возможности

- ✅ Управление несколькими секторами бизнеса (кафе, маркет, барбершоп, школа, гостиница и др.)
- ✅ Многопользовательская система с ролевым доступом
- ✅ Управление филиалами и отделами
- ✅ Аналитика и отчетность
- ✅ Управление складом и товарами
- ✅ Кассовые операции
- ✅ Мобильная адаптивность
- ✅ Многоязычность (русский, кыргызский)

## 🛠 Технологический стек

- **React 18** — UI библиотека
- **Redux Toolkit** — управление состоянием
- **React Router** — маршрутизация
- **Material-UI** — компоненты интерфейса
- **SASS** — стилизация
- **Tailwind CSS** — utility-first CSS
- **Axios** — HTTP клиент
- **i18next** — интернационализация

## 📚 Дополнительная документация

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) — полная документация проекта
- [ADAPTIVE_GUIDE.md](./ADAPTIVE_GUIDE.md) — руководство по адаптивности
- [ORDERS_API_DOCUMENTATION.md](./ORDERS_API_DOCUMENTATION.md) — документация API заказов
- [CODE_ANALYSIS_SellMainStart.md](./CODE_ANALYSIS_SellMainStart.md) — анализ кода компонента продаж
- [TRANSFER_ACCEPTANCE_GUIDE.md](./TRANSFER_ACCEPTANCE_GUIDE.md) — руководство по переводам

## 📁 Структура проекта

```
frontend-actual/
├── public/          # Статические файлы
├── src/
│   ├── api/        # API сервисы
│   ├── Components/ # React компоненты
│   ├── hooks/      # Custom hooks
│   ├── locales/    # Переводы
│   ├── store/      # Redux store
│   └── ...
├── build/          # Production сборка
└── package.json
```

## 🔗 Полезные ссылки

- [React Documentation](https://react.dev/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [React Router Documentation](https://reactrouter.com/)
- [Material-UI Documentation](https://mui.com/)

## 📄 Лицензия

Проект является проприетарным. Все права защищены.
