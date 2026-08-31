# 3. Подписка компании

**Фронт:** `SubscriptionPanel.jsx`, утилита [`src/utils/companySubscription.js`](../../src/utils/companySubscription.js) — CRM считает компанию активной только если `end_date >= сегодня` (календарные даты).

## 3.1. Эндпоинт

### `PATCH /platform-admin/companies/:id/subscription/`

Отдельный URL, чтобы права/аудит подписки не смешивать с правкой реквизитов.

**Body:**

```json
{
  "subscription_plan_id": 2,
  "end_date": "2027-01-31",
  "support_note": "Продлили на год, счёт №…"
}
```

| Поле | Тип | Описание |
|---|---|---|
| `subscription_plan_id` | int \| null | FK на тарифный план |
| `end_date` | `YYYY-MM-DD` \| null | Дата окончания доступа к CRM |
| `support_note` | string \| null | Внутренняя заметка поддержки (не видна клиенту) |

**Response 200:** тот же объект компании, что и `GET /platform-admin/companies/:id/` (с обновлёнными полями).

**Ошибки:**

| Код | Когда |
|---|---|
| `400` | Неизвестный plan id, кривая дата |
| `404` | Компания не найдена |

Аудит: `company.subscription`.

## 3.2. Связь с CRM

- `ProtectedRoute` на фронте режет `/crm/*`, если `end_date` отсутствует или истекла.
- Продление = выставить будущий `end_date`.
- Смена тарифа (`Старт` / другие) влияет на меню и лимиты на фронте по `company.subscription_plan.name`.

## 3.3. Рекомендации

- При установке `end_date` нормализуйте к дате без времени (date field).
- Не удаляйте историю оплат, если она есть в биллинге — этот эндпоинт только выставляет текущий план и дату доступа.
- Опционально: отдельная таблица `CompanySubscriptionHistory` (кто, старый/новый plan, старый/новый end_date).
