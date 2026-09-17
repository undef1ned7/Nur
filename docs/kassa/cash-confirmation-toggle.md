# Общая касса (construction/*): подтверждение операций — выключаемое, по умолчанию выключено

**Статус:** фронт готов, ждёт реализации на бэке.
**Модуль:** общий легаси-модуль кассы (`src/Components/Deposits/Kassa*`),
используется секторами Barber, Building, Pilorama, School, logistics и
не-owner ролями в остальных секторах (роутинг — `kassaRoutes()` в
`src/config/routes/commonRoutes.jsx`); также точки создания операции
`Sell.jsx`, `ProductionAgents.jsx` через `AddCashFlowsModal`.
**Домен API:** `/api/construction/` (см. также
[cashflows-filters.md](./cashflows-filters.md) — контракт фильтров списка).
**Дата:** 2026-09-16.
**Связано:** тот же принцип уже реализован для Consulting
([docs/consulting/backend-money-tenant/26-cash-confirmation-default-off.md](../consulting/backend-money-tenant/26-cash-confirmation-default-off.md))
и для Warehouse
([docs/warehouse/cash-confirmation-toggle.md](../warehouse/cash-confirmation-toggle.md)).

## 1. Задача и текущее поведение

Сейчас `POST /construction/cashflows/` решает статус новой операции **на
фронте, по роли автора**, жёстко (`AddCashFlowsModal.jsx`):

```js
status: profile.role === 'owner' ? 'approved' : 'pending'
```

То есть owner добавляет операцию — она сразу в остатке; любая другая роль —
операция уходит в `pending` и должна ждать, пока owner одобрит её через
`PendingModal.jsx` (`PATCH /construction/cashflows/{id}/ { status: true }`;
внимание — на фронте `PendingModal` использует **boolean** (`true/false`),
хотя [cashflows-filters.md](./cashflows-filters.md) документирует статус как
строковый enum `pending|approved|rejected` — сверить с реальным бэком,
какой формат актуален, и не ломать один в пользу другого без миграции).

Это жёстко и не настраивается: компания, где не-owner сотрудники сами
принимают наличные (кассир, продавец), вынуждена либо каждый раз ждать
одобрения владельца, либо давать всем сотрудникам роль `owner` (что открывает
им куда больше прав, чем нужно только для кассы).

Нужно: возможность **выключить** это требование, и чтобы оно было
**выключено по умолчанию** — операция сразу `approved`, кто бы её ни
добавил, пока компания сама не включит подтверждение.

## 2. Модель данных

```python
class CashConfirmationSettings(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE,
                                   related_name="cash_confirmation_settings")
    enabled = models.BooleanField(default=False)   # выключено по умолчанию
```

- `enabled=false` (**default**) — `POST /construction/cashflows/` игнорирует
  переданный `status` (или принимает только `approved`) — **новая операция
  всегда `approved`**, независимо от роли автора.
- `enabled=true` — текущее (уже реализованное) поведение: не-owner → операция
  создаётся как `pending`, требует одобрения через
  `PATCH /construction/cashflows/{id}/`.

**Важно (безопасность):** сейчас статус решает клиент (фронт передаёт
`status` в body `POST`). Это значит, что при `enabled=true` не-owner
пользователь технически может отправить `status="approved"` напрямую через
API, минуя фронт, и обойти подтверждение. Рекомендация бэку: **не доверять
`status` из тела запроса** — вычислять его на сервере по роли автора и
`CashConfirmationSettings.enabled`, а не принимать как есть. Это не новая
дыра, появившаяся с этой задачей, — она существует уже сейчас, но раз мы
трогаем эту логику, стоит закрыть её тем же изменением.

## 3. Эндпоинты

```
GET   /construction/cash-confirmation-settings/
PATCH /construction/cash-confirmation-settings/   { "enabled": true|false }
```

```jsonc
// GET / PATCH-ответ
{ "enabled": false }
```

- `GET` для компании без сохранённой строки — отдаёт `{"enabled": false}`
  (виртуальный дефолт), не `404`.
- `PATCH` — только `owner`. Остальным — `403`.
- Пока эндпоинта нет (`404/501`) — фронт работает как `enabled=false`
  (см. §5).

## 4. Существующие компании

Как и в двух предыдущих решениях (Consulting, Warehouse) — это смена
**дефолта для новых/ещё не сконфигурированных компаний**, не принудительная
миграция. Здесь ситуация ближе к Warehouse, чем к Consulting: этой настройки
физически не было, поведение было жёстко зашито в коде (`owner → approved,
остальные → pending`) для *всех* компаний без исключения. Значит после
релиза для всех компаний, которые не сталкивались с этим явно, поведение
станет мягче (не-owner тоже сразу approved) — это ожидаемо и есть суть
задачи.

Если это неприемлемо для компаний, где сейчас реально используется очередь
подтверждения (есть история `pending → approved/rejected` за последние 30
дней) — тем можно migration-скриптом проставить `enabled=True`, чтобы для
них ничего не изменилось. Это решение продукта, не блокирует фронт.

## 5. Фронт (уже сделано)

- `src/store/slices/cashSlice.js`: новые thunks
  `getCashConfirmationSettings`/`updateCashConfirmationSettings`, состояние
  `state.cash.confirmation = { enabled, loaded }`.
- `src/Components/Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal.jsx`:
  статус теперь `needsConfirmation = confirmation.enabled && role !== owner`
  → `pending`, иначе всегда `approved` (было: жёстко по роли).
- `src/Components/Deposits/Kassa/CashConfirmationSettingsModal/CashConfirmationSettingsModal.jsx`
  — новый чекбокс «Требовать подтверждение операций не-владельца», выключен
  по умолчанию.
- `src/Components/Deposits/Kassa/Kassa.jsx` (`CashboxList`, владелец-вид
  `/crm/kassa`): кнопка «Настройки» в шапке, видна только `owner`.
- Пока эндпоинт не готов (`404/501`) — фронт работает как `enabled=false`
  (thunk ловит ошибку и молча ставит `{ enabled: false, loaded: true }`).

## 6. Чек-лист приёмки

- [ ] Новая компания / без сохранённых настроек →
      `GET /construction/cash-confirmation-settings/` возвращает
      `{"enabled": false}`.
- [ ] При `enabled=false`: `POST /construction/cashflows/` от любой роли
      (включая не-owner) создаёт запись сразу со `status=approved`
      (сервер решает статус сам, не доверяя `status` из тела запроса).
- [ ] При `enabled=true`: не-owner → `pending`, требуется явное
      `PATCH .../{id}/` от owner для перевода в `approved`.
- [ ] `PATCH cash-confirmation-settings/` доступен только `owner` → `403`
      для остальных ролей.
- [ ] Переключение `enabled` не трогает уже существующие операции в
      `pending` — они по-прежнему видны в очереди подтверждения.
