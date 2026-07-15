# Склад — Агент: несколько складов общего доступа

Контракт бэкенда (июль 2026, реализовано). При `common_access_enabled=true`
владелец назначает агенту **несколько** складов через `common_warehouses`
(массив uuid). Legacy `common_warehouse` (один склад) работает как раньше.

## Эндпоинты (пути не менялись; только владелец/админ)

- `POST /warehouse/agents/company-memberships/` — прямое назначение агента (обязателен `user`)
- `PATCH /warehouse/agents/company-requests/{id}/common-access/` — смена складского доступа

## Тело запроса

```json
{
  "common_access_enabled": true,
  "common_warehouses": ["uuid", "uuid"],
  "can_sell_wholesale": true,
  "can_sell_without_approval": false
}
```

Правила разрешения набора:
1. передан `common_warehouses` → берётся он;
2. иначе передан `common_warehouse` → список из одного;
3. ничего не передано → текущий набор агента не меняется;
4. `common_access_enabled=false` → набор очищается.

`common_access_enabled=true` с пустым `common_warehouses` → 400.
Склад чужой компании → 400. `assigned_warehouse` на набор больше не влияет
(ограничение «общий доступ только к назначенному складу» снято).

## Ответ

`common_warehouses` — полный набор; `common_warehouse` — первый из набора (legacy).

## На что влияет

- `GET /warehouse/agents/my/products/` — товары со **всех** складов набора,
  `warehouse_id` в строке показывает склад позиции.
- Продажа с общего остатка разрешена, если склад входит в набор.

## Фронт (сделано, июль 2026)

- Таб «Активные агенты» (`Agents.jsx`): колонка «Склады общего прайса» —
  мультивыбор (details-дропдаун), PATCH шлёт `common_warehouses`;
  пустой набор = `common_access_enabled=false`.
- Legacy-агенты с одним складом читаются через fallback `common_warehouse`.
