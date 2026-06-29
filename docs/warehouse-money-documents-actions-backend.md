# Денежные документы кассы — действия (Отказать / Редактировать / Удалить / дата)

Касается страниц **Приход в кассу** (`/crm/warehouse/documents/money/receipt`) и
**Расход в кассу** (`/crm/warehouse/documents/money/expense`).
Бэкенд: `warehouse/money/documents/`. Фронт уже реализован — заработает сразу при готовности API.

## Статусы
`DRAFT` (черновик) · `POSTED` (проведён) · **`REJECTED` (отказан) — NEW**.

| Действие | Когда доступно | Запрос |
|----------|----------------|--------|
| Провести | `DRAFT` | `POST {id}/post/` (есть) |
| Отменить проведение | `POSTED` | `POST {id}/unpost/` (есть) |
| **Отказать** | `POSTED` | **`POST {id}/reject/` — NEW** |
| **Редактировать** | `DRAFT` или `REJECTED` | `PATCH {id}/` (есть, см. ниже) |
| **Удалить** | `DRAFT` или `REJECTED` | `DELETE {id}/` (есть) |

## 1. Отказать — `POST warehouse/money/documents/{id}/reject/` (NEW)
- Переводит `POSTED → REJECTED`.
- **Откатывает движение по кассе** (как `unpost`), но документ остаётся в системе как «Отказан».
- Ошибка `400`, если статус не `POSTED`.
- **Response:** `200` + объект документа со `status: "REJECTED"`.

## 2. Редактирование — `PATCH warehouse/money/documents/{id}/`
- Разрешать **только** при `status ∈ {DRAFT, REJECTED}`; для `POSTED` → `400`.
- Изменяемые поля: `cash_register`, `counterparty`, `payment_category`, `amount`, `comment`, `date`.
- **Response:** `200` + полный объект.

## 3. Удаление — `DELETE warehouse/money/documents/{id}/`
- Разрешать **только** при `status ∈ {DRAFT, REJECTED}`; для `POSTED` → `400` (сначала `unpost`/`reject`).
- **Response:** `204`.

## 4. Поле `date` при создании/редактировании — NEW
Модалка создания прихода/расхода даёт менять **дату операции**. Бэкенд должен принимать `date`
(`YYYY-MM-DD`) в `POST` и `PATCH`:
```jsonc
{ "doc_type": "MONEY_RECEIPT", "cash_register": "…", "payment_category": "…",
  "amount": 1000, "counterparty": null, "comment": "", "date": "2026-06-29" }
```
- Если `date` не передан — использовать текущую дату (как сейчас).
- `date` влияет на отображение и попадает в проводку/отчёты по кассе за этот день.

## Чек-лист
- [ ] Эндпоинт `reject/` (`POSTED → REJECTED`, откат кассы).
- [ ] `status: "REJECTED"` в сериализаторе/фильтрах списка.
- [ ] `PATCH`/`DELETE` запрещены для `POSTED`.
- [ ] `POST`/`PATCH` принимают и сохраняют `date`.
- [ ] `reject` идемпотентно-безопасен (повтор по не-`POSTED` → `400`).
