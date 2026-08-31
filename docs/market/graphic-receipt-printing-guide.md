# Graphic-печать чека (WebUSB ESC/POS) — переносимая инструкция для фронт-проекта

**Дата:** 28.08.2026  
**Референс-реализация:** NurCRM `src/Components/pages/Sell/services/printService.js`  
**Аудитория:** разработчики **другого** фронт-проекта, которые хотят перевести чек с текстового ESC/POS на **graphic** (canvas → raster → `GS v 0`).

Документ **самодостаточен**: можно перенести логику без чтения всего NurFront. В конце — чеклист миграции.

---

## 1. Зачем graphic вместо text

| | Text ESC/POS | Graphic (canvas → raster) |
|---|---|---|
| Кириллица | Зависит от codepage (`PC866`/`CP1251`), часто «иероглифы» | Unicode на canvas → без codepage для тела чека |
| Жирный / размер | ESC `!`, ограниченно | `bold`, `scale` на строках layout |
| Две колонки (цена справа) | `lr()` по **символам** — ломается на кириллице | `left` + `right` по **пикселям** |
| QR | Отдельная ESC/POS-команда | После растра — native `GS ( k` |
| Риски | Неверный `escpos_cp` | Первая печать после USB claim — «иероглифы» (см. §8) |

**Когда оставить text:** принтер **не** поддерживает `GS v 0` (bitmap) стабильно → fallback `graphic: false` + codepage.

---

## 2. Пайплайн целиком

```
JSON чека (checkout / GET /receipt/json/)
        │
        ▼
buildReceiptLayout(payload)     ← массив строк layout (не bytes!)
        │
        ▼
renderLayoutToCanvas(lines, cfg) ← HTML Canvas, ширина = dotsPerLine
        │
        ▼
canvasToRasterBytes(canvas)     ← 1-bit bitmap, MSB first
        │
        ▼
buildEscPosForRaster(...)       ← ESC @ + GS v 0 + raster [+ cut]
        │
        ▼
[optional] buildEscPosQr(link)  ← после растра, до feed/cut
        │
        ▼
WebUSB transferOut (chunks ~12 KB)
```

**Не смешивать** graphic-raster и text-bytes в одном `transferOut` без `ESC @` между ними.

---

## 3. Требования

- **Браузер:** Chrome / Edge (WebUSB). Safari — нет.
- **Контекст:** HTTPS или `localhost`.
- **Принтер:** USB ESC/POS (XPrinter, Epson TM и т.п.), bulk OUT endpoint.
- **ОС:** Windows часто нужен WinUSB (Zadig), иначе `Access denied` на claim.
- **Runtime:** только браузер (Canvas API). Node/Electron — тот же код, если есть `document` + WebUSB.

---

## 4. Размеры ленты (48 мм печать)

Типичная термолента **58 мм бумага / 48 мм печать** (~203 dpi, 8 dot/mm):

| Параметр | Значение | Где хранить |
|---|---|---|
| `dotsPerLine` | **384** | `localStorage.escpos_dpl` |
| `charsPerLine` | **32** (не 42!) | `localStorage.escpos_cpl` |
| `lineDotHeight` | ~24–28 | `localStorage.escpos_line` |

Формула: `dotsPerLine ≈ printWidthMm × 8` → 48 × 8 = **384**.

Старый дефолт 576 (80 мм) даёт **узкий чек по центру ленты** — мелкий текст.

---

## 5. Модель layout (ключевой контракт)

Layout — массив **объектов-строк**, не готовый ESC/POS.

### 5.1. Обычная строка

```javascript
{
  text: "СПАСИБО ЗА ПОКУПКУ!",
  align: "center",   // "left" | "center" | "right"
  bold: true,
  scale: 1.15,       // множитель к baseFontSize
}
```

### 5.2. Двухколоночная строка (товары, итоги)

**Не** собирайте одну строку `"40.00 x 1          40.00"` через пробелы — кириллица не моноширинная.

```javascript
{
  left: "40.00 x 1",
  right: "40.00",
  bold: true,
}
```

Рендерер рисует `right` у **правого края** canvas по `measureText`, `left` усекается с `…` если не влезает.

### 5.3. Заголовок колонок товаров

На узкой ленте (`width < 36` символов логики):

```javascript
{ left: "Цена x Кол", right: "Итого", bold: true }
```

Иначе: `"Цена x Кол-о - Скидка"`.

### 5.4. Строка позиции

```javascript
// 1) Название
{ text: "1) лук", bold: true }
{ text: "" }  // пустая строка-отступ
// 2) Цена
{ left: buildItemLineLeft(price, qty, lineDiscount), right: money(lineTotal), bold: true }
```

`buildItemLineLeft`:

```javascript
function buildItemLineLeft(price, qty, lineDiscountAmt) {
  const base = `${money(price)} x ${qty}`;
  if (lineDiscountAmt <= 0) return base;
  return `${base} - ${money(lineDiscountAmt)}`;
}
```

---

## 6. Сборка layout из JSON чека

Минимальный контракт payload:

```typescript
interface ReceiptPayload {
  company?: string;
  inn?: string;
  address?: string;
  doc_no?: string;
  created_at?: string;
  cashier_name?: string;
  items: Array<{
    name: string;
    qty: number;
    price?: number;
    unit_price?: number;
    line_total?: number;
    line_discount?: number;
  }>;
  discount?: number;
  paid_cash?: number;
  paid_card?: number;
  cash_received?: number;
  change?: number;
  total?: number;
  // eKassa (опционально)
  ekassa_fiscal?: { fields?: Record<string, unknown>; link?: string };
  ekassa?: { fields?: Record<string, unknown>; link?: string };
}
```

Функция `buildReceiptLayout(payload, { width })` → `{ lines, qrLink }`.

**eKassa:** если есть `ekassa_fiscal.fields` / `ekassa.fields`, итоги и позиции брать из fiscal-полей (`1020`, `1031`, `1059[]`, …), суммы в **тыйынах** / 100.

**Скидки:** `subtotal = Σ(line_total + line_discount_amount)`; order `discount` только явные скидки, не «разница каталожной и ручной цены».

---

## 7. Canvas → raster

### 7.1. Шрифт

```javascript
const RECEIPT_CANVAS_FONT =
  '"Courier New", "Menlo", "Consolas", "Liberation Mono", monospace';
```

### 7.2. Подбор baseFontSize

Не `dotsPerLine / charsPerLine` напрямую — замерьте реальную ширину символа:

```javascript
ctx.font = `400 24px ${RECEIPT_CANVAS_FONT}`;
const measuredChar = ctx.measureText("0").width;
const usable = dotsPerLine - padX * 2;
const baseFontSize = Math.floor(
  (usable / charsPerLine) * (24 / measuredChar)
);
```

Минимум ~16 px, иначе на 48 мм будет мелко.

### 7.3. Binarization

```javascript
function canvasToRasterBytes(canvas, threshold = 180) {
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h).data;
  const bytesPerLine = Math.ceil(w / 8);
  const raster = new Uint8Array(bytesPerLine * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.2126 * img[i] + 0.7152 * img[i+1] + 0.0722 * img[i+2];
      if (lum < threshold)
        raster[y * bytesPerLine + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { raster, bytesPerLine, h };
}
```

---

## 8. ESC/POS: GS v 0 (растр)

```javascript
function buildEscPosForRaster(raster, bytesPerLine, h, { withCut = true } = {}) {
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = h & 0xff;
  const yH = (h >> 8) & 0xff;

  const parts = [
    new Uint8Array([0x1b, 0x40]),           // ESC @ init
    new Uint8Array([0x1b, 0x61, 0x00]),     // align left
    new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]), // GS v 0
    raster,
  ];
  if (withCut) {
    parts.push(new Uint8Array([0x1b, 0x64, 0x01, 0x1d, 0x56, 0x00])); // feed + cut
  }
  return concatUint8Arrays(parts);
}
```

**Мод `0x00`** — normal density. Raster идёт **сразу после** 8-байтового заголовка `GS v 0`.

### 8.1. Прогрев перед **первой** печатью (обязательно)

После `openUsbDevice` / первого claim часть принтеров **теряет первые байты**. Без заголовка `GS v 0` весь bitmap печатается как текст («иероглифы»). Вторая печать — нормальная.

```javascript
async function wakeEscPosPrinter(dev, outEP) {
  const init = new Uint8Array([0x1b, 0x40]);
  await dev.transferOut(outEP, init);
  await sleep(80);
  await dev.transferOut(outEP, init);
  await sleep(40);
}
```

Вызывать **после** `openUsbDevice`, **до** отправки raster.

### 8.2. QR после растра

QR — **нативный ESC/POS** (не в bitmap):

```javascript
// store + print QR (UTF-8 URL)
// GS ( k ... 1P 0 [utf8] ... 1Q 0
```

После raster: `align center` → `buildEscPosQr(link)` → `align left` → `feed 6` → `full cut`.

В NurCRM raster печатается с `withCut: false`, cut только в tail вместе с QR.

---

## 9. WebUSB транспорт

### 9.1. Состояние

```javascript
const usbState = { dev: null, opening: null };
```

Один принтер на вкладку — **один** `usbState`. Не дублировать claim в другом модуле (конфликт → битая первая печать).

### 9.2. Открытие

1. `navigator.usb.getDevices()` по сохранённым VID/PID/serial  
2. Или `navigator.usb.requestDevice({ filters: [{ classCode: 0x07 }, { classCode: 0xff }] })`  
3. `dev.open()` → `selectConfiguration` → `claimInterface` → найти bulk **OUT**  
4. `dev.transferOut(outEP, chunk)` чанками 8–16 KB  

### 9.3. Точка входа печати

```javascript
async function printReceiptGraphicViaUSB(payload, options = {}) {
  await ensureUsbReady();
  const dev = usbState.dev ?? await requestUsbDevice();
  const { outEP } = await openUsbDevice(dev);
  await wakeEscPosPrinter(dev, outEP);

  const cfg = getRuntimeConfig(); // dotsPerLine: 384, charsPerLine: 32
  const { lines, qrLink } = buildReceiptLayout(payload, { width: cfg.charsPerLine });
  const canvas = renderLayoutToCanvas(lines, cfg);
  const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
  const body = buildEscPosForRaster(raster, bytesPerLine, h, { withCut: false });

  const tail = [feed6, fullCut];
  if (qrLink) tail.unshift(...buildEscPosQr(qrLink));

  for (const part of chunkBytes(concat(body, ...tail))) {
    await dev.transferOut(outEP, part);
  }
}
```

### 9.4. Диспетчер форматов

```javascript
async function handleCheckoutResponseForPrinting(res, options = {}) {
  const payload = unwrapPayload(res); // JSON | Blob PDF | base64

  if (payload instanceof Blob && isPdf(payload)) {
    return printPdfAsRaster(payload, options);
  }
  if (payload?.items) {
    if (options.graphic !== false) {
      return printReceiptGraphicViaUSB(payload, options);
    }
    return printReceiptTextViaUSB(payload, options); // fallback
  }
  throw new Error("Unknown receipt format");
}
```

---

## 10. Интеграция во фронт (чеклист)

### Шаг 1 — модуль печати

- [ ] Скопировать/адаптировать: `buildReceiptLayout`, `renderLayoutToCanvas`, `canvasToRasterBytes`, `buildEscPosForRaster`, `buildEscPosQr`, `wakeEscPosPrinter`, WebUSB helpers.
- [ ] Константы: `DOTS_PER_LINE = 384`, `CHARS_PER_LINE = 32`.

### Шаг 2 — настройки

- [ ] UI: ширина ленты, chars per line, тест USB (можно оставить **text**-тест с codepage).
- [ ] `localStorage`: `escpos_dpl`, `escpos_cpl`, `escpos_line`, `escpos_vid`, `escpos_pid`.

### Шаг 3 — checkout / reprint

- [ ] После оплаты: `handleCheckoutResponseForPrinting(checkoutJson, { receiptStyle: "market" })` — без `graphic: false`.
- [ ] Приоритет источника: **checkout JSON** (eKassa) → fallback `GET .../receipt/` (PDF blob).
- [ ] Не вызывать параллельно два `transferOut` на один endpoint (очередь или строго await).

### Шаг 4 — UI кассы

- [ ] Автопечать после оплаты (если не «Без чека»).
- [ ] Кнопка «Печать чека» в success-модалке → тот же pipeline.
- [ ] При ошибке формата — другой источник чека, не только reconnect USB.

### Шаг 5 — тесты

- [ ] Unit: `buildReceiptLayout` — ключевые строки, `left`/`right` на позициях.
- [ ] Unit: `canvasToRasterBytes` / размер `bytesPerLine = ceil(width/8)`.
- [ ] Unit: `buildEscPosForRaster` — первые байты `[0x1b,0x40,...]`.
- [ ] Manual: **первая** печать после F5 / новой вкладки (wake-up).
- [ ] Manual: длинное название товара + скидка + «Итого» справа.

---

## 11. Типичные ошибки (из NurCRM)

| Симптом | Причина | Решение |
|---|---|---|
| Вся лента «иероглифы» / `@ï3A=…` | Потерян заголовок `GS v 0`, bitmap как text | `wakeEscPosPrinter` перед raster |
| Только **первая** печать битая | Холодный USB claim | Wake-up + не claim USB в двух модулях |
| Чек мелкий, поля по бокам | `dotsPerLine=576` на 48 мм | `384` + `charsPerLine=32` |
| «Итого» / цена не влезает | `lr()` по символам + `scale:1.15` | `{ left, right }` + pixel layout |
| Кириллица OK в sell, битая в market | Text vs graphic | Graphic не использует `escpos_cp` для тела |
| PDF fallback битый | Тот же raster path | Wake-up и для PDF→canvas |

---

## 12. Fallback на text

```javascript
await handleCheckoutResponseForPrinting(payload, {
  receiptStyle: "market",
  graphic: false,  // text + escpos_cp (17/66/73)
});
```

Использовать если принтер не поддерживает bitmap или graphic нестабилен.

---

## 13. Минимальный пример (псевдокод)

```javascript
// 1. Layout
const { lines, qrLink } = buildReceiptLayout({
  company: "NBS",
  doc_no: "43",
  created_at: "2026-08-27 21:21:31",
  cashier_name: "market@nur.kg",
  items: [
    { name: "лук", qty: 1, price: 40, line_total: 40 },
    { name: "икра", qty: 5, price: 75, line_total: 375 },
  ],
  paid_card: 415,
  total: 415,
});

// 2. Render
const cfg = { dotsPerLine: 384, charsPerLine: 32, lineDotHeight: 26 };
const canvas = renderLayoutToCanvas(lines, cfg);

// 3. ESC/POS
const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
const escpos = buildEscPosForRaster(raster, bytesPerLine, h, { withCut: false });

// 4. USB
await wakeEscPosPrinter(dev, outEP);
await dev.transferOut(outEP, escpos);
if (qrLink) for (const p of buildEscPosQr(qrLink)) await dev.transferOut(outEP, p);
await dev.transferOut(outEP, new Uint8Array([0x1b, 0x64, 0x06, 0x1d, 0x56, 0x00]));
```

---

## 14. Что копировать из NurCRM

| Файл | Что взять |
|---|---|
| `src/Components/pages/Sell/services/printService.js` | `buildMarketReceiptLayout`, `renderReceiptLayoutToCanvas`, `canvasToRasterBytes`, `buildEscPosForRaster`, `buildEscPosQr`, `wakeEscPosPrinter`, `printReceiptJSONGraphicViaUSB`, WebUSB |
| `src/Components/pages/Sell/services/printService.test.js` | Тесты layout / canvas width |
| `src/Components/pages/Info/Settings/PosPrintSettings.jsx` | UI `escpos_*`, пресет 58/48 мм |

Не копировать из NurCRM: `printer-bridge`, `OrdersPrintService` (кафе), `fiscalDriverService` — другой стек.

---

## 15. Связанные документы NurCRM

- [receipt-printing.md](./receipt-printing.md) — карта печати маркета внутри NurCRM  
- [receipt-price-edit-discount.md](./receipt-price-edit-discount.md) — контракт `discount` в JSON чека  

---

## 16. Краткий cheat-sheet для агента

```
graphic default: receiptStyle "market" + graphic !== false
width: 384 dots = 48 mm print, 32 chars layout
layout rows: { text, align, bold, scale } | { left, right, bold }
pipeline: layout → canvas → raster → GS v 0 → [QR] → cut
before first raster: wakeEscPosPrinter (ESC @ x2)
never parallel transferOut on same bulk OUT
fallback: graphic: false + escpos_cp 17/66/73
```
