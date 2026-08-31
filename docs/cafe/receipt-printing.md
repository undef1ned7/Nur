# Печать в кафе: чековый аппарат, кухни, ESC/POS

Документ описывает **как реально работает** печать в секторе кафе во фронте NurCRM. Цель — чтобы агент/разработчик мог править печать, не собирая картину заново из десятка файлов.

**Это не фискальный ККМ.** «Чековый аппарат» в UI настроек = термопринтер кассы (ESC/POS). Фискализация (коннектор / ФД) — отдельный контур; он кратко описан в конце.

---

## 1. Картина целиком

В кафе два независимых типа печати:

| Тип | Куда | Когда | Binding |
|---|---|---|---|
| **Чек кассы** (гость/кассир) | Один принтер кассы | Оплата, ручная кнопка, история, авто по WS `order_updated` → paid | `localStorage.cafe_receipt_printer` |
| **Кухонный тикет** | Принтер **каждой** кухни | Создание заказа (WS), изменение состава (diff), отмена | поле `kitchen.printer` + fallback `kitchen_printer_map` |

Низкий уровень один: `OrdersPrintService.js` собирает ESC/POS и шлёт либо по **WebUSB**, либо по **HTTP → printer-bridge → RAW TCP :9100**.

```
┌─────────────┐     payload JSON      ┌──────────────────────┐
│ Orders.jsx  │ ────────────────────► │ OrdersPrintService   │
│ CafeLayout  │                       │ buildPrettyReceipt…  │
│ History     │                       │ + USB / Wi‑Fi send   │
│ Analytics   │                       └──────────┬───────────┘
└─────────────┘                                  │
                    ┌────────────────────────────┼────────────────────────────┐
                    ▼                            ▼                            ▼
              WebUSB bulk OUT          POST bridge /print              (ошибка без bridge
              (USB-принтер)            → RAW TCP ip:9100               = HTTP на :9100 =
                                                                       мусор на ленте)
```

Физически:

- **USB:** браузер (Chrome) ↔ WebUSB ↔ принтер на том же ПК. Bridge **не** нужен.
- **Wi‑Fi (XPrinter и т.п., порт 9100):** браузер **не умеет** сырой TCP → нужен локальный агент (`npm run printer-bridge` или `tools/printer-agent`). Bridge должен жить **в LAN с принтером**, не на VPS.

---

## 2. Ключевые файлы

| Файл | Роль |
|---|---|
| `src/Components/Sectors/cafe/Orders/OrdersPrintService.js` | ESC/POS, USB, Wi‑Fi, bindings, ширина ленты, официант, финанс-отчёт |
| `src/Components/Sectors/cafe/CafeLayout.jsx` | **Главный** авто-контур: WS `order_created` / `order_updated`, кухня, diff, чек после оплаты, очередь печати, poll visibility |
| `src/Components/Sectors/cafe/Orders/Orders.jsx` | Ручная печать чека; печать сразу после `finishPaySuccess`; payload с финансами/весом |
| `src/Components/Sectors/cafe/Orders/CafeOrdersHistory.jsx` | Повторная печать из истории |
| `src/Components/Sectors/cafe/utils/resolveTableLabel.js` | Единый резолвер «СТОЛ N» / «С собой» |
| `src/Components/Sectors/cafe/utils/cafeOrderFinancials.js` | subtotal / discount / paid_cash|card для чека |
| `src/Components/pages/Info/Settings/CafeReceiptPrinterSettings.jsx` | UI принтера кассы |
| `src/Components/pages/Info/Settings/CafeKitchenPrintersSettings.jsx` | UI принтеров кухонь + флаг автопечати |
| `src/Components/Sectors/cafe/Cook/*` | При создании/редактировании кухни тоже пишется `printer` |
| `tools/printer-bridge.mjs` | HTTP→RAW TCP (порт 5179) |
| `tools/printer-agent/` | Python/Flet альтернатива bridge (тот же API) |

`autoPrintKitchenTickets` в `Orders.jsx` **определён, но нигде не вызывается** (мёртвый код). Живая автопечать кухни — только `CafeLayout`.

---

## 3. Настройки и localStorage

### 3.1. Binding принтера

Формат строки:

| Binding | Значение |
|---|---|
| `usb/<vid>:<pid>:<serial>` | WebUSB-ключ (serial может быть `noserial`) |
| `ip/<host>` | Wi‑Fi, порт по умолчанию **9100** |
| `ip/<host>:<port>` | Wi‑Fi с явным портом |

Парсинг/сборка: `parsePrinterBinding` / `formatPrinterBinding` в `OrdersPrintService.js`.

### 3.2. Ключи хранилища

| Ключ | Где | Смысл |
|---|---|---|
| `cafe_receipt_printer` | localStorage | Binding принтера кассы |
| `cafe_printer_bridge_url` | localStorage | URL агента, default `http://127.0.0.1:5179/print` |
| `cafe_printer_paper_mm` | localStorage (JSON map) | Ширина ленты mm → chars/line **по binding** |
| `kitchen_printer_map` | localStorage (JSON) | Fallback `kitchenId → binding`, если бэкенд не отдал `printer` |
| `cafe_auto_kitchen_print` | localStorage | `"true"` / `"false"` — явный opt-in автопечати кухни (и visibility-poll) |
| `escpos_printers` / `escpos_printer_active` | localStorage | Список/активный USB-принтер для WebUSB |
| `escpos_cp` | localStorage | Code page ESC/POS (default `73` = CP1251) |
| `company_name` | localStorage | Шапка чека |
| `cafe_receipt_printed_<orderId>` | localStorage (+ session в Layout) | Dedupe чека кассы |
| `cafe_kitchen_printed_<orderId>` | localStorage | Dedupe первичных кухонных тикетов |
| `cafe_kitchen_print_skip_<orderId>` | localStorage | После исчерпания retry — не долбить API |
| `cafe_kitchen_cancel_printed_<orderId>` | localStorage | Dedupe слипа отмены |
| `cafe_kitchen_print_lock_<orderId>` | localStorage | Короткий lock ~30с |
| `cafe_receipt_print_lock_<orderId>` | localStorage | Короткий lock чека ~30с |
| `cafe_order_items_snapshot_<orderId>` | localStorage | Снимок qty по menu_item для diff |
| `cafe_ws_order_created_kitchen_<orderId>` | sessionStorage | Dedupe WS create 30с |

### 3.3. API настроек

| Метод | Path | Назначение |
|---|---|---|
| GET/PATCH | `/cafe/receipt-printer/` | `{ printer, bridge_url }` — синк настроек кассы |
| GET | `/cafe/kitchens/` | Список кухонь (поле `printer` / алиасы) |
| PATCH | `/cafe/kitchens/:id/` | `{ printer: "ip/…" \| "usb/…" }` |
| GET | `/cafe/menu-items/:id/` | `kitchen` — куда слать позицию |
| GET | `/cafe/orders/:id/` | Detail для печати (items, table, waiter, money) |
| GET | `/cafe/tables/` | Карта столов (через WS manager тоже) |

UI: Настройки → секции «Кафе • Принтер кассы» и «Кафе • Принтеры кухонь» (`Settings.jsx`).

**Важно:** автопечать кухни включается чекбоксом `cafe_auto_kitchen_print=true` **на том ПК**, где крутится bridge/USB. Нельзя писать `true` автоматически при детекции bridge — иначе каждый ПК с агентом начнёт poll и DDoS-ит `/cafe/orders/` (см. комментарии в `CafeLayout`).

---

## 4. Транспорт печати

### 4.1. USB (WebUSB)

1. Пользователь выбирает устройство (`navigator.usb.requestDevice`, class 0x07 / 0xff).
2. Ключ сохраняется в `escpos_printers`, binding `usb/...`.
3. `openUsbDevice` → claim bulk OUT → `transferOut` чанками.
4. При «Access denied» на Windows обычно нужен WinUSB (Zadig).

### 4.2. Wi‑Fi через bridge

Браузер:

```http
POST {cafe_printer_bridge_url}   # default http://127.0.0.1:5179/print
Content-Type: application/json

{ "ip": "192.168.1.200", "port": 9100, "data": "<base64 ESC/POS>", "timeoutMs": 7000 }
```

Bridge (`tools/printer-bridge.mjs`):

- `GET /health` — проверка живости (используется в `shouldAutoPrintNow`).
- `POST /print` — decode base64 → TCP connect → write → close.
- CORS `*`. Env: `PRINTER_BRIDGE_HOST`, `PRINTER_BRIDGE_PORT`.

Без bridge нельзя слать HTTP напрямую на `:9100`: принтер напечатает HTTP-заголовки как текст.

### 4.3. Очередь

В `CafeLayout` все авто-задания идут через `enqueuePrintJob` (single-lane Promise chain + delay 1с), чтобы не забивать один USB/TCP поток параллельными job'ами.

---

## 5. ESC/POS: что попадает на бумагу

Функция `buildPrettyReceiptFromJSON(payload, { paperMm })`:

1. Init: ESC `@`, international char set, code page (`escpos_cp`).
2. Центр: `company`, строка `ЧЕК: ${doc_no}`.
3. Дата, Кассир, Официант.
4. Опционально `menu_title` (для diff: «ДОБАВИТЬ» / «УБРАТЬ»).
5. Позиции: имя, комментарий, `qty x price = sum` (или `qty_display`).
6. СУММА / СКИДКА / ИТОГО; НАЛИЧНЫЕ / КАРТА / ОПЛАТА.
7. Feed + cut (`GS V`).

Ширина строки от `cafe_printer_paper_mm` (38→24 … 80→48 … 112→64 символов).

**Кухонный тикет** использует тот же билдер: цены часто не передают; в `doc_no` — кухня и стол. Diff передаёт `menu_title: "ДОБАВИТЬ"|"УБРАТЬ"`.

Отдельный билдер: `printFinanceCashReportToReceiptPrinter` — отчёт «ОТЧЕТ НА КАССУ» из аналитики (`CafeAnalytics.jsx`), тоже на `cafe_receipt_printer`.

### 5.1. Контракт payload

```js
{
  company: string,          // шапка
  doc_no: string,           // печатается как «ЧЕК: …»
  created_at: string,       // уже отформатированная дата
  cashier_name: string,
  waiter_name: string,
  discount?: number,
  subtotal?: number,
  total?: number,
  paid_cash?: number,
  paid_card?: number,
  payment_method?: string,  // cash|card|transfer|mixed → короткая подпись
  menu_title?: string,      // секция diff
  kitchen_id?: string|number,
  paper_mm?: number,
  items: [{
    name, qty, price?, comment?, qty_display?
  }]
}
```

---

## 6. Когда что печатается

### 6.1. Чек кассы (гость)

| Триггер | Где | Условие |
|---|---|---|
| Успешная оплата | `Orders.jsx` → `finishPaySuccess` → `printOrder` | Всегда пытается; нужен настроенный `cafe_receipt_printer` |
| Кнопка «Печать» в модалке оплаты | `Orders.jsx` | Ручная |
| Повтор из истории | `CafeOrdersHistory.jsx` → `printOrder` | Ручная |
| WS `order_updated` + paid | `CafeLayout.printReceiptForOrder` | Авто на любом устройстве с binding; dedupe `cafe_receipt_printed_*` |
| Visibility poll | `CafeLayout.pollRecentOrdersAndPrint` | Только если `cafe_auto_kitchen_print === "true"`; свежие заказы ≤2 мин |

Ручной `printOrder` в Orders:

1. Lock `cafe_receipt_print_lock_*`.
2. GET `/cafe/orders/:id/` (актуальные comments/items).
3. `buildPrintPayload` → финансы через `buildCafeReceiptPrintFinancials`, вес через `cafeMenuWeight`.
4. Resolve waiter (map сотрудников / `fetchCafeWaiterLabelByEmployeeId`).
5. `printViaWiFiSimple` или USB.
6. Mark `cafe_receipt_printed_<id>`.

Авточек в Layout **не** подмешивает финансы так же богато (discount/paid часто 0) — берёт `buildReceiptPayload` с ценами позиций. Для гостевого чека после оплаты с этого же ПК обычно уже отработал `finishPaySuccess`.

### 6.2. Кухня: первичный тикет

Триггер: WS `order_created` в `CafeLayout`.

```
order_created
  → tryConsumeWsOrderCreatedKitchenDedupe (30с session)
  → shouldAutoPrintNow()
       • cafe_auto_kitchen_print === "false" → нет
       • === "true" → да
       • иначе (только WS, не poll): GET bridge /health или WebUSB connected
  → printKitchenTicketsForOrder(orderId)
```

Алгоритм `printKitchenTicketsForOrder`:

1. Skip если уже `cafe_kitchen_printed_*` / skip prefix / in-flight / cooldown после фейла.
2. Acquire kitchen lock.
3. GET detail; при `stabilize: true` (WS) — до 2× повтор с паузой 450мс, пока signature items не стабилизируется; retry delays 400…4000мс, max 5.
4. Если есть table id, а `tablesMap` пуст — wait 1.5с.
5. Для каждого item: `menu_item` → GET `/cafe/menu-items/:id/` → `kitchen` (кеш в ref).
6. Группировка по kitchenId.
7. Binding: `kitchen.printer` (и алиасы) → иначе `kitchen_printer_map[kid]`.
8. Payload: `doc_no = "${kitchenLabel} • СТОЛ N"` или `… • С собой`.
9. Печать в очередь; после успеха — `cafe_kitchen_printed_*` + snapshot items для diff.

**Visibility fallback** (`pollRecentOrdersAndPrint`): только явный `cafe_auto_kitchen_print=true`, `stabilize: false`, budget ≤2 detail GET на тик, заказы младше 2 минут. Интервальный poll **отключён** (был DDoS).

### 6.3. Кухня: diff (добавить / убрать / отмена)

Триггер: WS `order_updated` и заказ **не** paid → `printKitchenDiffTicketsForOrder`.

1. `shouldAutoPrintNow()` (с auto-detect bridge).
2. Сравнить текущие qty по `menu_item` со snapshot `cafe_order_items_snapshot_*`.
3. Добавления → слип `menu_title: ДОБАВИТЬ`; удаления → `УБРАТЬ`.
4. `doc_no`: `"${kitchen} | СТОЛ N | ИЗМЕНЕНИЕ"` или `… | ОТМЕНА`.
5. Если заказ cancelled — печатает все позиции как УБРАТЬ один раз (`cafe_kitchen_cancel_printed_*`).
6. **Anti-double:** если snapshot пуст, есть только additions, заказ моложе 25с — **не** печатать diff (это хвост create, первичный тикет ещё не успел записать snapshot).

### 6.4. Привязка меню → кухня → принтер

```
OrderItem.menu_item
  → MenuItem.kitchen (id)
    → Kitchen.printer ("ip/…" | "usb/…")
      → или localStorage kitchen_printer_map[kitchenId]
```

Позиция без кухни в меню **молча пропускается** (группа не создаётся → retry `no-kitchen-groups`).

Кухни создаются/правятся в Cook UI (`KitchenCreateModal` / edit) с тем же binding; Settings дублируют централизованную привязку.

---

## 7. Стол на чеке (`doc_no`)

Единый helper: `resolveTableLabel(order, tablesMap)` + `TAKEAWAY_LABEL = "С собой"`.

Порядок:

1. `order.table_number` / `table_num` (если бэкенд уже отдал).
2. table id: `table_id || tableId || table.id || table`.
3. Пустой id → **«С собой»**.
4. Lookup в `tablesMap`: title/name/label… → иначе `number`.
5. Fallback поля заказа `table_name` / `table_label` / …
6. Мусор (`?`, `null`, UUID) отфильтровывается → иначе **«—»**.

Шаблоны `doc_no`:

| Сценарий | Пример |
|---|---|
| Чек кассы, стол | `СТОЛ 7` |
| Чек кассы, takeaway | `С собой` |
| Кухня create | `Раздача №2 • СТОЛ 7` |
| Кухня diff | `Раздача №2 \| СТОЛ 7 \| ИЗМЕНЕНИЕ` |
| Тест | `ТЕСТ` / `… • ТЕСТ` |

`OrdersPrintService` **не** решает стол — печатает `ЧЕК: ${payload.doc_no}` как есть.

---

## 8. Официант на чеке

`pickCafeOrderWaiterName(order, waiterIdToLabel?)`:

1. Готовые label-поля (`waiter_name`, `waiter_label`, …).
2. Объект `waiter` → ФИО / email.
3. Строка UUID → lookup в map сотрудников; иначе `fetchCafeWaiterLabelByEmployeeId` → GET `/users/employees/:id/` (кеш + TTL фейлов 5 мин).
4. Не-UUID строка печатается как есть.

`CafeLayout` грузит map сотрудников при mount.

---

## 9. Финансы на чеке кассы

`buildCafeReceiptPrintFinancials(order, itemsSubtotal)`:

- `subtotal` ← `order.total_amount` или сумма строк.
- `discount` ← `order.discount_amount`.
- `total` ← `net_paid_amount` / `paid_amount` если >0, иначе due.
- `payment_method` → `paid_cash` / `paid_card` (только cash/card; иначе 0+0 и короткая строка «ОПЛАТА»).

Весовые позиции: `qty_display` вида `0.350 × 800.00 сом/кг` (Orders / History).

---

## 10. Lock / dedupe / retry (чтобы не дублировать)

Проблема: один заказ может прийти с телефона официанта, с кассы и по WS на ПК с принтерами — без защиты будут 2–3 одинаковых слипа.

Слои:

1. **In-memory Sets** в Layout (`printedOrdersRef`, `printingOrdersRef`, …) — в рамках вкладки.
2. **localStorage flags** `*_printed_*` — между перезагрузками на этом ПК.
3. **Locks** TTL 30с — анти-гонка двух хендлеров.
4. **sessionStorage WS dedupe** 30с на `order_created`.
5. **Retry + skip** после max attempts — иначе poll бьёт detail вечно.
6. **PRINT_FAILURE_COOLDOWN** 60с после ошибки.
7. **Очередь** 1с между job.

Следствие: если **первый** успешный payload был с плохим столом, повторно «исправить» тот же заказ автопечатью уже не получится, пока не сбросить ключи / не печатать вручную.

Мульти-ПК: dedupe **локальный**. Намеренно: печатает тот ПК, где настроены принтеры/bridge. На остальных устройствах флаги не мешают «чужой» печати.

---

## 11. `shouldAutoPrintNow` — когда устройство «кассовый терминал»

```
cafe_auto_kitchen_print === "false"  → false
cafe_auto_kitchen_print === "true"   → true
иначе + allowAutoDetect:
  GET {bridgeUrl}/health (кеш ok 30с / fail 10с)
  иначе checkPrinterConnection() (WebUSB)
иначе (poll, allowAutoDetect=false):
  false  // без явного opt-in не печатаем и не ходим в API
```

Чек оплаты в Layout (`printReceiptForOrder`) **не** проверяет этот флаг — достаточно наличия `cafe_receipt_printer`. Кухонный diff и create — проверяют.

---

## 12. Отличие от фискальной кассы

Параллельный контур (не путать):

| | Термопринтер (этот документ) | Фискал |
|---|---|---|
| Цель | Бумажный слип для гостя/кухни | Юридический ФД |
| Сервис | `OrdersPrintService` + bridge | `fiscalDriverService` + коннектор |
| API | `/cafe/receipt-printer/`, kitchens | `/cafe/fiscal/...` |
| Триггер оплаты | `printOrder` после pay | `runFiscalReceipt` до/вокруг учёта |
| Настройка | Settings «Принтер кассы» | Фискальные настройки + CafeOpenShift |

При включённом фискале оплата может пробить ККМ **и** напечатать ESC/POS-чек — это два разных канала.

---

## 13. Типовые сценарии отладки

| Симптом | Куда смотреть |
|---|---|
| На ленте HTTP-заголовки | Нет bridge / неверный URL / шлют HTTP на :9100 |
| Кухня молчит | `cafe_auto_kitchen_print`, bridge `/health`, `kitchen.printer`, у позиций меню есть `kitchen` |
| Дубли кухонных слипов | create + diff без snapshot; два ПК с auto; TTL skip |
| `СТОЛ —` / `С собой` вместо номера | `resolveTableLabel`, пустой `tablesMap` при раннем WS, нет `table_number` |
| USB Access denied | WinUSB / Zadig; другой процесс держит принтер |
| Чек без скидки/оплаты (авто) | Авто Layout payload беднее, чем `Orders.buildPrintPayload` |
| Poll грузит API | Не ставить `cafe_auto_kitchen_print=true` на всех ПК |

Полезные проверки в DevTools:

```js
localStorage.getItem("cafe_receipt_printer")
localStorage.getItem("cafe_printer_bridge_url")
localStorage.getItem("cafe_auto_kitchen_print")
localStorage.getItem("kitchen_printer_map")
await fetch((localStorage.getItem("cafe_printer_bridge_url")||"http://127.0.0.1:5179/print").replace(/\/print\/?$/,"/health"))
```

Тестовая печать: кнопки в Settings (касса / каждая кухня).

---

## 14. Чеклист при изменении печати

1. Меняешь формат бумаги → только `buildPrettyReceiptFromJSON` / paper mm map.
2. Меняешь «когда печатать» → `CafeLayout` (авто) и/или `Orders.finishPaySuccess` / History.
3. Меняешь стол → только `resolveTableLabel.js` (+ тесты), не копируй логику в экраны.
4. Меняешь привязку кухни → Settings + Cook create/edit + fallback map.
5. Не включай auto-print глобально без opt-in.
6. Wi‑Fi всегда через bridge API `{ ip, port, data }`.
7. После успешной печати кухни обновляй snapshot — иначе diff сломается или задублирует create.

---

## 15. Краткая карта вызовов (для поиска по коду)

```
printViaWiFiSimple / printOrderReceiptJSONViaUSB
  ← Orders.printOrder
  ← CafeOrdersHistory.printOrder
  ← CafeLayout.printReceiptForOrder
  ← CafeLayout.printKitchenTicketsForOrder
  ← CafeLayout.printKitchenDiffTicketsForOrder
  ← CafeReceiptPrinterSettings.testPrint
  ← CafeKitchenPrintersSettings.testKitchen
  ← printFinanceCashReportToReceiptPrinter (Analytics)

WS orders.lastMessage
  order_created  → kitchen tickets
  order_updated  → receipt if paid | kitchen diff if not

visibilitychange → pollRecentOrdersAndPrint (opt-in only)
```
