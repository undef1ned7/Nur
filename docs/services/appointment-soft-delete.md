# Записи (Recorda) — мягкое удаление (`status=deleted`)

**Сферы:** Барбершоп, Услуги, Стоматология — общий backend-домен `barbershop`.  
**Страницы:** `/crm/barber/records`, `/crm/services/records`, `/crm/dentistry/records`.  
**Фронт:** `src/Components/Sectors/Barber/Recorda/Recorda.jsx`,  
`src/Components/Sectors/Barber/Recorda/components/RecordaModal.jsx`,  
`src/Components/Sectors/Barber/Recorda/components/RecordaUtils.js`.  
**Эндпоинт:** `PATCH /api/barbershop/appointments/{id}/` (поле `status`).  
**Статус:** ⚠️ Требуются правки модели / choices и, желательно, фильтрации в
list API. На фронте — готово.

---

## 1. Задача

При «удалении» записи в модалке календаря запись **не должна исчезать из БД**.
Нужно **мягкое удаление**:

- для обычных сотрудников запись **не видна** в расписании;
- для **owner** и **admin** запись **остаётся** в календаре со статусом
  «Удалено» (серый блок, фильтр «Удалено»);
- слот времени **освобождается** — на то же время можно создать новую запись;
- физический `DELETE /appointments/{id}/` **не используется**.

---

## 2. Текущее поведение (проблема)

- Раньше на фронте не было удаления; затем добавлялся `DELETE`, что
  необратимо стирало запись.
- Целевое поведение — только смена статуса на `deleted` через `PATCH`.

---

## 3. Статусы записи

### 3.1. Полный список

| Значение API | UI (RU) | Блокирует слот | Примечание |
|---|---|---|---|
| `booked` | Забронировано | да | |
| `confirmed` | Подтверждено | да | |
| `completed` | Завершено | да | триггер начисления зарплаты, см. `salary.md` |
| `canceled` | Отменено | нет | легаси: возможен вариант `cancelled` |
| `no_show` | Не пришёл | да | в UI «Не явился» |
| **`deleted`** | **Удалено** | **нет** | **новый — мягкое удаление** |

### 3.2. Добавление в модель

```python
class Appointment(models.Model):
    class Status(models.TextChoices):
        BOOKED = "booked", "Забронировано"
        CONFIRMED = "confirmed", "Подтверждено"
        COMPLETED = "completed", "Завершено"
        CANCELED = "canceled", "Отменено"
        NO_SHOW = "no_show", "Не пришёл"
        DELETED = "deleted", "Удалено"  # ← добавить

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.BOOKED,
    )
```

Миграция: только расширение `choices`, существующие строки не меняются.

### 3.3. Отличие `canceled` и `deleted`

| | `canceled` | `deleted` |
|---|---|---|
| Смысл | отмена брони (клиент/мастер) | удаление из рабочего расписания админом |
| Видимость | все роли (если не скрыто фильтром) | только owner/admin |
| Слот | свободен | свободен |
| Восстановление | смена статуса в модалке | только admin (PATCH на другой статус) |

---

## 4. API

### 4.1. Мягкое удаление

```http
PATCH /api/barbershop/appointments/{id}/
Authorization: Bearer …
Content-Type: application/json

{
  "status": "deleted"
}
```

**Ответ:** `200` + полный объект записи с `"status": "deleted"`.

**Ошибки:**

| Код | Когда |
|---|---|
| `400` | `deleted` не в `choices` / невалидный переход (если введёте FSM) |
| `403` | нет права удалять записи |
| `404` | запись другой компании / не найдена |

**Текст ошибки:** строка или `{"detail": "…"}` — фронт показывает как есть.

### 4.2. Права

Минимум:

- **owner, admin** — могут ставить `status=deleted` и видеть такие записи в
  списке;
- **остальные роли** с `can_view_barber_records` — **не должны** получать
  записи со статусом `deleted` в `GET /barbershop/appointments/` (см. §4.3).

Рекомендуется явная проверка в `perform_update` / permission class, а не
только фильтр queryset.

### 4.3. Список записей

```http
GET /api/barbershop/appointments/?page_size=1000
```

**Рекомендуемая фильтрация на бэке:**

```python
def get_queryset(self):
    qs = super().get_queryset().filter(company=…)
    role = self.request.user.role  # или из профиля компании
    if role not in ("owner", "admin"):
        qs = qs.exclude(status=Appointment.Status.DELETED)
    return qs
```

**Опционально** (для оптимизации календаря):

| Параметр | Тип | Смысл |
|---|---|---|
| `date` | `YYYY-MM-DD` | только записи с `start_at` в этот день |
| `status` | string | фильтр по одному статусу, incl. `deleted` |
| `barber` | uuid | фильтр по мастеру |

> Сейчас фронт фильтрует по дате и статусу **на клиенте** (`Recorda.jsx`).
> Server-side фильтры не обязательны для первой итерации, но снижают объём
> ответа.

### 4.4. Восстановление (опционально)

Админ может вернуть запись, если фронт отправит, например:

```json
{ "status": "booked" }
```

Отдельный эндпоинт `restore` **не нужен**. При восстановлении проверить
конфликты по времени мастера (как при обычном `PATCH`).

### 4.5. `DELETE` — не использовать

`DELETE /barbershop/appointments/{id}/` для UI Recorda **не вызывается**.
Допустимо:

- оставить для супер-админки / миграций;
- или вернуть `405` / `403` для обычных пользователей.

---

## 5. Бизнес-логика

### 5.1. Конфликты слотов

Запись со статусом `deleted` **не участвует** в проверке занятости слота
(как `canceled`).

На фронте множество блокирующих статусов:

```javascript
// RecordaUtils.js
BLOCKING = booked | confirmed | completed | no_show
// deleted и canceled — не блокируют
```

Бэкенд при валидации пересечений по времени должен **исключать** `deleted` и
`canceled`.

### 5.2. Зарплата (`docs/services/salary.md`)

| Событие | Действие |
|---|---|
| Запись → `deleted` **до** `completed` | начислений нет — ничего не делать |
| Запись → `deleted` **после** `completed` | как при откате `completed`: отменить
  начисления в `accrued` → `canceled`; если уже `paid` — корректировка или
  запрет удаления (`409`) |
| Запись уже `deleted` | новых начислений не создавать |

**Рекомендация v1:** если есть начисления в статусе `paid`, вернуть:

```json
HTTP 409
{"detail": "Нельзя удалить запись с выплаченным начислением. Измените статус вручную."}
```

### 5.3. Аналитика (`docs/services/analytics-dashboard.md`)

Записи `deleted`:

- **не** входят в `appointments_booked`, `appointments_completed` и т.п.;
- **не** учитываются в выручке мастеров;
- опционально: отдельная метрика `appointments_deleted` (не обязательна в v1).

### 5.4. Онлайн-запись / история / филиалы

| Модуль | Поведение |
|---|---|
| Онлайн-запись | `deleted` не показывать клиенту |
| `MastersHistory` | для admin — показывать с меткой «Удалено»; для мастера —
  скрыть или показывать только `completed` (как сейчас по статусам) |
| Branch analytics | исключать `deleted` из активных записей |

---

## 6. Что уже сделано на фронте

### 6.1. Удаление в модалке

- Кнопка **«Удалить»** справа, рядом с **«Сохранить запись»** (только при
  редактировании существующей записи).
- Подтверждение через `ConfirmModal`.
- Запрос:

```javascript
await api.patch(`/barbershop/appointments/${id}/`, { status: "deleted" });
```

- Если запись уже `deleted` — кнопка скрыта, показывается плашка для admin.

### 6.2. Видимость в календаре и отдельный раздел

```javascript
// Recorda.jsx — deleted никогда не показываются в календаре
records = records.filter((r) => r.status !== "deleted");
```

- Кнопка **«Удалённые»** в шапке (только owner/admin) открывает отдельный
  раздел на той же странице (`RecordaDeletedView`).
- В разделе — список всех удалённых записей (фильтр по мастеру), сортировка по
  дате записи (новые сверху).
- Кнопка **«К расписанию»** возвращает в календарь.
- Фильтр статуса **«Удалено»** убран — удалённые только через кнопку.

### 6.3. Константы

| Файл | Константа |
|---|---|
| `RecordaUtils.js` | `DELETED_STATUS = "deleted"` |
| `RecordaUtils.js` | `isScheduleBlocking(status)` — false для `deleted` |

**Ограничение фронта:** если бэк отдаёт `deleted` всем ролям, сотрудник
увидит их до перезагрузки или при прямом API-запросе. Гарантия — **фильтр на
бэке** (§4.3).

---

## 7. Примеры сценариев

| # | Действие | Роль | Ожидание |
|---|---|---|---|
| 1 | PATCH `status=deleted` | admin | `200`, запись в БД |
| 2 | Открыть календарь на этот день | admin | карточка «Удалено» видна |
| 3 | Открыть календарь на этот день | мастер | карточки нет |
| 4 | Клик в освободившийся слот | любой | можно создать новую запись |
| 5 | Фильтр «Удалено» | admin | только deleted за день |
| 6 | PATCH `status=deleted` на `completed` с paid-начислением | admin | `409` (рекомендуется) |
| 7 | PATCH `status=booked` на deleted-запись | admin | `200`, запись снова в расписании |

---

## 8. Чек-лист приёмки

- [ ] В модели / choices добавлен статус `deleted`.
- [ ] `PATCH` с `"status": "deleted"` → `200`.
- [ ] `GET /appointments/` для **не-admin** не содержит `deleted`.
- [ ] `GET /appointments/` для **owner/admin** содержит `deleted`.
- [ ] Валидация слотов игнорирует `deleted` (и `canceled`).
- [ ] Завершённая запись с **paid**-начислением: удаление → `409` или корректная
  отмена начислений (зафиксировать выбранное поведение).
- [ ] Аналитика не считает `deleted` как активную/завершённую запись.
- [ ] Фронт: кнопка «Удалённые» → отдельный раздел со списком; в календаре deleted не видны.

---

## 9. Связанные файлы

| Слой | Путь |
|---|---|
| Страница календаря | `src/Components/Sectors/Barber/Recorda/Recorda.jsx` |
| Модалка записи | `src/Components/Sectors/Barber/Recorda/components/RecordaModal.jsx` |
| Статусы / блокировка слотов | `src/Components/Sectors/Barber/Recorda/components/RecordaUtils.js` |
| Календарь / стили карточек | `src/Components/Sectors/Barber/Recorda/components/RecordaCalendar.jsx` |
| Фильтры | `src/Components/Sectors/Barber/Recorda/components/RecordaHeader.jsx` |
| Удалённые записи (список) | `src/Components/Sectors/Barber/Recorda/components/RecordaDeletedView.jsx` |
| Зарплата (начисления) | `docs/services/salary.md` |
| Аналитика | `docs/services/analytics-dashboard.md` |

---

## 10. Миграция / обратная совместимость

- Существующие записи без `deleted` — без изменений.
- Если `deleted` ещё не в choices, фронт покажет ошибку при удалении — это
  ожидаемо до деплоя бэка.
- После деплоя бэка **передеплой фронта не обязателен** (контракт уже совпадает).
