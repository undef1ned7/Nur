# Barbershop Public Services + Multi-master Booking — для фронта

Публичные эндпоинты страницы `/service/{slug}/booking` (без авторизации, компания по `{slug}`).

- Базовый URL: `https://app.nurcrm.kg/api`

---

## 1. Услуги + мастера одним запросом

`GET /api/barbershop/public/{slug}/services/` (опц. `?branch=<uuid>`)

Нормализованный ответ (без дублирования сотрудников): только активные услуги и мастера.

```jsonc
{
  "employees": {
    "<uuid>": { "id": "<uuid>", "name": "Алексей", "avatar": null }
  },
  "services": [
    { "id": "<uuid>", "name": "Стрижка", "category": "<uuid|null>",
      "category_name": "Волосы", "price": "500.00", "time": "30",
      "employeeIds": ["<uuid>", "<uuid>"] }
  ]
}
```

- Ответ — объект (не массив). Пагинации нет.
- `employeeIds` ссылается на ключи `employees`.
- Группировку мастеров по покрытию выбранных услуг делает фронт.

---

## 2. Бронирование (в т.ч. multi-master)

`POST /api/barbershop/public/{slug}/bookings/`

Поддерживаются два формата.

### A. Multi-master (новый) — несколько мастеров атомарно
```jsonc
{
  "client_name": "Иван",
  "client_phone": "+996700000000",
  "client_comment": null,
  "date": "2026-06-26",
  "payment_method": "cash",            // опц.: cash | card | online
  "assignments": [
    { "master_id": "<uuid>",
      "services": [ { "service_id":"<uuid>", "title":"Стрижка", "price":500, "duration_min":30 } ],
      "time_start": "10:00:00", "time_end": "10:30:00" },
    { "master_id": "<uuid>",
      "services": [ { "service_id":"<uuid>", "title":"Бритьё", "price":300, "duration_min":20 } ],
      "time_start": "10:30:00", "time_end": "10:50:00" }
  ]
}
```

**201:**
```json
{ "bookings": [ { "id": "<uuid>", "master_id": "<uuid>" } ] }
```

Создаётся всё-или-ничего (транзакция). Валидация каждого назначения:
- мастер существует и активен в компании;
- мастер умеет услугу (если у услуги заданы мастера);
- слот свободен (с учётом существующих заявок и записей);
- время в пределах рабочего дня **09:00–21:00**, `time_end > time_start`;
- нет пересечений слотов одного мастера внутри запроса.

**400** при ошибке (ничего не создано):
```json
{ "assignments": [ { "index": 0, "detail": "Слот мастера уже занят." } ] }
```

### B. Одиночная бронь (старый формат) — без изменений
```jsonc
{ "services":[…], "master_id":"<uuid>", "master_name":"…",
  "date":"2026-06-26", "time_start":"10:00:00", "time_end":"10:30:00",
  "client_name":"…", "client_phone":"…", "client_comment":null,
  "payment_method":"cash" }
```
→ **201** + объект заявки. Фронт может использовать как fallback (по одному POST на мастера),
если multi-master не нужен.

Выбор формата на бэке — по наличию ключа `assignments`.

---

## Пример (axios)
```js
const { data } = await api.get(`/barbershop/public/${slug}/services/`);
// data.employees, data.services

await api.post(`/barbershop/public/${slug}/bookings/`, {
  client_name, client_phone, date,
  assignments: groups.map(g => ({
    master_id: g.masterId,
    services: g.services,           // {service_id,title,price,duration_min}
    time_start: g.start, time_end: g.end,
  })),
});
// → { bookings: [{id, master_id}, …] }
```
