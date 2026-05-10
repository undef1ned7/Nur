# Table Label Debug Dump (Cafe Printing)

Ниже собран полный технический дамп по вашему запросу: только код и места использования, без предложений по исправлению.

---

## 1) `src/Components/Sectors/cafe/Orders/OrdersPrintService.js`

### Что есть по table label / tablesMap / lock keys

- Функций резолва стола (`getOrderTableLabel` / `resolveTableLabel` / `normalizeTableLabel`) в этом файле нет.
- Чтения `order.table` / `table_id` / `tableId` / `table?.id` нет.
- `tablesMap` нет.
- Lock/dedupe ключей `cafe_kitchen_print_lock_*`, `cafe_receipt_print_lock_*`, `cafe_kitchen_printed_*`, `cafe_receipt_printed_*` нет.

### Где используется `doc_no`

```js
function buildPrettyReceiptFromJSON(payload) {
  const width = PRINT_WIDTH;
  const line = "-".repeat(width);
  const enc = getEncoder(CODEPAGE);

  const company = payload.company ?? "КАССА";
  const docNo = payload.doc_no ?? "";
  const dt = payload.created_at ?? "";
  const cashier = payload.cashier_name ?? "";
  const waiter = String(payload.waiter_name ?? "").trim();

  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.price || 0),
    0
  );

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40));
  chunks.push(ESC(0x1b, 0x52, 0x07));
  chunks.push(ESC(0x1b, 0x74, CODEPAGE));

  chunks.push(ESC(0x1b, 0x61, 0x01));
  chunks.push(enc(company + "\n"));
  if (docNo) chunks.push(enc(`ЧЕК: ${docNo}\n`));

  chunks.push(ESC(0x1b, 0x61, 0x00));
  chunks.push(enc(line + "\n"));

  if (dt) chunks.push(enc(`Дата: ${dt}\n`));
  if (cashier) chunks.push(enc(`Кассир: ${cashier}\n`));
  if (waiter) chunks.push(enc(`Официант: ${waiter}\n`));
  chunks.push(enc("\n"));

  if ('menu_title' in payload) {
    const name = String(payload.menu_title ?? "").trim() || "Позиция";
    chunks.push(enc(name + "\n"));
  }

  for (const it of items) {
    const name = String(it.name ?? "").trim() || "Позиция";
    const qty = Math.max(1, Number(it.qty || 0));
    const price = Number(it.price || 0);
    const sum = qty * price;
    const comment = String(it.comment ?? "").trim();

    chunks.push(enc(name + "\n"));
    if (comment) {
      chunks.push(enc(`Комментарий: ${comment}\n`));
    }
    chunks.push(enc(`${qty} x ${money(price)} = ${money(sum)}\n`));
    chunks.push(enc("\n"));
  }

  chunks.push(enc(line + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x01));
  chunks.push(enc(lrSafe("ИТОГО:", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00));

  chunks.push(ESC(0x1b, 0x64, 0x06));
  chunks.push(ESC(0x1d, 0x56, 0x00));

  return chunks;
}
```

---

## 2) `src/Components/Sectors/cafe/Orders/Orders.jsx`

### `normalizeTableLabel` (полное тело)

```js
const normalizeTableLabel = (raw) => {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim();
  if (!v) return "";
  const low = v.toLowerCase();
  if (v === "?" || low === "null" || low === "undefined") return "";
  if (UUID_RE.test(v)) return "";
  return v;
};
```

### Lock keys и lock-функции (полные тела)

```js
const kitchenPrintLockKey = (orderId) => `cafe_kitchen_print_lock_${orderId}`;

const RECEIPT_PRINT_LOCK_TTL_MS = 30 * 1000;

const receiptPrintLockKey = (orderId) => `cafe_receipt_print_lock_${orderId}`;

const readKitchenPrintLock = (orderId) => {
  try {
    const raw = localStorage.getItem(kitchenPrintLockKey(orderId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - Number(data.ts) > KITCHEN_PRINT_LOCK_TTL_MS) {
      localStorage.removeItem(kitchenPrintLockKey(orderId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const acquireKitchenPrintLock = (orderId) => {
  try {
    if (readKitchenPrintLock(orderId)) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { token, ts: Date.now() };
    localStorage.setItem(kitchenPrintLockKey(orderId), JSON.stringify(payload));
    const confirmed = readKitchenPrintLock(orderId);
    return confirmed?.token === token;
  } catch {
    return true;
  }
};

const releaseKitchenPrintLock = (orderId) => {
  try {
    localStorage.removeItem(kitchenPrintLockKey(orderId));
  } catch { }
};

const readReceiptPrintLock = (orderId) => {
  try {
    const raw = localStorage.getItem(receiptPrintLockKey(orderId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - Number(data.ts) > RECEIPT_PRINT_LOCK_TTL_MS) {
      localStorage.removeItem(receiptPrintLockKey(orderId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const acquireReceiptPrintLock = (orderId) => {
  try {
    if (readReceiptPrintLock(orderId)) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { token, ts: Date.now() };
    localStorage.setItem(receiptPrintLockKey(orderId), JSON.stringify(payload));
    const confirmed = readReceiptPrintLock(orderId);
    return confirmed?.token === token;
  } catch {
    return true;
  }
};

const releaseReceiptPrintLock = (orderId) => {
  try {
    localStorage.removeItem(receiptPrintLockKey(orderId));
  } catch { }
};
```

### `tablesMap`: init/update и потенциальная пустота

```js
const [tables, setTables] = useState([]);
```

```js
const fetchTables = async () => setTables(listFrom(await api.get("/cafe/tables/")));
```

```js
useEffect(() => {
  (async () => {
    try {
      await fetchTables();
      setForm(prev => ({ ...prev, table: '' }))
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка загрузки");
      alert(errorMessage, true);
    }
  })();
}, [socketOrders?.orders])
```

```js
const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
```

### `getOrderTableLabel` (полное тело)

```js
const getOrderTableLabel = useCallback(
  (order) => {
    // Если стол не выбран — считаем заказ "С собой"
    if (order?.table === null || order?.table === undefined || order?.table === "") {
      return TAKEAWAY_LABEL;
    }
    const t = tablesMap.get(order?.table);
    const direct = normalizeTableLabel(
      t?.title ||
      t?.name ||
      t?.label ||
      t?.table_name ||
      t?.table_label ||
      t?.table_title ||
      ""
    );
    if (direct) return direct;
    if (t?.number != null && t?.number !== "") return String(t.number);
    const fallback = normalizeTableLabel(
      order?.table_name || order?.table_label || order?.table_title || order?.table_number
    );
    if (fallback) return fallback;
    const raw = normalizeTableLabel(order?.table);
    return raw || TAKEAWAY_LABEL;
  },
  [tablesMap]
);
```

### `buildPrintPayload` (полное тело, включая `doc_no`)

```js
const buildPrintPayload = useCallback(
  (order) => {
    const tableLabel = getOrderTableLabel(order);
    const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
    const cashier = fullName(userData || {});
    const items = Array.isArray(order?.items) ? order.items : [];

    const isTakeaway = tableLabel === TAKEAWAY_LABEL;
    return {
      company: localStorage.getItem("company_name") || "КАССА",
      doc_no: isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`,
      created_at: dt,
      cashier_name: cashier,
      waiter_name: pickCafeOrderWaiterName(order, waiterIdLabelMap),
      discount: 0,
      tax: 0,
      paid_cash: 0,
      paid_card: 0,
      change: 0,
      items: items.map((it) => ({
        name: orderItemTitle(it),
        qty: Math.max(1, Number(it.quantity) || 1),
        price: linePrice(it),
        comment: String(it.comment || "").trim(),
      })),
    };
  },
  [getOrderTableLabel, userData, waiterIdLabelMap]
);
```

### `buildKitchenTicketPayload` (полное тело, включая `doc_no`)

```js
const buildKitchenTicketPayload = useCallback(
  ({ order, kitchenId, kitchenLabel, items }, label = 'КАССАА') => {
    const tableLabel = getOrderTableLabel(order);
    const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
    const cashier = fullName(userData || {});
    const isTakeaway = tableLabel === TAKEAWAY_LABEL;

    return {
      company: localStorage.getItem("company_name") || label,
      doc_no: isTakeaway
        ? `${kitchenLabel || "КУХНЯ"} • ${TAKEAWAY_LABEL}`
        : `${kitchenLabel || "КУХНЯ"} • СТОЛ ${tableLabel}`,
      created_at: dt,
      cashier_name: cashier,
      waiter_name: pickCafeOrderWaiterName(order, waiterIdLabelMap),
      discount: 0,
      tax: 0,
      paid_cash: 0,
      paid_card: 0,
      change: 0,
      kitchen_id: kitchenId,
      items: (items || []).map((it) => ({
        name: orderItemTitle(it),
        qty: Math.max(1, Number(it.quantity) || 1),
        comment: String(it.comment || "").trim(),
        // price: linePrice(it),
      })),
    };
  },
  [getOrderTableLabel, userData, waiterIdLabelMap]
);
```

### Где проверяются/ставятся `cafe_kitchen_printed_*`, `cafe_receipt_printed_*`

```js
if (localStorage.getItem(`cafe_kitchen_printed_${createdOrderId}`)) return;
```

```js
localStorage.setItem(`cafe_kitchen_printed_${createdOrderId}`, "true");
```

```js
localStorage.setItem(`cafe_receipt_printed_${order.id}`, "true");
```

---

## 3) `src/Components/Sectors/cafe/CafeLayout.jsx`

### `tables` source + `tablesMap` init

```js
const { orders, tables } = useCafeWebSocketManager();
```

```js
const tablesMap = useMemo(() => {
  const m = new Map();
  const list = Array.isArray(tables)
    ? tables
    : Array.isArray(tables?.tables)
      ? tables.tables
      : Array.isArray(tables?.results)
        ? tables.results
        : Array.isArray(tables?.data?.results)
          ? tables.data.results
          : [];

  list.forEach((t) => {
    if (t?.id === null || t?.id === undefined || t?.id === "") return;
    m.set(String(t.id), t);
  });
  return m;
}, [tables]);
```

### `normalizeTableLabel` (полное тело)

```js
const normalizeTableLabel = useCallback((raw) => {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim();
  if (!v) return "";
  const low = v.toLowerCase();
  if (v === "?" || low === "null" || low === "undefined") return "";
  if (UUID_RE.test(v)) return "";
  return v;
}, []);
```

### `resolveTableLabelFromOrder` (полное тело)

```js
const resolveTableLabelFromOrder = useCallback(
  (order) => {
    const tableId =
      order?.table_id ?? order?.tableId ?? order?.table?.id ?? order?.table;

    const hasTable = !(
      tableId === null ||
      tableId === undefined ||
      tableId === ""
    );
    if (!hasTable) return TAKEAWAY_LABEL;

    const t = tablesMap.get(String(tableId));
    const direct = normalizeTableLabel(
      t?.title ||
        t?.name ||
        t?.label ||
        t?.table_name ||
        t?.table_label ||
        t?.table_title ||
        "",
    );
    if (direct) return direct;
    if (t?.number !== null && t?.number !== undefined && t?.number !== "")
      return String(t.number);

    const fallback = normalizeTableLabel(
      order?.table_name ||
        order?.table_label ||
        order?.table_title ||
        order?.table_number,
    );
    if (fallback) return fallback;

    const raw = normalizeTableLabel(tableId);
    return raw || "—";
  },
  [TAKEAWAY_LABEL, normalizeTableLabel, tablesMap],
);
```

### `buildReceiptPayload` (полное тело, включая `doc_no`)

```js
const buildReceiptPayload = useCallback(
  (orderDetail) => {
    const dt = formatReceiptDate(
      orderDetail?.created_at || orderDetail?.date || orderDetail?.created,
    );
    const tableLabel = resolveTableLabelFromOrder(orderDetail);
    const items = Array.isArray(orderDetail?.items) ? orderDetail.items : [];
    const isTakeaway = tableLabel === TAKEAWAY_LABEL;

    return {
      company: localStorage.getItem("company_name") || "КАССА",
      doc_no: isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`,
      created_at: dt,
      cashier_name: fullName(profile || {}),
      waiter_name: pickCafeOrderWaiterName(orderDetail),
      discount: 0,
      tax: 0,
      paid_cash: 0,
      paid_card: 0,
      change: 0,
      items: items.map((it) => ({
        name: String(it.menu_item_title || it.title || "Позиция"),
        qty: Math.max(1, Number(it.quantity) || 1),
        price: linePrice(it),
      })),
    };
  },
  [
    formatReceiptDate,
    linePrice,
    fullName,
    profile,
    resolveTableLabelFromOrder,
    TAKEAWAY_LABEL,
  ],
);
```

### Kitchen auto print: `doc_no` templates (полные строки)

```js
const kitchenDocNo =
  tableLabel === TAKEAWAY_LABEL ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`;

const payload = {
  company: localStorage.getItem("company_name") || "КУХНЯ",
  doc_no: `${label} • ${kitchenDocNo}`,
  created_at: dt,
  cashier_name: cashier,
  waiter_name: kitchenWaiterName,
  discount: 0,
  tax: 0,
  paid_cash: 0,
  paid_card: 0,
  change: 0,
  kitchen_id: Number(kid) || kid,
  items: (kitItems || []).map((it) => ({
    name: String(it.menu_item_title || it.title || "Позиция"),
    qty: Math.max(1, Number(it.quantity) || 1),
    comment: String(it.comment || "").trim(),
  })),
};
```

### Kitchen diff print: `doc_no` template (полная строка)

```js
const diffDocNo =
  tableLabel === TAKEAWAY_LABEL ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`;
const slipsSectionLabel = isCancelled ? "ОТМЕНА" : "ИЗМЕНЕНИЕ";

const payload = {
  company: localStorage.getItem("company_name") || "КУХНЯ",
  doc_no: `${label} | ${diffDocNo} | ${slipsSectionLabel}`,
  created_at: dt,
  cashier_name: cashier,
  waiter_name: diffKitchenWaiterName,
  discount: 0,
  tax: 0,
  paid_cash: 0,
  paid_card: 0,
  change: 0,
  kitchen_id: Number(kid) || kid,
  menu_title: menuTitle,
  items: (items || []).map((it) => ({
    name: String(it.name || "Позиция"),
    qty: Math.max(1, Number(it.qty) || 1),
  })),
};
```

### Lock keys и lock-функции (полные тела)

```js
const kitchenPrintLockKey = (orderId) => `cafe_kitchen_print_lock_${orderId}`;
const receiptPrintLockKey = (orderId) => `cafe_receipt_print_lock_${orderId}`;

const readKitchenPrintLock = (orderId) => {
  try {
    const raw = localStorage.getItem(kitchenPrintLockKey(orderId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - Number(data.ts) > KITCHEN_PRINT_LOCK_TTL_MS) {
      localStorage.removeItem(kitchenPrintLockKey(orderId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const acquireKitchenPrintLock = (orderId) => {
  try {
    if (readKitchenPrintLock(orderId)) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { token, ts: Date.now() };
    localStorage.setItem(
      kitchenPrintLockKey(orderId),
      JSON.stringify(payload),
    );
    const confirmed = readKitchenPrintLock(orderId);
    return confirmed?.token === token;
  } catch {
    return true;
  }
};

const releaseKitchenPrintLock = (orderId) => {
  try {
    localStorage.removeItem(kitchenPrintLockKey(orderId));
  } catch {}
};

const readReceiptPrintLock = (orderId) => {
  try {
    const raw = localStorage.getItem(receiptPrintLockKey(orderId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - Number(data.ts) > RECEIPT_PRINT_LOCK_TTL_MS) {
      localStorage.removeItem(receiptPrintLockKey(orderId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const acquireReceiptPrintLock = (orderId) => {
  try {
    if (readReceiptPrintLock(orderId)) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { token, ts: Date.now() };
    localStorage.setItem(
      receiptPrintLockKey(orderId),
      JSON.stringify(payload),
    );
    const confirmed = readReceiptPrintLock(orderId);
    return confirmed?.token === token;
  } catch {
    return true;
  }
};

const releaseReceiptPrintLock = (orderId) => {
  try {
    localStorage.removeItem(receiptPrintLockKey(orderId));
  } catch {}
};
```

### Где проверяются/ставятся `cafe_kitchen_printed_*`, `cafe_receipt_printed_*`

```js
const alreadyPrinted = localStorage.getItem(
  `cafe_receipt_printed_${oid}`,
);
if (alreadyPrinted) return;
```

```js
localStorage.setItem(`cafe_receipt_printed_${oid}`, "true");
```

```js
if (localStorage.getItem(`cafe_kitchen_printed_${oid}`)) return;
```

```js
localStorage.setItem(`cafe_kitchen_printed_${oid}`, "true");
```

### Дополнительный dedupe ключ в `sessionStorage`

```js
const tryConsumeWsOrderCreatedKitchenDedupe = (orderId) => {
  const oid = String(orderId || "");
  if (!oid) return false;
  try {
    const k = `cafe_ws_order_created_kitchen_${oid}`;
    const prev = sessionStorage.getItem(k);
    const now = Date.now();
    if (prev && now - Number(prev) < 30_000) return false;
    sessionStorage.setItem(k, String(now));
    return true;
  } catch {
    return true;
  }
};
```

---

## 4) `src/Components/Sectors/cafe/Orders/CafeOrdersHistory.jsx`

### `tables` и `tablesMap`: init/update

```js
const [tables, setTables] = useState([]);
```

```js
const fetchTables = async () => setTables(listFrom(await api.get("/cafe/tables/")));
```

```js
await Promise.all([fetchTables(), fetchEmployees(), fetchMenu()]);
```

```js
const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
```

### `buildPrintPayload` (полное тело, включая `doc_no`)

```js
const buildPrintPayload = useCallback(
  (order) => {
    const t = tablesMap.get(order?.table);
    const tableLabel =
      order?.table === null || order?.table === undefined || order?.table === ""
        ? "С собой"
        : t?.number || "—";

    const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
    const cashier = fullName(userData || {});
    const items = Array.isArray(order?.items) ? order.items : [];
    const isTakeaway = tableLabel === "С собой";

    return {
      company: localStorage.getItem("company_name") || "КАССА",
      doc_no: isTakeaway ? "С собой" : `СТОЛ ${tableLabel}`,
      created_at: dt,
      cashier_name: cashier,
      waiter_name: pickCafeOrderWaiterName(order, waiterIdLabelMap),
      discount: 0,
      tax: 0,
      paid_cash: 0,
      paid_card: 0,
      change: 0,
      items: items.map((it) => ({
        name: orderItemTitle(it),
        qty: it.is_rejected
          ? Math.max(1, Number(it.quantity) || 1)
          : Math.max(0, itemNetQty(it)),
        price: linePrice(it),
      })),
    };
  },
  [formatReceiptDate, linePrice, tablesMap, userData, waiterIdLabelMap]
);
```

### Где ставится `cafe_receipt_printed_*`

```js
localStorage.setItem(`cafe_receipt_printed_${order.id}`, "true");
```

### Что отсутствует

- `normalizeTableLabel` в этом файле отсутствует.
- `getOrderTableLabel` / `resolveTableLabel...` отсутствуют.
- Lock-функции `cafe_kitchen_print_lock_*` / `cafe_receipt_print_lock_*` отсутствуют.
- `cafe_kitchen_printed_*` в этом файле отсутствует.

---

## 5) Проверка `src/Components/Sectors/cafe/utils/` и shared helper exports

- Папка `src/Components/Sectors/cafe/utils/` в проекте не найдена.
- Экспортов `resolveCafeTableLabel` не найдено.
- Общего экспортируемого helper для table label resolution не найдено.
- Найден локальный резолвер: `resolveTableLabelFromOrder` в `CafeLayout.jsx` (не экспортируется как shared helper).

---

## 6) Источник `tables` в auto-print (WebSocket manager)

`src/hooks/useCafeWebSocket.js`

### Инициализация/обновление tables

```js
const [tables, setTables] = useState([]);
```

```js
const fetchTables = useCallback(async () => {
  try {
    const { data } = await api.get(`/cafe/tables/`);
    setTables(data.results || data);
    return data;
  } catch (error) {
    logger(console.error, ('❌ Ошибка загрузки столов:', error));
  }
}, []);
```

```js
case 'table_status_changed': {
  const tableData = message.data;
  const tableId = tableData.table_id || tableData.table?.id;
  // ...
  setTables(prev => {
    const tableIndex = prev.findIndex(table => table.id === tableId);
    if (tableIndex !== -1) {
      const updatedTables = [...prev];
      updatedTables[tableIndex] = {
        ...updatedTables[tableIndex],
        status: tableData.status,
        status_display: tableData.status_display || tableData.status,
        updated_at: new Date().toISOString()
      };
      return updatedTables;
    }
    return [...prev, {
      id: tableId,
      number: tableData.table_number || tableData.table?.number || 0,
      status: tableData.status,
      status_display: tableData.status_display || tableData.status,
      places: tableData.table?.places || 4,
      created_at: new Date().toISOString()
    }];
  });
  break;
}
```

### Возврат manager-структуры

```js
return {
  allConnected,
  connectAll,
  disconnectAll,
  pingAll,
  fetchAllData,
  orders: ordersWs,
  tables: tablesWs,
};
```

---

## 7) Короткая карта `doc_no` template-строк (все найденные)

- `Orders.jsx`:
  - ``doc_no: isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}``  
  - ``doc_no: isTakeaway ? `${kitchenLabel || "КУХНЯ"} • ${TAKEAWAY_LABEL}` : `${kitchenLabel || "КУХНЯ"} • СТОЛ ${tableLabel}``  
- `CafeLayout.jsx`:
  - ``doc_no: isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}``  
  - ``doc_no: `${label} • ${kitchenDocNo}```  
  - ``doc_no: `${label} | ${diffDocNo} | ${slipsSectionLabel}```  
- `CafeOrdersHistory.jsx`:
  - ``doc_no: isTakeaway ? "С собой" : `СТОЛ ${tableLabel}```  
- `OrdersPrintService.js`:
  - ``if (docNo) chunks.push(enc(`ЧЕК: ${docNo}\n`));``  

---

All relevant code collected.
# Печать в кафе: полный технический разбор (чек, кухня, diff, история)

## Что именно анализировалось

Цель: понять, почему в печати иногда не показывается корректный стол, и почему может печататься строка вида `Раздача №2 Стол ?`.

Проверены все точки:

- где формируется payload для печати;
- где строится `doc_no` (там находится стол);
- откуда запускается печать (ручная/авто/история);
- как работают lock/dedupe/retry;
- какие поля заказа участвуют в определении стола.

---

## Главный вывод

Проблема не в ESC/POS-шаблоне и не в принтере.  
Проблема в том, **какой `doc_no` собирается до отправки в `OrdersPrintService`**.

`OrdersPrintService` печатает буквально то, что передали:

- `doc_no` есть -> печатается `ЧЕК: ${doc_no}`;
- `doc_no` содержит плохой label -> на бумаге будет плохой label.

---

## Карта всех мест печати

## 1) Низкий уровень (физическая печать)

- `src/Components/Sectors/cafe/Orders/OrdersPrintService.js`
  - `buildPrettyReceiptFromJSON(payload)` — собирает текст чека.
  - `printOrderReceiptJSONViaUSB(payload)` — печать на USB.
  - `printViaWiFiSimple(payload, ip, port)` — печать по сети.

Критично: здесь нет бизнес-решения про стол, тут только рендер `payload.doc_no`.

## 2) Ручная печать из экрана заказов

- `src/Components/Sectors/cafe/Orders/Orders.jsx`
  - `printOrder(order)` -> берет detail `/cafe/orders/:id/` -> `buildPrintPayload(sourceOrder)`.
  - `buildPrintPayload` задает `doc_no`:
    - `С собой`, если takeaway;
    - иначе `СТОЛ ${tableLabel}`.

## 3) Автопечать кухни после создания заказа

- `src/Components/Sectors/cafe/Orders/Orders.jsx`
  - `autoPrintKitchenTickets(createdOrderId)` -> detail заказа -> группировка по кухням -> печать по принтерам кухни.
  - `buildKitchenTicketPayload` задает `doc_no`:
    - `${kitchenLabel} • С собой`
    - или `${kitchenLabel} • СТОЛ ${tableLabel}`.

Пример формата: `Раздача №2 • СТОЛ 7`.

## 4) Авточек после оплаты (глобальный поток)

- `src/Components/Sectors/cafe/CafeLayout.jsx`
  - Слушает WS `order_updated`.
  - Если статус paid -> `printReceiptForOrder(orderId)`.
  - Берет detail заказа, строит payload в `buildReceiptPayload`.
  - `doc_no`:
    - `С собой`
    - или `СТОЛ ${tableLabel}`.

## 5) Автопечать кухни из глобального потока

- `src/Components/Sectors/cafe/CafeLayout.jsx`
  - WS `order_created` -> `printKitchenTicketsForOrder(orderId)`.
  - Fallback poll `/cafe/orders/` каждые 15 секунд -> печать, если WS событие пропущено.
  - `doc_no` в кухонном чеке:
    - `${kitchenLabel} • ${kitchenDocNo}`,
    - где `kitchenDocNo` это `С собой` или `СТОЛ ${tableLabel}`.

Пример: `Раздача №2 • СТОЛ 7`.

## 6) Авто diff-печать кухни при изменении заказа

- `src/Components/Sectors/cafe/CafeLayout.jsx`
  - WS `order_updated` для неоплаченных заказов -> `printKitchenDiffTicketsForOrder(orderId)`.
  - Печатает отдельные слипы `ДОБАВИТЬ/УБРАТЬ`.
  - `doc_no`: `${kitchenLabel} | ${diffDocNo} | ${ОТМЕНА/ИЗМЕНЕНИЕ}`.

Пример: `Раздача №2 | СТОЛ 7 | ИЗМЕНЕНИЕ`.

## 7) Повторная печать из истории

- `src/Components/Sectors/cafe/Orders/CafeOrdersHistory.jsx`
  - `printOrder(order)` -> `buildPrintPayload(order)` -> печать.
  - `doc_no`: `С собой` или `СТОЛ ${tableLabel}`.
  - Здесь table fallback упрощенный.

---

## Как именно определяется стол

## A) `Orders.jsx` (`getOrderTableLabel`)

Логика:

1. Если `order.table` пуст -> `С собой`.
2. Ищет стол в `tablesMap` по `order.table`.
3. Берет `title/name/label/table_name/table_label/table_title`.
4. Если нет строкового имени -> берет `t.number`.
5. Иначе fallback из заказа: `table_name/table_label/table_title/table_number`.
6. Иначе raw `order.table`.
7. Иначе `С собой`.

Ограничение: ориентируется в первую очередь на `order.table` (а не полноценно на `table_id/tableId/table.id`).

## B) `CafeLayout.jsx` (`resolveTableLabelFromOrder`)

Логика шире и стабильнее:

1. Берет `tableId` из `table_id || tableId || table?.id || table`.
2. Если tableId пуст -> `С собой`.
3. Пытается резолвить из `tablesMap`.
4. Если не нашел -> fallback из `table_name/table_label/table_title/table_number`.
5. Если и там пусто -> raw tableId.
6. Если raw невалиден -> `—`.

## C) `CafeOrdersHistory.jsx` (`buildPrintPayload`)

Упрощенно:

1. Если `order.table` пуст -> `С собой`.
2. Иначе берет из `tablesMap` в основном `t?.number`.
3. Если `number` пуст -> `—`.

Это самый слабый резолвер из трех.

---

## Почему печатается `Раздача №2 Стол ?`

Разбор по частям:

- `Раздача №2` — это `kitchenLabel` (название/номер кухни), формируется отдельно.
- `Стол ?` — это table часть, сформированная из `tableLabel`.

Когда table label приходит/резолвится как `?`, этот символ уходил в `doc_no`.

Текущее состояние после правки:

- в `Orders.jsx` и `CafeLayout.jsx` невалидные значения `?`, `null`, `undefined` отфильтровываются в `normalizeTableLabel`;
- такие значения больше не печатаются как стол в этих ветках.

Важная деталь: это уменьшает симптом, но не устраняет системную причину расхождения логики между модулями.

---

## От чего зависит, покажется ли номер стола

Зависимость идет от сочетания факторов:

1. **Источник печати**
   - ручная печать (`Orders`);
   - автопечать чеков (`CafeLayout`);
   - автопечать кухни (`Orders`/`CafeLayout`);
   - печать из истории.
2. **Форма данных заказа**
   - поле может быть в `table`, `table_id`, `tableId`, `table.id`;
   - не все ветки одинаково это учитывают.
3. **Готовность `tablesMap`**
   - при ранней автопечати карта столов может быть неактуальна;
   - label не резолвится, идет fallback.
4. **Качество fallback-полей**
   - `table_name`, `table_label`, `table_title`, `table_number` могут быть пустыми.
5. **Особая ветка history**
   - если у стола нет `number`, часто получается `СТОЛ —`.

---

## Lock, dedupe, retry: как это влияет на наблюдаемое поведение

Есть механизмы защиты от дублей, которые могут маскировать "плавающую" проблему:

- `cafe_kitchen_print_lock_<orderId>`
- `cafe_receipt_print_lock_<orderId>`
- `cafe_kitchen_printed_<orderId>`
- `cafe_receipt_printed_<orderId>`
- `cafe_kitchen_cancel_printed_<orderId>`
- WS dedupe ключи для `order_created` (в `CafeLayout`).

Что это дает:

- один и тот же заказ не печатается бесконечно;
- но если **первый** payload был с плохим label стола, именно он может стать "единственным" распечатанным вариантом.

---

## Где именно расхождение по качеству (risk map)

Критичность по веткам:

1. `CafeOrdersHistory.jsx` — высокий риск `СТОЛ —` из-за `t?.number` only.
2. `Orders.jsx` — средний риск при кейсе, когда стол приходит не в `order.table`.
3. `CafeLayout.jsx` — наиболее устойчивый резолвер, но все еще зависит от доступности `tablesMap` и fallback-полей.

---

## Сценарии воспроизведения

## Сценарий 1: `Стол ?` в кухонном чеке

1. В заказ попадает `table` с мусорным значением `?`.
2. Печать кухни срабатывает до корректировки данных.
3. В `doc_no` попадает `СТОЛ ?`.

После фильтра в двух модулях вероятность снижена.

## Сценарий 2: `С собой` вместо стола

1. В detail есть `table_id`, но нет ожидаемого `table`.
2. Ветка, которая читает только `order.table`, классифицирует как takeaway.
3. Печать дает `С собой`.

## Сценарий 3: `СТОЛ —` из истории

1. У стола нет заполненного `number`, есть только `name/title`.
2. History ветка смотрит в основном на `t?.number`.
3. Печать из истории дает `СТОЛ —`.

---

## Что принять как решение (предложение)

## Решение 1 (рекомендуется): унификация резолвера стола

Сделать единый helper, например `resolveCafeTableLabel(order, tablesMap, takeawayLabel)`, и использовать в:

- `Orders.jsx`
- `CafeLayout.jsx`
- `CafeOrdersHistory.jsx`

Единый порядок:

1. `table_id || tableId || table?.id || table`
2. `tablesMap` -> `title/name/label/...` -> `number`
3. fallback `table_name/table_label/table_title/table_number`
4. очистка мусора (`?`, `null`, `undefined`, UUID)
5. если table реально отсутствует -> `С собой`
6. если table присутствует, но label не резолвится -> `—` (или иной единый дефолт)

## Решение 2: выровнять политику fallback

Продуктово выбрать один стиль:

- либо всегда `С собой` при любом нераспознанном столе;
- либо `СТОЛ —` для "стол есть, но label не найден".

Главное — одинаково во всех экранах.

## Решение 3: стабилизировать автопечать при раннем событии

В автопечати добавить короткий retry, если:

- table id есть;
- `tablesMap` не содержит стол;
- fallback-поля пустые.

Это сократит печать с временным плохим label.

---

## Минимальный практический план внедрения

1. Вынести общий helper в `src/Components/Sectors/cafe/utils/` (или общий `helpers` модуля).
2. Подключить helper во все три места (`Orders`, `CafeLayout`, `History`).
3. Убрать локальные "частные" реализации резолва стола.
4. Добавить 6-8 unit-тестов на helper (table id, takeaway, uuid, `?`, only `table_id`, only `table_name`, history edge case).
5. Прогнать ручные кейсы:
   - ручная печать;
   - автопечать после оплаты;
   - автопечать кухни;
   - diff печать;
   - повторная печать из истории.

---

## Итог для текущего инцидента

- `Раздача №2` — корректная часть (кухня).
- Проблемный фрагмент — table label внутри `doc_no`.
- Симптом `Стол ?` вызван невалидным table label в данных/резолвере.
- Частичная защита уже внесена (`?`/`null`/`undefined` фильтруются в `Orders` и `CafeLayout`).
- Для полного устранения "иногда показывает / иногда нет" нужно унифицировать резолвер стола во всех сценариях печати.
