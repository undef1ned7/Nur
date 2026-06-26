# Дата документа склада — требования к API (для бэкенда)

Документ описывает поддержку **пользовательской даты документа** в модуле склада (`warehouse`).  
Фронт: `src/Components/Sectors/Warehouse/Documents/CreateSaleDocument.jsx`, список — `Documents.jsx`.

---

## 1. Проблема

На форме создания/редактирования складского документа есть выбор даты (календарь в шапке). Сейчас:

| Этап | Поведение |
|------|-----------|
| UI | Дата выбирается, хранится в `documentDateValue` (`YYYY-MM-DD`) |
| Загрузка черновика | Дата читается из ответа API: `doc.date`, иначе `doc.created_at` |
| **Сохранение (POST/PUT)** | Поле `date` **не отправляется** в теле запроса |
| Список документов | Показывается `doc.date \|\| doc.created_at` |
| Печать (PDF/XML) | Используется `doc.date` из ответа после сохранения; если нет — fallback на выбранную в форме дату |

**Итог:** пользователь может указать дату в интерфейсе, но она не попадает в БД. После сохранения в списке и при повторном открытии отображается дата сервера (`created_at`), а не выбранная.

После реализации на бэкенде фронт начнёт передавать `date` в payload при создании и обновлении.

---

## 2. Затронутые типы документов

Все типы, создаваемые через `CreateSaleDocument.jsx`:

| `doc_type` | Эндпоинт создания |
|------------|-------------------|
| `SALE` | `POST /api/warehouse/documents/sale/` |
| `PURCHASE` | `POST /api/warehouse/documents/purchase/` |
| `SALE_RETURN` | `POST /api/warehouse/documents/sale-return/` |
| `PURCHASE_RETURN` | `POST /api/warehouse/documents/purchase-return/` |
| `INVENTORY` | `POST /api/warehouse/documents/inventory/` |
| `RECEIPT` | `POST /api/warehouse/documents/receipt/` |
| `WRITE_OFF` | `POST /api/warehouse/documents/write-off/` |
| `TRANSFER` | `POST /api/warehouse/documents/transfer/` |
| `COMMERCIAL_OFFER` | `POST /api/warehouse/documents/commercial-offer/` |

Обновление (все типы): `PUT /api/warehouse/documents/{id}/`  
Чтение: `GET /api/warehouse/documents/{id}/`, списки по типу и `GET /api/warehouse/documents/`.

Проведение: `POST /api/warehouse/documents/{id}/post/` — дата документа **не должна** перезаписываться при проведении.

---

## 3. Контракт поля `date`

### 3.1 Запрос (create / update)

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `date` | `string` | нет | Календарная дата документа в формате **`YYYY-MM-DD`** |

**Пример фрагмента тела:**

```json
{
  "doc_type": "SALE",
  "warehouse_from": "550e8400-e29b-41d4-a716-446655440000",
  "counterparty": "660e8400-e29b-41d4-a716-446655440001",
  "payment_kind": "cash",
  "payment_method": "cash",
  "comment": "",
  "discount_percent": "0.00",
  "discount_amount": "0.00",
  "date": "2026-06-20",
  "items": [
    {
      "product": "770e8400-e29b-41d4-a716-446655440002",
      "qty": "2",
      "price": "1500.00",
      "discount_percent": "0.00",
      "discount_amount": "0.00",
      "line_total": "3000.00"
    }
  ]
}
```

### 3.2 Ответ (детальная карточка и списки)

| Поле | Тип | Описание |
|------|-----|----------|
| `date` | `string` | Дата документа. Предпочтительный формат ответа: `YYYY-MM-DD` или ISO 8601 (`YYYY-MM-DDTHH:MM:SS...`) |
| `created_at` | `string` | Момент создания записи в системе (технический, **не подменяет** `date`) |

Фронт при отображении и редактировании использует приоритет: **`date` → `created_at`**.

```javascript
// Загрузка в форму (CreateSaleDocument.jsx)
if (doc.date) {
  setDocumentDateValue(doc.date.split("T")[0]);
} else if (doc.created_at) {
  setDocumentDateValue(doc.created_at.split("T")[0]);
}
```

### 3.3 Если `date` не передан

| Сценарий | Ожидаемое поведение бэкенда |
|----------|----------------------------|
| Создание без `date` | Установить `date` = текущая календарная дата в таймзоне компании/филиала (или UTC — главное, задокументировать) |
| Обновление без `date` в теле | Не менять существующую `date` (для `PUT`/`PATCH`) |
| Обновление с `date: null` | Рекомендуется `400` или трактовать как «сброс на сегодня» — согласовать; фронт `null` не шлёт |

---

## 4. Валидация

Рекомендуемые правила:

1. **Формат:** `YYYY-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$`) или парсинг ISO date.
2. **Диапазон:** валидная календарная дата (не `2026-02-30`).
3. **Будущая дата:** допустима (документы «задним числом» и «наперёд» — бизнес-решение; по умолчанию **разрешить** любую разумную дату, например не дальше +1 год и не старше N лет — на усмотрение продукта).
4. **Проведённый документ:** уточнить политику:
   - **Вариант A (мягкий):** `date` можно менять и после проведения (только отображение/отчёты).
   - **Вариант B (строгий):** после `status = posted` поле `date` read-only → `400` при попытке изменить.
   
   Фронт пока не блокирует редактирование даты у проведённого документа — желательно вернуть понятную ошибку, если менять нельзя.

5. **Не путать с `created_at`:** `created_at` — audit trail; `date` — операционная дата для печати, списков, аналитики.

---

## 5. Связь с печатью и экспортом

После сохранения фронт при печати берёт дату из ответа API:

```javascript
const currentDate = doc.date
  ? new Date(doc.date)
  : new Date(documentDateValue);
```

Используется в:

- накладной (PDF),
- чеке (PDF),
- коммерческом предложении (PDF),
- КО-1 (PDF),
- XML счёта-фактуры (ЭСФ).

**Требование:** поле `date` в ответе `POST`/`PUT` и `GET /documents/{id}/` должно совпадать с переданным при создании/обновлении, чтобы печатные формы и список документов показывали одну и ту же дату.

---

## 6. Фильтрация в списках (желательно)

Сейчас списки документов на фронте не фильтруют по дате через API, но для отчётов и будущего UI полезно:

```
GET /api/warehouse/documents/?date_from=2026-06-01&date_to=2026-06-30
GET /api/warehouse/documents/sale/?date_from=...&date_to=...
```

Фильтрация должна идти по полю **`date`** (операционная дата), не по `created_at`.

---

## 7. Отличие `date` и `created_at` (семантика)

| Поле | Назначение | Пример |
|------|------------|--------|
| `date` | Дата операции с точки зрения бухгалтерии/склада | Продажа была 20.06, внесли в систему 26.06 → `date = 2026-06-20` |
| `created_at` | Когда запись создана в БД | `2026-06-26T14:30:00Z` |

В списке (`Documents.jsx`) отображается: `formatDocumentDateTime(doc.date || doc.created_at)`.

---

## 8. Что отправит фронт после готовности API

Планируемое изменение в `handleSave` / `handleSaveAndPrint`:

```javascript
const documentData = {
  // ...существующие поля
  date: documentDateValue, // "YYYY-MM-DD"
  items: buildDocumentLineItems(cartItems),
};
```

Для `COMMERCIAL_OFFER` поле также будет добавлено в `toCommercialOfferPayload` (сейчас там только склад, контрагент, скидки и позиции).

Значение по умолчанию в форме при новом документе: **сегодня** (`new Date().toISOString().split("T")[0]`).

---

## 9. Критерии приёмки

- [ ] `POST` любого типового эндпоинта с `"date": "2026-06-20"` сохраняет дату и возвращает её в ответе.
- [ ] `GET /documents/{id}/` возвращает то же значение `date`.
- [ ] `PUT /documents/{id}/` с новым `date` обновляет дату в ответе и в списке.
- [ ] Если `date` не передан при создании — подставляется текущая дата, поведение задокументировано.
- [ ] `created_at` не перезаписывается при изменении `date`.
- [ ] `POST .../post/` не меняет `date`.
- [ ] Ошибки валидации: `400` с полем `date` в теле ошибки (DRF-style: `{"date": ["..."]}`).

---

## 10. Примеры ответов

**Успешное создание:**

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "doc_type": "SALE",
  "number": "000042",
  "status": "draft",
  "date": "2026-06-20",
  "created_at": "2026-06-26T10:15:30.123456Z",
  "warehouse_from": "...",
  "counterparty": "...",
  "items": [ "..." ],
  "total": "3000.00"
}
```

**Ошибка формата:**

```json
{
  "date": ["Неверный формат даты. Ожидается YYYY-MM-DD."]
}
```

---

## 11. Сводка по эндпоинтам

| Метод | URL | Изменение |
|-------|-----|-----------|
| `POST` | `/api/warehouse/documents/sale/` | Принимать и сохранять `date` |
| `POST` | `/api/warehouse/documents/purchase/` | то же |
| `POST` | `/api/warehouse/documents/sale-return/` | то же |
| `POST` | `/api/warehouse/documents/purchase-return/` | то же |
| `POST` | `/api/warehouse/documents/inventory/` | то же |
| `POST` | `/api/warehouse/documents/receipt/` | то же |
| `POST` | `/api/warehouse/documents/write-off/` | то же |
| `POST` | `/api/warehouse/documents/transfer/` | то же |
| `POST` | `/api/warehouse/documents/commercial-offer/` | то же |
| `PUT` / `PATCH` | `/api/warehouse/documents/{id}/` | Принимать `date`, отдавать в ответе |
| `GET` | `/api/warehouse/documents/`, типовые списки | Поле `date` в каждой записи |
| `GET` | `/api/warehouse/documents/{id}/` | Поле `date` |
| `POST` | `/api/warehouse/documents/{id}/post/` | `date` не изменять |

---

## 12. Контакты по фронту

- Форма: `src/Components/Sectors/Warehouse/Documents/CreateSaleDocument.jsx`
- API-клиент: `src/api/warehouse.js` (`createSaleDocument`, `updateDocument`, …)
- Redux: `updateWarehouseDocument` → `PUT warehouse/documents/{id}/`

После деплоя бэкенда сообщите — подключим передачу `date` в payload на фронте.
