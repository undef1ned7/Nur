## Задача

Реализовать два эндпоинта для офлайн-режима кафе.
Стек: Django REST Framework.

Бэкендер сам маппит на свои модели —
главное чтобы response строго соответствовал описанной структуре.

---

## Эндпоинт 1 — GET /api/cafe/offline-snapshot/

### Авторизация

Bearer JWT (стандартная для проекта)

### Что делает

Возвращает всё необходимое для работы кафе без интернета одним запросом.
Данные только для компании текущего пользователя.

### Response 200 — строго такая структура:

{
"snapshot_at": "2026-06-09T08:00:00Z", // текущее время сервера (timezone.now())

"menu": {
"categories": [
{
"id": 1,
"name": "Горячие блюда",
"sort_order": 1
}
],
"items": [
{
"id": 10,
"name": "Плов",
"category_id": 1, // id категории
"price": "350.00", // строка, два знака после запятой
"unit": "порция", // единица измерения
"is_available": true, // доступно ли сейчас
"image_url": null // url картинки или null
}
]
},

"tables": [
{
"id": 1,
"name": "Стол 1",
"hall_id": 1,
"hall_name": "Основной зал",
"capacity": 4,
"status": "free" // "free" | "occupied" | "reserved"
}
],

"open_orders": [
{
"id": 55,
"table_id": 1,
"status": "open",
"created_at": "2026-06-09T07:30:00Z",
"items": [
{
"id": 201,
"menu_item_id": 10,
"menu_item_name": "Плов",
"quantity": 2,
"price": "350.00" // цена за единицу
}
],
"total": "700.00" // сумма заказа строкой
}
],

"current_shift": { // null если смена не открыта
"id": 99,
"opened_at": "2026-06-09T07:00:00Z",
"employee_id": 5,
"employee_name": "Айбек"
}
}

### Требования

- Фильтровать всё по company текущего пользователя
- open_orders — только заказы со статусом "открыт" (не закрытые, не отменённые)
- menu.items — только активные/доступные позиции
- Создать отдельные упрощённые сериализаторы, не переиспользовать тяжёлые существующие

---

## Эндпоинт 2 — POST /api/cafe/offline-sync/

### Авторизация

Bearer JWT

### Что делает

Принимает очередь действий накопленных офлайн,
применяет их по порядку (по created_at),
возвращает отчёт об успехе/ошибках.

### Request Body:

{
"actions": [
{
"type": "CREATE_ORDER",
"payload": {
"table_id": 3,
"items": [
{ "menu_item_id": 10, "quantity": 2 }
]
},
"created_at": "2026-06-09T09:15:00Z"
},
{
"type": "ADD_ITEM_TO_ORDER",
"payload": {
"order_id": 55,
"menu_item_id": 12,
"quantity": 1
},
"created_at": "2026-06-09T09:17:00Z"
},
{
"type": "CLOSE_ORDER",
"payload": {
"order_id": 55,
"payment_method": "cash", // "cash" | "card" | "mixed"
"amount": 1050.00
},
"created_at": "2026-06-09T09:20:00Z"
},
{
"type": "REMOVE_ITEM_FROM_ORDER",
"payload": {
"order_id": 55,
"order_item_id": 201
},
"created_at": "2026-06-09T09:18:00Z"
},
{
"type": "CANCEL_ORDER",
"payload": {
"order_id": 55
},
"created_at": "2026-06-09T09:25:00Z"
}
]
}

### Логика обработки

1. Отсортировать actions по created_at (порядок важен)
2. Выполнять каждый action последовательно
3. Если один action упал — не останавливать весь sync,
   записать в failed и продолжить следующий
4. CREATE_ORDER возвращает новый id созданного заказа

### Response 200 — строго такая структура:

{
"synced": 3, // количество успешно применённых actions
"failed": [ // пустой массив если всё ок
{
"action_index": 1,
"type": "ADD_ITEM_TO_ORDER",
"error": "Order 55 not found"
}
],
"created_order_ids": [61] // id заказов созданных через CREATE_ORDER
}

### Идемпотентность для CREATE_ORDER

Если уже есть заказ с тем же table_id созданный в течение
±60 секунд от created_at из payload — не создавать дубль,
вернуть существующий id.

---

## URLs

# cafe/urls.py

path('offline-snapshot/', CafeOfflineSnapshotView.as_view()),
path('offline-sync/', CafeOfflineSyncView.as_view()),

---

## Требования к безопасности

- Все запросы фильтровать по company из request.user
- Нельзя получить/изменить данные чужой компании

## Что НЕ менять

- Существующие эндпоинты кафе
- Существующие модели и миграции
- Существующие сериализаторы

### update exe

## Задача

Создать один эндпоинт для системы автообновления десктопного клиента NurCRM.

---

## Эндпоинт — GET /api/version/

### Авторизация

Без авторизации — публичный эндпоинт.
(exe обращается до логина пользователя)

### Что делает

Возвращает актуальную версию клиента и ссылку на скачивание ZIP.

### Response 200

{
"version": "1.0.0",
"zip_url": "https://app.nurcrm.kg/downloads/NurCRM-1.0.0.zip",
"release_notes": "Первый релиз"
}

### Где хранить данные

Не в БД — просто в настройках Django (settings.py или отдельный файл конфига):

# settings.py

CLIENT_VERSION = "1.0.0"
CLIENT_ZIP_URL = "https://app.nurcrm.kg/downloads/NurCRM-1.0.0.zip"
CLIENT_RELEASE_NOTES = "Первый релиз"

### View

class ClientVersionView(APIView):
permission_classes = [] # публичный

    def get(self, request):
        return Response({
            "version": settings.CLIENT_VERSION,
            "zip_url": settings.CLIENT_ZIP_URL,
            "release_notes": settings.CLIENT_RELEASE_NOTES,
        })

### URL

path('version/', ClientVersionView.as_view()),

---

## Папка для хранения ZIP файлов

Настроить раздачу статики чтобы файлы из /var/www/downloads/
были доступны по https://app.nurcrm.kg/downloads/NurCRM-*.zip

Через Nginx (добавить в конфиг):
location /downloads/ {
alias /var/www/downloads/;
}

---

## Процесс выкатки новой версии

1. Положить NurCRM-1.0.1.zip в /var/www/downloads/
2. Обновить CLIENT_VERSION и CLIENT_ZIP_URL в settings.py
3. Перезапустить Django

Всё — клиенты при следующем запуске exe получат обновление автоматически.
