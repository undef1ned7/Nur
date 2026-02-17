# Building permissions (CRM)

Этот файл описывает **permissions (поля профиля пользователя)**, которые фронтенд использует для доступа к страницам строительного раздела CRM.

## Как фронтенд проверяет доступ

- Frontend ожидает, что в объекте профиля пользователя (`profile`) придут булевы поля с ключами permissions.
- Проверка: доступ есть, если `profile[permission] === true`.
- Дополнительно (если используется политика на уровне компании) фронт может разрешать/запрещать доступ через поля в объекте компании: см. `src/Components/Sidebar/hooks/useMenuPermissions.js` (логика `companyAllows`/`isAllowed`).

## Карта permissions → страниц

Ниже перечислены ключи, которые используются в меню Building (`src/Components/Sidebar/config/menuConfig.js`, блок `sector.building`) и/или в роутинге.

| Permission key | CRM route | Что открывает в UI | Примечание |
|---|---|---|---|
| `can_view_building_analytics` | `/crm/building/analytics` | Аналитика | пункт меню Building |
| `can_view_building_cash_register` | `/crm/building/cash-register` | Касса | пункт меню Building |
| `can_view_building_clients` | `/crm/building/clients` | Клиенты | пункт меню Building |
| `can_view_building_department` | `/crm/building/department` | Отделы | пункт меню Building |
| `can_view_building_employess` | `/crm/building/employess` | Сотрудники | **ключ содержит опечатку** `employess` (как в проекте) |
| `can_view_building_notification` | `/crm/building/notification` | Уведомления | пункт меню Building |
| `can_view_building_procurement` | `/crm/building/procurement` | Закупки | пункт меню Building |
| `can_view_building_projects` | `/crm/building/projects` | Проекты | пункт меню Building |
| `can_view_building_salary` | `/crm/building/salary` | Зарплата | пункт меню Building |
| `can_view_building_sell` | `/crm/building/sell` | Продажи | пункт меню Building |
| `can_view_building_stock` | `/crm/building/stock` | Склад | пункт меню Building |
| `can_view_building_treaty` | `/crm/building/treaty` | Договора | пункт меню Building |
| `can_view_building_work_process` | `/crm/building/work` | Процесс работы | используется в `routes.jsx`/breadcrumbs |
| `can_view_building_objects` | `/crm/building/objects` | Квартиры/Объекты | используется в `routes.jsx`/breadcrumbs |

## Пример (фрагмент) профиля пользователя

```json
{
  "can_view_building_analytics": true,
  "can_view_building_cash_register": true,
  "can_view_building_clients": true,
  "can_view_building_department": true,
  "can_view_building_employess": true,
  "can_view_building_notification": true,
  "can_view_building_procurement": true,
  "can_view_building_projects": true,
  "can_view_building_salary": true,
  "can_view_building_sell": true,
  "can_view_building_stock": true,
  "can_view_building_treaty": true,
  "can_view_building_work_process": true,
  "can_view_building_objects": true
}
```

