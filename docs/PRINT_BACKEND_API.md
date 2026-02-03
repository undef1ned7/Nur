# API печати на Wi‑Fi принтер (для бэкенда)

Фронт не умеет открывать сырой TCP. Чтобы печатать на сетевой принтер (порт 9100), он шлёт задание на бэкенд; бэкенд открывает TCP-сокет к принтеру и отправляет туда **только байты** (без HTTP).

---

## Контракт API

### Запрос

- **Метод:** `POST`
- **URL:** на ваш выбор, например `/api/cafe/print` или `/api/print`
- **Content-Type:** `application/json`
- **Тело (JSON):**

| Поле       | Тип    | Обязательный | Описание |
|-----------|--------|--------------|----------|
| `ip`      | string | да           | IPv4 принтера, например `"192.168.1.200"` |
| `port`    | number | нет          | Порт (по умолчанию **9100**) |
| `data`    | string | да           | Байты чека в **base64** (ESC/POS) |
| `timeoutMs` | number | нет        | Таймаут подключения к принтеру, мс (по умолчанию 2000) |

**Пример тела:**

```json
{
  "ip": "192.168.1.200",
  "port": 9100,
  "data": "RVMtQUMK...",
  "timeoutMs": 2000
}
```

### Ответ

- **Успех:** `200 OK`, тело например `{"ok": true}` (или пустое — фронт смотрит только на статус 2xx).
- **Ошибка:** `4xx` или `5xx`, тело например `{"ok": false, "error": "текст ошибки"}` — фронт покажет его пользователю.

---

## Что должен делать бэкенд

1. Принять POST, распарсить JSON.
2. Проверить `ip` (IPv4) и `port` (1–65535).
3. Декодировать `data` из base64 в бинарные данные (bytes).
4. Открыть **обычный TCP-сокет** к `ip:port` (не HTTP, не HTTPS — именно сырой TCP).
5. Записать в сокет эти байты целиком.
6. Закрыть сокет.
7. Вернуть 200.

**Важно:** на принтер уходит только то, что в `data`. Никаких HTTP-заголовков, никакого `POST / HTTP/1.1` — иначе на чеке печатаются заголовки.

Псевдокод:

```
bytes = base64_decode(body["data"])
socket = tcp_connect(body["ip"], body["port"] ?? 9100, timeout: body["timeoutMs"] ?? 2000)
socket.write(bytes)
socket.close()
return 200
```

---

## Примеры по языкам

### Python (Django / FastAPI / Flask)

```python
import socket
import base64
import json

def send_to_printer(ip: str, port: int, data_base64: str, timeout_ms: int = 2000) -> None:
    data = base64.b64decode(data_base64)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout_ms / 1000.0)
        s.connect((ip, port))
        s.sendall(data)
```

Обработчик запроса: прочитать `request.body` (JSON), взять `ip`, `port`, `data`, вызвать `send_to_printer`, вернуть 200 или 4xx с текстом ошибки.

### Node.js

```js
const net = require('net');

function sendToPrinter({ ip, port = 9100, dataBase64, timeoutMs = 2000 }) {
  const buf = Buffer.from(dataBase64, 'base64');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port });
    const t = setTimeout(() => socket.destroy(new Error('Timeout')), timeoutMs);
    socket.on('connect', () => { socket.write(buf); socket.end(); });
    socket.on('error', reject);
    socket.on('close', () => { clearTimeout(t); resolve(); });
  });
}
```

### PHP

```php
$body = json_decode(file_get_contents('php://input'), true);
$ip = $body['ip'];
$port = $body['port'] ?? 9100;
$data = base64_decode($body['data']);

$fp = @fsockopen($ip, $port, $errno, $errstr, 2);
if (!$fp) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $errstr]);
    exit;
}
fwrite($fp, $data);
fclose($fp);
http_response_code(200);
echo json_encode(['ok' => true]);
```

---

## CORS

Если фронт открыт с другого домена (например приложение на `https://nurcrm.kg`, бэкенд на `https://api.nurcrm.kg`), нужно отдавать заголовки:

- `Access-Control-Allow-Origin: <origin из запроса>` или `*`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

Для `OPTIONS` (preflight) — ответ без тела, статус 204.

---

## Безопасность

- IP принтера приходит с клиента. Имеет смысл ограничить круг адресов (например только приватные `10.x`, `192.168.x`, `172.16–31.x`) или хранить привязку «пользователь/точка — принтер» на бэкенде и не доверять `ip` из запроса без проверки.
- Endpoint лучше закрыть авторизацией (сессия, JWT и т.п.), чтобы печать могли вызывать только авторизованные пользователи.

---

## Бэкенд на VPS

Если бэкенд крутится на **VPS** (облачный сервер), он обычно **не видит принтер** в офисе/кафе: принтер в локальной сети (`192.168.x.x`), VPS — в интернете, маршрута до приватной сети нет.

**Варианты:**

1. **Printer-bridge в офисе (рекомендуется)**  
   На ПК или мини-сервере в той же сети, что и принтер, запускается `printer-bridge` (или свой скрипт с той же логикой). В настройках печати во фронте указывается URL этого ПК, например `http://192.168.1.10:5179/print`.  
   Цепочка: браузер (кассир) → офисный ПК (bridge) → принтер. Бэкенд на VPS в печати не участвует.

2. **Endpoint печати на VPS + VPN/туннель в офис**  
   Сделать `/api/cafe/print` на VPS. Чтобы VPS достучался до принтера, поднять VPN или туннель между VPS и офисной сетью (WireGuard, OpenVPN, tailscale и т.п.). Тогда с VPS будет маршрут до `192.168.x.x`, и бэкенд сможет открывать TCP к принтеру. Сложнее в настройке и поддержке.

3. **Агент в офисе**  
   В офисе крутится агент (скрипт/сервис), который получает задания печати (polling к бэкенду или WebSocket) и сам шлёт байты на принтер по TCP. Бэкенд на VPS только сохраняет задание в очередь; до принтера доходит агент. Требует отдельной разработки агента и очереди.

Для большинства сценариев достаточно **варианта 1**: printer-bridge (или один endpoint с той же логикой) на машине в офисе, во фронте — URL этого bridge. Бэкенд на VPS тогда не нужен для печати.

---

## Настройка на фронте

После появления endpoint на бэкенде пользователь в настройках приложения (Настройки → Печать) в поле «Printer-bridge URL» указывает URL этого endpoint, например:

- `https://api.nurcrm.kg/api/cafe/print`

Либо вы задаёте этот URL по умолчанию в коде/конфиге, тогда отдельный printer-bridge не нужен.
