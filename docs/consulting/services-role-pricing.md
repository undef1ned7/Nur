# Консалтинг — Услуги: цены по ролям (`role_prices`)

**Страница:** `/crm/consulting/services` (фронт:
`src/Components/Sectors/Consulting/services/services.jsx`).
**Эндпоинты:** `/consalting/services/` (CRUD, уже существуют).
**Статус:** ⚠️ Требуются правки модели и сериализатора.

## 1. Что меняется

1. **Убрать поле `installation_price`** («Стоимость установки») из услуги. Фронт
   его больше не отправляет и не показывает. Итог продажи больше **не** включает
   установку (см. `src/utils/consultingSalePricing.js`).
2. **Добавить цены по ролям** — переопределения базовой цены для конкретных
   кастомных ролей (`/users/roles/`). Отдельно **для услуги** и **для каждого
   тарифа**.

Логика выбора цены: если для роли пользователя есть переопределение — берётся
оно, иначе базовая цена.

- В **продажах** (`sale.jsx`) роль берётся у продавца (`profile.custom_role`).
- В **воронке** (`Funnel.jsx`) роль берётся у воронки (`funnel.custom_role`).

## 2. Модель данных

Новое поле у `Service` и у `Tariff` — список переопределений:

```python
class ServiceRolePrice(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE,
                                related_name="role_prices")
    custom_role = models.ForeignKey(Role, on_delete=models.CASCADE)   # /users/roles/
    price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["service", "custom_role"], name="uniq_service_role_price")]

class TariffRolePrice(models.Model):
    tariff = models.ForeignKey(Tariff, on_delete=models.CASCADE,
                               related_name="role_prices")
    custom_role = models.ForeignKey(Role, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["tariff", "custom_role"], name="uniq_tariff_role_price")]
```

- `price >= 0`, иначе `400`.
- Роль должна принадлежать той же компании, что и услуга.
- Дубли роли внутри одной услуги/тарифа — `400`.

## 3. Формат API

### 3.1. Чтение — `GET /consalting/services/`

```jsonc
{
  "id": "…",
  "name": "Внедрение CRM",
  "price": 50000,                 // базовая цена
  "description": "…",
  "custom_role": "…|null",        // роль-владелец услуги (как было)
  "role_prices": [                // НОВОЕ
    { "custom_role": "role-manager-uuid", "price": 45000 },
    { "custom_role": "role-partner-uuid", "price": 40000 }
  ],
  "tariffs": [
    {
      "id": "…",
      "name": "Стандарт",
      "price": 30000,
      "subscription_amount": 5000,          // как было
      "subscription_period": "month|year",  // как было
      "role_prices": [                       // НОВОЕ
        { "custom_role": "role-manager-uuid", "price": 27000 }
      ]
    }
  ]
  // installation_price — УДАЛЕНО
}
```

### 3.2. Запись — `POST/PATCH /consalting/services/[{id}/]`

Фронт присылает `role_prices` (у услуги и у каждого тарифа) как список
`{custom_role, price}`. Пустые строки уже отфильтрованы на фронте
(`normalizeRolePricesForApi`), но бэкенд обязан валидировать повторно.

```jsonc
{
  "name": "Внедрение CRM",
  "price": 50000,
  "description": "",
  "custom_role": null,
  "role_prices": [ { "custom_role": "…", "price": 45000 } ],
  "tariffs": [
    { "name": "Стандарт", "price": 30000,
      "subscription_amount": 5000, "subscription_period": "month",
      "role_prices": [ { "custom_role": "…", "price": 27000 } ] }
  ]
}
```

Правила записи:

1. `tariffs` **заменяются целиком** (как сейчас) — вместе со своими `role_prices`.
2. `role_prices` услуги также заменяются целиком переданным списком.
3. Пустой список `role_prices: []` = удалить все переопределения.
4. Обратная совместимость: если запрос **не содержит** ключа `role_prices` —
   существующие переопределения не трогать (частичный PATCH).

## 4. Влияние на другие модули

- **Продажа** (`POST /consalting/sales/`): сервер должен считать цену услуги/
  тарифа **по роли продавца** (`request.user.custom_role`), а не по базовой.
  Фронт присылает `services`, `tariff`, `discount`, `markup`, `items` — сервер
  считает `total = role_price(service|tariff) + Σitems − discount + markup`.
- **Лид** (`estimated_value`): при указании услуги/тарифа сервер должен считать
  ожидаемую сумму по роли воронки.
- **Аналитика/Зарплата** используют итоговую сумму сделки — она уже без установки.

## 5. Миграция

- Удаление `installation_price`: если поле где-то использовалось в отчётах —
  учесть при миграции (данные можно сохранить в архивную колонку/лог, но из API
  убрать). Существующие суммы уже проведённых сделок **не пересчитывать**.
