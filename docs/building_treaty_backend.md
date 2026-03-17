# Договора (BuildingTreaty) — Backend-спецификация

Базовый префикс: `/api/building/`.

Права: `can_view_building_treaty` (или `owner`/`admin`/`superuser`). Ограничения по ЖК применяются по назначениям пользователя (см. общую документацию Building).

---

## 1. Тип договора (operation_type)

При создании и обновлении договора указывается **тип договора**:

| Значение       | Описание |
|----------------|----------|
| `booking`      | Бронь    |
| `sale`         | Продажа  |
| `other`        | Прочие   |

- Для **брони** и **продажи** обычно обязательны: `residential_complex`, `client`, `apartment`, сумма и условия оплаты (логика квартир: резерв/продажа).
- Для **прочих** (`operation_type = "other"`) поля `apartment`, `client`, `client_name`, `erp_sync_status`, `erp_external_id` делаются **необязательными** (см. п. 2).

---

## 2. Создание договора

**Эндпоинт:** `POST /treaties/`

### 2.1 Тело запроса (все поля)

```json
{
  "residential_complex": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "client": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "number": "string",
  "title": "string",
  "description": "string",
  "amount": "string",
  "apartment": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "operation_type": "sale",
  "payment_type": "full",
  "down_payment": "string",
  "payment_terms": "string",
  "status": "draft",
  "signed_at": "2026-03-14T11:48:40.039Z",
  "auto_create_in_erp": true
}
```

### 2.2 Обязательность полей по типу договора

**Для `operation_type = "booking"` и `operation_type = "sale"`:**
- Обязательные (по бизнес-правилам): `residential_complex`, `apartment`, `client`, `amount`, `operation_type`, `payment_type`.
- `number` — опционально (при пустом можно автогенерировать, например `ДГ-000001`).
- `client_name` — опционально (берётся из карточки клиента при наличии `client`).
- `erp_sync_status`, `erp_external_id` — как правило read-only, заполняются после синхронизации с ERP.

**Для `operation_type = "other"` (прочие):**
- Следующие поля делаются **необязательными**:
  - `apartment`
  - `client`
  - `client_name`
  - `erp_sync_status`
  - `erp_external_id`
- Можно создать договор без квартиры и без привязки к клиенту; при необходимости указывается произвольное название контрагента в `client_name` или иное описание в `title`/`description`.
- `residential_complex` и `amount` могут оставаться обязательными или опциональными по правилам продукта (в спецификации backend рекомендуется для «прочих» сделать опциональными и `residential_complex`, если договор не привязан к ЖК).

Итоговая таблица (кратко):

| Поле               | booking / sale | other  |
|--------------------|----------------|--------|
| `residential_complex` | обязательно* | опционально |
| `client`           | обязательно   | опционально |
| `client_name`      | опционально   | опционально |
| `apartment`        | обязательно    | опционально |
| `erp_sync_status`  | read-only     | опционально |
| `erp_external_id`  | read-only     | опционально |

\* По текущим правилам ЖК для продажи/брони.

### 2.3 Перечисления

- **operation_type:** `booking` | `sale` | `other`
- **payment_type:** `full` | `installment`
- **status:** `draft` | `active` | `signed` | `cancelled`

При `payment_type = "installment"` в теле можно передавать график рассрочки (`installments`, `down_payment`, `payment_terms`); при `full` рассрочка не используется.

---

## 3. Получение списка договоров и фильтрация

**Эндпоинт:** `GET /treaties/`

Поддерживаемая **фильтрация** (query-параметры):

| Параметр             | Тип   | Описание |
|----------------------|-------|----------|
| `residential_complex`| uuid  | ЖК       |
| `client`             | uuid  | Клиент   |
| `apartment`          | uuid  | Квартира |
| `status`             | string| Статус: `draft`, `active`, `signed`, `cancelled` |
| `operation_type`     | string| Тип: `booking`, `sale`, `other` |
| `payment_type`       | string| Условия оплаты: `full`, `installment` |
| `erp_sync_status`    | string| Статус синхронизации с ERP (если есть) |
| `search`             | string| Полнотекстовый поиск по номеру, названию, описанию, клиенту, ЖК, квартире |

Примеры:

```
GET /treaties/?residential_complex=3fa85f64-5717-4562-b3fc-2c963f66afa6
GET /treaties/?operation_type=sale&status=signed
GET /treaties/?client=3fa85f64-5717-4562-b3fc-2c963f66afa6
GET /treaties/?search=ДГ-000001
```

Список возвращается с пагинацией (например, DRF `PageNumberPagination`). Данные фильтруются по компании и по назначениям пользователя на ЖК (если включено ограничение по ЖК).

---

## 4. Детали, обновление, удаление

- `GET /treaties/{id}/` — детали договора.
- `PATCH /treaties/{id}/` — обновление (те же поля и правила обязательности в зависимости от `operation_type`).
- `DELETE /treaties/{id}/` — удаление (по бизнес-правилам может быть запрещено для подписанных/активных).

При смене `operation_type` на `other` ранее обязательные поля `apartment`/`client` можно очищать; при смене с `other` на `booking`/`sale` валидация снова может требовать их заполнения.

