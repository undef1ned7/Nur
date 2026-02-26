# Building Procurement API - Frontend документация

Документация по процессу:
- отдел закупок создает закупку по ЖК;
- касса подтверждает или отклоняет;
- после подтверждения создается передача на склад ЖК;
- склад принимает или отклоняет передачу;
- вся история фиксируется в workflow-событиях.

## Базовый URL

```http
/api/building/
```

## Авторизация

- Все запросы требуют `Authorization: Bearer <token>`.
- Доступ ограничивается компанией пользователя.

## Права (функциональные роли)

- Закупки: `can_view_building_procurement`
- Касса: `can_view_building_cash_register`
- Склад: `can_view_building_stock`
- `owner/admin/superuser` имеют расширенный доступ.

---

## Статусы процесса

### Закупка (`BuildingProcurementRequest.status`)

- `draft` - черновик
- `submitted_to_cash` - отправлено в кассу
- `cash_approved` - одобрено кассой
- `cash_rejected` - отклонено кассой
- `transfer_created` - создана передача на склад
- `transferred` - передача принята складом
- `partially_transferred` - передача отклонена складом (в текущей логике)

### Передача (`BuildingTransferRequest.status`)

- `pending_receipt` - ожидает решение склада
- `accepted` - принято складом
- `rejected` - отклонено складом

---

## Основной сценарий (E2E)

1) Закупки создают заявку: `POST /procurements/`  
2) Закупки добавляют позиции: `POST /procurement-items/`  
3) Закупки отправляют в кассу: `POST /procurements/{id}/submit-to-cash/`  
4) Касса:
   - подтверждает `POST /cash/procurements/{id}/approve/`, или
   - отклоняет `POST /cash/procurements/{id}/reject/`
5) После `cash_approved` закупки создают передачу: `POST /procurements/{id}/transfers/create/`
6) Склад:
   - принимает `POST /warehouse-transfers/{id}/accept/`, или
   - отклоняет `POST /warehouse-transfers/{id}/reject/`
7) Историю действий и позиций получаем через `GET /workflow-events/`

---

## Endpoints

## Warehouse-style purchase API (for procurement department)

Этот блок сделан специально, чтобы отдел закупок работал по паттерну `warehouse/documents/purchase`.

- `GET /documents/purchase/` - список документов закупки
- `POST /documents/purchase/` - создать документ закупки с позициями
- `GET /documents/purchase/{id}/` - детали документа
- `PATCH /documents/purchase/{id}/` - обновить документ (только `draft`)
- `DELETE /documents/purchase/{id}/` - удалить документ
- `POST /documents/purchase/{id}/cash/approve/` - подтверждение кассой
- `POST /documents/purchase/{id}/cash/reject/` - отказ кассой

Формат документа:
- `doc_type = "PURCHASE"`
- `status` (внутренние статусы `building`)
- `date`, `total`, `items` (вложенный список)

Пример create:
```json
{
  "residential_complex": "e5f3...uuid",
  "comment": "Закупка на этап отделки",
  "items": [
    {
      "product": "b3ab...uuid",
      "name": "Краска фасадная",
      "unit": "банка",
      "qty": "30.000",
      "price": "1200.00",
      "order": 1,
      "note": "Белая матовая"
    },
    {
      "name": "Грунтовка",
      "unit": "канистра",
      "qty": "20.000",
      "price": "900.00",
      "order": 2
    }
  ]
}
```

Пример approve:
```json
{
  "note": "Согласовано кассой"
}
```

Пример reject:
```json
{
  "reason": "Превышен лимит бюджета"
}
```

Важно:
- в позициях `product` можно передавать как в `warehouse`-логике;
- если `product` передан, `name/unit` можно не передавать (подставятся из товара).

### Каталог товаров (как в warehouse)

- `GET /products/`
- `POST /products/`
- `GET /products/{id}/`
- `PATCH /products/{id}/`
- `DELETE /products/{id}/`

Поиск:
- `GET /products/?search=цемент`
- `GET /products/?search=123456789` (штрихкод)

Пример create товара:
```json
{
  "name": "Цемент М500",
  "article": "CEM-M500",
  "barcode": "111222333444",
  "unit": "мешок",
  "description": "Сухая смесь",
  "is_active": true
}
```

---

## 1) ЖК и склады ЖК

### ЖК (базовые)
- `GET /objects/`
- `POST /objects/`
- `GET /objects/{id}/`
- `PATCH /objects/{id}/`
- `DELETE /objects/{id}/`

### Склады ЖК
- `GET /warehouses/`
- `POST /warehouses/`
- `GET /warehouses/{id}/`
- `PATCH /warehouses/{id}/`
- `DELETE /warehouses/{id}/`

Фильтры/поиск:
- `GET /warehouses/?residential_complex=<uuid>&is_active=true`
- `GET /warehouses/?search=<text>`

Пример create:
```json
{
  "residential_complex": "e5f3...uuid",
  "name": "Склад ЖК Север",
  "is_active": true
}
```

---

## 2) Закупки

### Список/создание
- `GET /procurements/`
- `POST /procurements/`

Фильтры/поиск:
- `residential_complex`
- `status`
- `search` (по `title/comment/названию ЖК`)

Пример create:
```json
{
  "residential_complex": "e5f3...uuid",
  "title": "Закупка бетон/арматура",
  "comment": "Срочная закупка на этап фундамента"
}
```

### Детали
- `GET /procurements/{id}/`
- `PATCH /procurements/{id}/`
- `DELETE /procurements/{id}/`

### Отправка в кассу
- `POST /procurements/{id}/submit-to-cash/`
- Тело не требуется

---

## 3) Позиции закупки

### Список/создание
- `GET /procurement-items/`
- `POST /procurement-items/`

Фильтр:
- `procurement`

Пример create:
```json
{
  "procurement": "2ae2...uuid",
  "name": "Цемент М500",
  "unit": "мешок",
  "quantity": "120.000",
  "price": "450.00",
  "order": 1,
  "note": "Для монолита"
}
```

### Детали/обновление/удаление
- `GET /procurement-items/{id}/`
- `PATCH /procurement-items/{id}/`
- `DELETE /procurement-items/{id}/`

Важно:
- позиции можно менять только пока закупка в `draft`.

---

## 4) Касса

### Список ожидающих
- `GET /cash/procurements/pending/`

### Подтвердить закупку
- `POST /cash/procurements/{id}/approve/`

Тело (опционально):
```json
{
  "reason": "Платеж согласован"
}
```

### Отклонить закупку
- `POST /cash/procurements/{id}/reject/`

Тело (обязательно):
```json
{
  "reason": "Не хватает бюджета на этот период"
}
```

---

## 5) Передача на склад

### Создать передачу из одобренной закупки
- `POST /procurements/{id}/transfers/create/`

Тело:
```json
{
  "note": "Отправляем первую партию"
}
```

### Список передач
- `GET /warehouse-transfers/`
- `GET /warehouse-transfers/?incoming=true` - только входящие на приемку (`pending_receipt`)

Фильтры/поиск:
- `status`
- `warehouse`
- `procurement`
- `search` (по заметке/складу/закупке/ЖК)

### Детали передачи
- `GET /warehouse-transfers/{id}/`

### Принять передачу (склад)
- `POST /warehouse-transfers/{id}/accept/`

Тело (опционально):
```json
{
  "note": "Принято, все позиции в наличии"
}
```

### Отклонить передачу (склад)
- `POST /warehouse-transfers/{id}/reject/`

Тело (обязательно):
```json
{
  "reason": "Несоответствие количества по накладной"
}
```

---

## 6) Остатки и движения склада

### Остатки
- `GET /warehouse-stock/items/`
- фильтры: `warehouse`
- поиск: `search` (наименование/единица/склад/ЖК)

### Движения
- `GET /warehouse-stock/moves/`
- фильтры: `warehouse`, `stock_item`, `transfer`, `move_type`

`move_type` на текущий момент:
- `incoming`

---

## 7) История и аудит

### Workflow events
- `GET /workflow-events/`

Фильтры:
- `procurement`
- `procurement_item`
- `transfer`
- `transfer_item`
- `warehouse`
- `stock_item`
- `action`

Каждое событие содержит:
- `actor`, `actor_display`
- `action`
- `from_status`, `to_status`
- `message`
- `payload` (snapshot данных позиции/движения)
- `created_at`

Примеры `action`:
- `procurement_created`
- `procurement_item_created`
- `procurement_item_updated`
- `procurement_item_deleted`
- `procurement_submitted_to_cash`
- `cash_approved`
- `cash_rejected`
- `transfer_created`
- `transfer_item_created`
- `transfer_accepted`
- `transfer_rejected`
- `stock_incoming`
- `procurement_transferred`
- `procurement_partially_transferred`

---

## Пример ответа: закупка (кратко)

```json
{
  "id": "2ae2...uuid",
  "residential_complex": "e5f3...uuid",
  "residential_complex_name": "ЖК Север",
  "initiator": "87cc...uuid",
  "initiator_display": "Иван Петров",
  "title": "Закупка бетон/арматура",
  "comment": "Срочная закупка на этап фундамента",
  "status": "cash_approved",
  "total_amount": "54000.00",
  "submitted_to_cash_at": "2026-02-26T15:02:11Z",
  "cash_decided_at": "2026-02-26T15:07:31Z",
  "cash_decision": {
    "decision": "approved",
    "reason": "Платеж согласован"
  },
  "items": [
    {
      "id": "9bd1...uuid",
      "name": "Цемент М500",
      "unit": "мешок",
      "quantity": "120.000",
      "price": "450.00",
      "line_total": "54000.00"
    }
  ],
  "transfers": []
}
```

---

## Ошибки и UX рекомендации

- `400` - неверный payload или недопустимый переход статуса.
- `401` - неавторизован.
- `403` - нет прав/чужая компания.
- `404` - объект не найден или недоступен пользователю.

Рекомендации для фронта:
- кнопки действий показывать по `status`:
  - `submit-to-cash` только для `draft`;
  - `approve/reject cash` только для `submitted_to_cash`;
  - `create transfer` только для `cash_approved`;
  - `accept/reject transfer` только для `pending_receipt`.
- после любого action обновлять:
  - карточку закупки/передачи;
  - блок истории (`/workflow-events/` с фильтром по объекту);
  - складские остатки/движения при приемке.

