# Печать в маркете: чековый аппарат (WebUSB ESC/POS)

Документ описывает **как реально работает** печать чеков в секторе **маркет** во фронте NurCRM. Цель — чтобы агент/разработчик мог править печать, не собирая картину заново из десятка файлов.

**Это не отдельный фискальный драйвер в браузере.** «Чековый аппарат» на кассе маркета = **USB-термопринтер** через WebUSB. Фискализация eKassa делается на **бэкенде** при checkout; фронт только **рисует** фискальные поля (РН ККМ, ФМ, ФД, ФПД, QR) на том же термочеке.

> Не путать с кафе: там другой стек (`OrdersPrintService.js` + Wi‑Fi `printer-bridge` + локальный fiscal connector). Маркет **не** использует bridge и **не** вызывает `fiscalDriverService`.

Оглавление сектора: [README.md](./README.md). Кафе для контраста: [../cafe/receipt-printing.md](../cafe/receipt-printing.md).

> **Другой фронт-проект:** переносимая инструкция по миграции на graphic — [graphic-receipt-printing-guide.md](./graphic-receipt-printing-guide.md).

---

## 1. Картина целиком

В маркете один тип печати: **клиентский чек кассы** на USB-термопринтер.

| Тип         | Куда                     | Когда                                                                        | Настройки                                               |
| ----------- | ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Чек продажи | Один USB ESC/POS принтер | После checkout (если не «Без чека»), кнопка «ПЕЧАТЬ ЧЕКА», история/документы | `escpos_*` в localStorage, UI `/crm/pos-print-settings` |

**Формат:** graphic canvas → `GS v 0` при `receiptStyle: "market"`. Текст — при `graphic: false` (как `/crm/sell`).

```
┌──────────────────────┐   checkout JSON / receipt JSON / PDF blob
│ Market PaymentPage   │ ─────────────────────────────────────────┐
│ Receipts / Documents │                                          │
└──────────────────────┘                                          ▼
                                                    ┌─────────────────────────────┐
                                                    │ printService.js              │
                                                    │ handleCheckoutResponse…      │
                                                    │ receiptStyle: "market"       │
                                                    │ → graphic layout → canvas    │
                                                    │ → GS v 0 raster + native QR  │
                                                    └──────────────┬──────────────┘
                                                                   │
                                                                   ▼
                                                         WebUSB bulk OUT
                                                         (Chrome/Edge + USB)
```

Физически:

- **USB:** браузер (Chrome/Edge) ↔ WebUSB ↔ принтер на том же ПК. Bridge **не** нужен и **не** подключён.
- **Wi‑Fi (порт 9100):** в маркете **нет** пути. Не предлагать `npm run printer-bridge` как решение для маркета — это кафе.

Фискал:

```
Checkout (бэкенд) ──► eKassa (сервер) ──► поля в JSON ответа
                              │
                              ▼
              фронт merge в layout термочека (тот же USB)
```

Локальный коннектор `http://localhost:8080` / `fiscalDriverService` — **только кафе**.

---

## 2. Ключевые файлы

| Файл                                                                           | Роль                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/Components/pages/Sell/services/printService.js`                           | Ядро: WebUSB, graphic market layout, enrich, handle checkout, тест PC866 |
| `src/Components/pages/Sell/services/printService.test.js`                      | Vitest: enrich, layout, opaque PDF, format errors                        |
| `src/Components/pages/Info/Settings/PosPrintSettings.jsx`                      | UI ширины/шрифта/codepage + USB-тест                                     |
| `src/Components/Sectors/Market/CashierPage/PaymentPage.jsx`                    | Checkout, автопечать, «Без чека», reprint из success-модалки             |
| `src/Components/Sectors/Market/CashierPage/CashierPage.jsx`                    | Корзина → переход на оплату (**не** печатает)                            |
| `src/Components/Sectors/Market/CashierPage/components/SuccessPaymentModal.jsx` | Кнопка «ПЕЧАТЬ ЧЕКА» после оплаты                                        |
| `src/Components/Sectors/Market/CashierPage/components/ReceiptsModal.jsx`       | Список чеков на кассе                                                    |
| `src/Components/Sectors/Market/CashierPage/components/ReceiptPreviewModal.jsx` | Превью/печать из истории кассы                                           |
| `src/Components/Sectors/Market/Documents/Documents.jsx`                        | Печать из раздела документов                                             |
| `src/Components/Sectors/Market/Documents/components/ReceiptPreviewModal.jsx`   | Превью/печать документов (лучше маппит скидки)                           |
| `src/Components/Sectors/Market/Documents/components/ReceiptEditModal.jsx`      | Редактирование + печать чека                                             |
| `src/store/creators/saleThunk.js`                                              | `productCheckout`, `getProductCheckout` (blob), `getReceiptJson`         |
| `src/config/routes/commonRoutes.jsx`                                           | Роут `pos-print-settings`                                                |
| `src/config/routes/marketRoutes.jsx`                                           | `/crm/market/cashier`, `/crm/market/documents`                           |

**Не** маркетовые (не трогать «для маркета»):

| Файл                                                                 | Зачем существует                     |
| -------------------------------------------------------------------- | ------------------------------------ |
| `src/Components/Sectors/cafe/Orders/OrdersPrintService.js`           | Кафе: USB + Wi‑Fi bridge             |
| `tools/printer-bridge.mjs`                                           | Кафе Wi‑Fi                           |
| `src/services/fiscalDriverService.js`                                | Кафе фискальный коннектор            |
| `CafeReceiptPrinterSettings.jsx` / `CafeKitchenPrintersSettings.jsx` | Настройки кафе в Settings → «Печать» |

Legacy общий Sell-кассир: `src/Components/pages/Sell/Cashier/PaymentPage.jsx` — тот же `printService`, но без `market_withoutCheck` / market UX.

---

## 3. Настройки и localStorage

### 3.1. Ключи POS / маркета

| Ключ                                     | Смысл                                                            |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `escpos_dpl`                             | Dots per line (ширина растра / PDF)                              |
| `escpos_cpl`                             | Chars per line (ширина layout строк)                             |
| `escpos_line`                            | Высота строки на canvas                                          |
| `escpos_font`                            | `A` (12 px ширина символа) или `B` (9 px)                        |
| `escpos_cp`                              | Code page для **текстового** ESC/POS и USB-теста (`ESC t n`)     |
| `escpos_vid` / `escpos_pid`              | Hex USB vendor/product для авто-reconnect                        |
| `escpos_serial`                          | Предпочтительный serial устройства                               |
| `escpos_product` / `escpos_manufacturer` | Кэш имён устройства                                              |
| `market_withoutCheck`                    | `"true"` / иначе — чекбокс «Без чека» на PaymentPage             |
| `selectedSector`                         | Если `"market"` и в options нет `receiptStyle` → авто `"market"` |

Кафе-ключи (`cafe_receipt_printer`, `cafe_printer_bridge_url`, `kitchen_printer_map`, …) маркетом **не** читаются.

### 3.2. UI настроек

| UI                                   | Путь                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Ширина / шрифт / codepage / тест USB | **`/crm/pos-print-settings`** (`PosPrintSettings.jsx`)                     |
| Заголовок в Header                   | «Печать чеков»                                                             |
| Settings → вкладка «Печать»          | **Только кафе**. Для маркета там будет «только для сектора кафе» — не туда |

Значения по умолчанию в UI PosPrintSettings: **384** dots (48 мм печать / ~58 мм бумага), font **B**, codepage **17**.

Рантайм, если `escpos_dpl`/`escpos_cpl` **не** заданы (`getEscposRuntimeConfig`):

| Константа                       | Значение | Смысл                                    |
| ------------------------------- | -------- | ---------------------------------------- |
| `DEFAULT_DOTS_PER_LINE`         | `384`    | 48 мм зона печати (~203 dpi)             |
| `MARKET_DEFAULT_DOTS_PER_LINE`  | `384`    | бумага ~58 мм, печать 48 мм              |
| `MARKET_DEFAULT_CHARS_PER_LINE` | `42`     | font B: 384/9                            |
| `DEFAULT_FONT`                  | `"B"`    |                                          |
| `DEFAULT_CODEPAGE`              | `17`     | PC866                                    |

Пресеты в UI: 80→576, 58/48→384, 44→320, 38→288.

**Важно:** graphic-чек рисует кириллицу на canvas → `escpos_cp` на тело не влияет. Codepage — для текста (`graphic: false`) и USB-теста.

---

## 4. Когда печатается

| Триггер               | Где                                  | Поведение                                                                                                           |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Авто после оплаты** | `PaymentPage.handleAcceptPayment`    | После успешного `productCheckout`; пропускается при «Без чека»                                                      |
| **Ручная повторная**  | Success modal → `handlePrintReceipt` | Сначала сохранённый `checkoutResponse` (с eKassa), иначе PDF blob                                                   |
| **История кассы**     | Чеки → `ReceiptPreviewModal`         | `getReceiptJson` → remap → USB                                                                                      |
| **Документы**         | `/crm/market/documents`              | То же JSON; накладные могут качать PDF                                                                              |
| **«Без чека»**        | Чекбокс на оплате                    | Не probe USB перед checkout, `print_receipt: false`, нет автопечати; success modal всё равно может напечатать позже |
| **Корзина**           | `CashierPage.handleCheckout`         | Только открывает оплату — печати нет                                                                                |

### 4.1. Порядок источников при автопечати

Комментарии в `PaymentPage` (~1023–1038):

1. **Checkout JSON** (`result.payload`) — предпочтительно: часто есть `ekassa` / `ekassa_fiscal`.
2. Fallback: `GET /main/pos/sales/{id}/receipt/` как **blob** (`getProductCheckout`) — PDF или JSON-в-blob.

### 4.2. `printReceiptSmart`

1. `handleCheckoutResponseForPrinting(..., { interactive: false, receiptStyle: "market" })`.
2. Если ошибка **формата** (`isPrintFormatError`) — **не** открывать USB picker; вернуть `false` (пусть caller возьмёт другой источник).
3. Иначе — `ensurePrinterConnectedInteractively()` и повтор.

Перед checkout принтер: сначала `checkPrinterConnection()` (тихое reconnect), при неудаче — interactive picker. При «Без чека» — ни того, ни другого.

`print_receipt` в теле checkout = `isPrinterConnected` (false, если «Без чека» или принтер не подключён).

---

## 5. API

| Метод  | Path                             | Thunk                | Ответ                                                                                    |
| ------ | -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `POST` | `main/pos/sales/{id}/checkout/`  | `productCheckout`    | JSON продажи (+ опционально eKassa). Body: `print_receipt: bool`, оплата, консультант, … |
| `GET`  | `/main/pos/sales/{id}/receipt/`  | `getProductCheckout` | **`blob`** (обычно PDF; иногда JSON внутри blob)                                         |
| `GET`  | `/main/sales/json/{id}/receipt/` | `getReceiptJson`     | JSON для превью/reprint                                                                  |

Контракт скидок / `discount` на JSON чека: [receipt-price-edit-discount.md](./receipt-price-edit-discount.md).

---

## 6. Поток `handleCheckoutResponseForPrinting`

Файл: `printService.js`.

1. `resolveMarketPrintOptions(options)` — если нет `receiptStyle` и `selectedSector === "market"` → `"market"`.
2. `unwrapPrintablePayload(res)` — достаёт из `.receipt` / `.checkoutResponse` / `.payload` / `.data` / …
3. По типу:
   - base64 PDF string → `printReceiptFromPdfUSB`
   - object с `items[]` → `printReceiptJSONViaUSB`
   - Blob → PDF raster **или** parse JSON из blob; иначе download + throw

Для маркета JSON-ветка (по умолчанию):

```
printReceiptJSONViaUSB (receiptStyle === "market")
  → printReceiptJSONGraphicViaUSB
      → buildMarketReceiptLayout → canvas → GS v 0 + QR
      → transferOut
```

Текст — при `options.graphic: false`.

### 6.1. `enrichMarketReceiptPayload(payload, meta)`

- Не трогает opaque payload (Blob / ArrayBuffer / TypedArray / ReadableStream) — иначе спред PDF → `{}` и «Неизвестный формат».
- Для cash: `payment_method`, `cash_received`, `paid_cash`, `change`.
- Для card: `paid_card`.

На кассе обёртка `buildReceiptPrintPayload` дополнительно вшивает ФИО консультанта.

### 6.2. Экспорты `printService.js` (агентам)

`setEscposDotsPerLine`, `setEscposCharsPerLine`, `setEscposLineHeight`, `setEscposFont`, `setEscposCodepage`, `getEscposRuntimeConfig`, `buildMarketReceiptLayout`, `renderReceiptLayoutToCanvas`, `ensurePrinterConnectedInteractively`, `attachUsbListenersOnce`, `checkPrinterConnection`, `printRussianRawUsb`, `isOpaquePrintPayload`, `enrichMarketReceiptPayload`, `handleCheckoutResponseForPrinting`, `isPrintFormatError`

Внутренние критичные: `mapMarketReceiptItem`, `resolveMarketOrderDiscount`, `printReceiptJSONGraphicViaUSB`, `printReceiptFromPdfUSB`, `buildEscPosQr`, `buildEscPosForRaster`, `unwrapPrintablePayload`, `tryUsbAutoConnect`, `openUsbDevice`.

---

## 7. Что попадает на бумагу (graphic layout)

`buildMarketReceiptLayout`:

1. **Шапка:** «СПАСИБО ЗА ПОКУПКУ!», «Контрольно-кассовый чек - Продажа», Магазин / ИНН / адрес.
2. Чек № + дата/время, Кассир, Консультант (если есть), Смена.
3. При eKassa: «СНО: Общий налоговый режим».
4. Позиции: `N) Name` + `цена x кол-во - скидка | итого`.
5. Подытог / Скидка / (НДС/НсП без eKassa) / оплаты / **Итог … СОМ**.
6. Блок ККМ: РН ККМ, ФМ, ФД, ФПД; QR «Проверка чека» (`ekassa_fiscal.link` / `ekassa.link`).

Шрифт canvas: `Courier New`, Menlo, Consolas, Liberation Mono (`RECEIPT_CANVAS_FONT`).

### 7.1. eKassa field map (тыйыны → сомы `/100`)

Источники полей (первый найденный):

`payload.ekassa_fiscal.fields` → `payload.ekassa.fields` → `payload.ekassa.ekassa_payload.data.fields`

| Код             | Смысл                                                          |
| --------------- | -------------------------------------------------------------- |
| `1059[]`        | Позиции: `1030` имя, `1023` qty, `1043` сумма, `1076` цена ед. |
| `1020`          | Подытог                                                        |
| `1031`          | Итог                                                           |
| `1081`          | Безналичные                                                    |
| `1037`          | РН ККМ                                                         |
| `1041`          | ФМ                                                             |
| `1040`          | ФД                                                             |
| `1077`          | ФПД                                                            |
| `1042`          | № документа                                                    |
| `1012`          | Дата/время                                                     |
| `1038`          | Смена                                                          |
| `1033` / `1215` | НДС / НсП (в layout с eKassa часто печатаются 0%)              |

При наличии `ekassaFields`:

- `resolveMarketOrderDiscount` → **0** (итоги берутся из фискальных полей, чтобы не двойнить скидку).
- Позиции предпочтительно из `1059`, скидки строк мержатся из payload items по индексу/имени+qty.

### 7.2. Математика без eKassa

- Строка: `mapMarketReceiptItem` — `line_total`, `line_discount_*`, fallback скидки из `qty*price - line_total`.
- Подытог: Σ(`total` + `line_discount_amount`) — чтобы построчная скидка не вычиталась дважды через order `discount`.
- Order discount: `payload.discount` / `order_discount_total` / `order_discount`.
- Итог: `max(0, subtotal - discount + vat)`.

---

## 8. WebUSB

1. Браузер с WebUSB (Chrome/Edge; Safari — нет). Обычно HTTPS или localhost.
2. Первый выбор: `navigator.usb.requestDevice` (class 0x07 / 0xff) → сохранение vid/pid/serial.
3. Далее `ensureUsbReadyAuto` / `tryUsbAutoConnect` без диалога.
4. `openUsbDevice` → claim interface → bulk OUT → `transferOut` чанками (~12 KB).
5. Windows: при Access denied часто нужен WinUSB (Zadig); закрыть другие программы, держащие принтер.

Состояние: модульный `usbState = { dev, opening }` + listeners connect/disconnect.

---

## 9. Отличия от кафе

|              | Маркет                                 | Кафе                                               |
| ------------ | -------------------------------------- | -------------------------------------------------- |
| Сервис       | `Sell/services/printService.js`        | `Orders/OrdersPrintService.js`                     |
| Транспорт    | **Только WebUSB**                      | WebUSB **или** bridge `POST /print`                |
| Настройки    | `/crm/pos-print-settings` (`escpos_*`) | Settings «Печать» + `cafe_receipt_printer` / кухни |
| Стиль        | Graphic raster (`GS v 0`)              | Text ESC/POS + кухонные тикеты                     |
| Авто         | После checkout                         | Pay + WS + кухни                                   |
| Dedupe/locks | Нет                                    | `cafe_receipt_printed_*`, locks                    |
| Фискал       | Поля eKassa в checkout JSON            | `fiscalDriverService` + `/cafe/fiscal/`            |
| «Без чека»   | `market_withoutCheck`                  | Другой UX                                          |
| Кухни        | Нет                                    | Да                                                 |

---

## 10. Типичные ловушки

1. **Изменение цены ≠ скидка** — бэкенд иногда кладёт `catalog − manual` в `discount`; печать считает `подытог − discount` и занижает итог. Спека: [receipt-price-edit-discount.md](./receipt-price-edit-discount.md).
2. **Reprint из истории/документов часто без eKassa** — remap только name/qty/price/total; фискальный блок пропадает. Для ККМ-reprint предпочтителен сохранённый checkout JSON.
3. **Cashier `ReceiptPreviewModal`** хуже маппит скидки, чем Documents-версия.
4. **`getProductCheckout` = blob** — PDF raster или JSON-in-blob; format error → другой источник, не reconnect USB.
5. **Вкладка Settings «Печать»** не настраивает маркет — только `/crm/pos-print-settings`.
6. **UI/runtime default 48 мм печати (384 dots)**; если в localStorage остался старый `escpos_dpl=576` — пересохраните пресет «58 мм / 48 мм» в `/crm/pos-print-settings`.
7. **Не предлагать printer-bridge** для маркета.
8. **Не вызывать fiscalDriverService** из маркет-кассы.
9. Opaque PDF нельзя enrich’ить спредом — уже защищено `isOpaquePrintPayload`.
10. Консультант на чеке: вшивается при checkout enrich; history remap может его потерять.

---

## 11. Cheat-sheet для агента

```
Pay → productCheckout({ print_receipt: printerOk && !withoutCheck })
   → enrichMarketReceiptPayload / buildReceiptPrintPayload
   → handleCheckoutResponseForPrinting(..., { receiptStyle: "market" })
   → printReceiptJSONGraphicViaUSB  (или PDF raster)
   → WebUSB transferOut

History/Docs → getReceiptJson → (часто урезанный remap) → тот же handle…
«Без чека» → print_receipt:false, skip USB; Success modal может печатать
eKassa → только если бэкенд положил fields в checkout JSON
Bridge / fiscalDriver → кафе, не маркет
Настройки → /crm/pos-print-settings (escpos_*)
Тесты → npx vitest run src/Components/pages/Sell/services/printService.test.js
```

### Роуты экранов

- Касса: `/crm/market/cashier`
- Документы: `/crm/market/documents`
- Настройки печати: `/crm/pos-print-settings`

---

## 12. Связанные доки

| Документ                                                                 | Зачем                              |
| ------------------------------------------------------------------------ | ---------------------------------- |
| [receipt-price-edit-discount.md](./receipt-price-edit-discount.md)       | Контракт `discount` vs ручная цена |
| [sale-consultant-commission.md](./sale-consultant-commission.md)         | Консультант на чеке / checkout     |
| [cashier-settings.md](./cashier-settings.md)                             | Скидки кассира (не принтер)        |
| [../cafe/receipt-printing.md](../cafe/receipt-printing.md)               | Другой стек — не смешивать         |
| `PROJECT_DOCUMENTATION.md` §19 (кафе) + §19a (маркет, краткий указатель) |
