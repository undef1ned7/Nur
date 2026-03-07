# Бекенд: почему services пустые и что исправить

## Проблема

При `POST /barbershop/appointments/` с телом:
```json
{
  "services": ["f6064bad-8f79-4a79-b63e-f4fb76dadeee", "f6064bad-8f79-4a79-b63e-f4fb76dadeee"],
  ...
}
```

В ответе приходит:
```json
{
  "services": [],
  "services_names": [],
  "services_public": []
}
```

Запись создаётся (201), но услуги не сохраняются.

---

## Что приходит с фронта

- `services` — массив строк (UUID услуг)
- Один UUID может повторяться несколько раз
- Пример: `["uuid1", "uuid2", "uuid1"]` = 3 позиции

---

## Что проверить в коде

1. **Сериализатор** (`barber/serializers.py`): поле `services` принимает массив ID и при `create`/`update` создаёт `AppointmentService` для каждого ID?

2. **Логика сохранения**: после `Appointment.objects.create(...)` вызывается ли цикл:
   ```python
   for service_id in validated_data.get('services', []):
       service = Service.objects.get(id=service_id)
       AppointmentService.objects.create(appointment=instance, service=service)
   ```

3. **Поле в сериализаторе**: если `services` — `PrimaryKeyRelatedField(many=True, queryset=Service.objects.all())`, то DRF ожидает список ID и сам подтягивает `Service`. Но связь `Appointment.services` может быть через `through=AppointmentService` — тогда `.set(service_objects)` не сработает, нужен ручной `AppointmentService.objects.create`.

4. **Ошибка `'AppointmentService' instance expected, got <Service: ...>`**: значит где-то передаётся `Service` в поле, которое ждёт `AppointmentService`. Нужно создавать именно `AppointmentService`, а не присваивать `Service`.

---

## Итог

Фронт отправляет `services` корректно. Бекенд либо не обрабатывает это поле при создании, либо обрабатывает неверно. Нужно в `create()` сериализатора явно создать `AppointmentService` для каждого ID из `services`.
