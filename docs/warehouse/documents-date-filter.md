# Фильтр по датам в списке документов склада

## Задача
`/crm/warehouse/documents/:docType` — фильтрация списка по периоду.

## Контракт API
`GET /warehouse/documents/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` (+ существующие `doc_type`, `search`, `page`, ...).
- Границы включительные; фильтр по дате документа (`date`, при её отсутствии — `created_at`).
- Любой из параметров можно не передавать.
- Для `doc_type=COMMERCIAL_OFFER` (отдельный эндпоинт) — те же параметры.

## Чек-лист приёмки
- [ ] Бэк принимает `date_from` / `date_to` и корректно работает с пагинацией (`count`)
- [ ] Фронт сбрасывает страницу на 1 при смене дат; значения запоминаются по типу документа

## Фронт
- [Documents.jsx](../../src/Components/Sectors/Warehouse/Documents/Documents.jsx)
