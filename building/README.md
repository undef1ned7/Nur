# Nur Строй

Отдельное приложение строительной сферы NurCRM, выделенное из монолита `Nur`.

## Запуск

```bash
cd building
npm install
npm run dev
```

Приложение откроется на `http://localhost:3001`.

## Авторизация

Используется тот же backend NurCRM (`https://app.nurcrm.kg/api`).

- `/login` — вход
- `/register` — регистрация (только строительные сферы: строительная компания, ремонт, архитектура)

Переменная окружения (опционально):

```bash
VITE_API_URL=https://app.nurcrm.kg/api
```

## Структура

| Путь | Описание |
|------|----------|
| `src/Components/pages/Building/` | UI-модули сферы (аналитика, касса, клиенты, ЖК, склад, договора и др.) |
| `src/store/slices/building/` | Redux-слайсы (18 шт.) |
| `src/store/creators/building/` | Async-thunk creators для API |
| `src/api/building.js` | API кассы, рассрочек, авансов |
| `src/config/routes/` | Маршруты `/building/*` |

## Маршруты

- `/building/analytics` — Аналитика
- `/building/cash-register` — Касса
- `/building/clients` — Клиенты, поставщики, подрядчики
- `/building/employees` — Сотрудники
- `/building/notification` — Напоминания
- `/building/procurement` — Закупки
- `/building/projects` — Жилые комплексы
- `/building/drawings` — Проекты (чертежи)
- `/building/salary` — Зарплата
- `/building/sell` — Продажи квартир
- `/building/stock` — Склад
- `/building/treaty` — Договора
- `/building/work` — Строительные отделы

## Что перенесено из основного проекта

- Полный модуль `pages/Building` (94 файла)
- Redux-слой building (слайсы + creators)
- Общие компоненты: Modal, DataContainer, RouteFallback
- API-слой, авторизация, department/user slices
- Конфигурация меню и прав доступа

## Сборка

```bash
npm run build
```
