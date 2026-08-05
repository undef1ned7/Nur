# ТЗ: исправление багов сферы «Маркет» (бэкенд + фронт)

| Поле | Значение |
|------|----------|
| **Версия** | 1.0 |
| **Дата** | 5 августа 2026 |
| **Источник бэк-аудита** | `MARKET_BUGS_REPORT.md` (4 августа 2026) — модуль `apps/main` |
| **Источник фронт-аудита** | NurFront: `src/Components/Sectors/Market/`, `src/Components/pages/Sell/`, store/thunks |
| **Цель** | Закрыть все дефекты учёта, безопасности и UX; сделать сценарии кассы, долгов, склада, агента и инвентаризации рабочими и удобными |
| **Связанные документы** | [cashier-settings.md](./cashier-settings.md), [scales-weight-products.md](./scales-weight-products.md), [analytics.md](./analytics.md), [bulk_update_products.md](./bulk_update_products.md) |

---

## Оглавление

1. [Цель и границы](#1-цель-и-границы)
2. [Сводка дефектов](#2-сводка-дефектов)
3. [Аудит бэкенда (подробно)](#3-аудит-бэкенда-подробно)
4. [Аудит фронтенда (подробно)](#4-аудит-фронтенда-подробно)
5. [Матрица соответствия BE ↔ FE](#5-матрица-соответствия-be--fe)
6. [Общие требования](#6-общие-требования)
7. [Этап A — P0: безопасность и деньги](#7-этап-a--p0-безопасность-и-деньги)
8. [Этап B — P1: остатки и стабильность API](#8-этап-b--p1-остатки-и-стабильность-api)
9. [Этап C — P2: UX и надёжность](#9-этап-c--p2-ux-и-надёжность)
10. [UX-требования «до мелочей»](#10-ux-требования-до-мелочей)
11. [Контракты API (ожидаемые)](#11-контракты-api-ожидаемые)
12. [Файлы для правок](#12-файлы-для-правок)
13. [Порядок внедрения и зависимости](#13-порядок-внедрения-и-зависимости)
14. [Тест-план](#14-тест-план)
15. [Миграция данных и регресс](#15-миграция-данных-и-регресс)
16. [Критерии приёмки (DoD)](#16-критерии-приёмки-dod)
17. [Оценка трудозатрат](#17-оценка-трудозатрат)
18. [Вне объёма / отложено](#18-вне-объёма--отложено)
19. [Чеклист релиза](#19-чеклист-релиза)

---

## 1. Цель и границы

### 1.1. Цель

Исправить все выявленные дефекты сферы **Маркет** на бэкенде (`apps/main`) и фронтенде (NurFront), чтобы:

- нельзя было создать «висячий» долг без клиента;
- нельзя было обойти PIN при удалении чеков (одиночном и массовом);
- агент и кассир получали понятные ошибки вместо 500;
- весовые остатки и инвентаризация сохраняли точность до грамма (3 знака);
- движения склада по инвентаризации были видны в журнале;
- оплата рассрочки/долга кассиром работала по сделкам филиала без рассинхрона кассы;
- после успешного checkout UI всегда завершал сценарий (даже если вторичная запись долга упала);
- окружения (dev/staging/prod) не ломались из‑за хардкода URL.

### 1.2. В объёме

| Слой | Путь / модуль |
|------|----------------|
| Backend | `apps/main`: POS checkout, agent POS, inventory apply, stock movements, finished→raw cancel, deals pay, sales bulk-delete, product bulk-update, mobile scanner urls |
| Frontend Market | Касса, история продаж, склад/инвентаризация, документы, клиенты/долги, аналитика |
| Frontend Sell (legacy/общий) | `pages/Sell` — история, bulk-delete, PaymentPage |
| Frontend Agent | `Production/ProductionAgents/SellStart`, `agentCartCreators` |
| Store / API | `saleThunk.js`, `agentCartCreators.js`, `marketCashierSettings`, `api` instance |

### 1.3. Вне объёма (на этом этапе)

- Полный redesign кассы / новый UI-kit.
- Отдельное мобильное приложение агента (кроме web-flow SellStart).
- UI мобильного сканера **до** появления рабочего BE-маршрута (см. §18).
- Исправление багов других секторов (cafe, building и т.д.), если не пересекаются с Market API.
- Force-push / массовая чистка БД без согласованного скрипта миграции висячих долгов.

---

## 2. Сводка дефектов

### 2.1. Бэкенд (`MARKET_BUGS_REPORT`)

| № | Модуль / API | Серьёзность | Тип |
|---|--------------|-------------|-----|
| **BE-1** | POS Checkout `.../checkout/` — debt без клиента | 🔴 Критическая | Бизнес-логика / потеря данных |
| **BE-2** | `checkout_agent_cart` — нет кассы → 500 | 🔴 Критическая | Unhandled ValidationError |
| **BE-3** | Inventory apply — quantize `0.01` | 🟠 Высокая | Потеря точности |
| **BE-4** | Inventory apply — нет `StockMovement` | 🟠 Высокая | Отсутствие аудита |
| **BE-5** | Finished→raw cancel — `DoesNotExist` → 500 | 🟠 Высокая | Unhandled exception |
| **BE-6** | Deals pay — фильтр по salesperson → 404 кассиру | 🟡 Средняя | Права / UX |
| **BE-7** | COGS / `purchase_price_snapshot = 0` | 🟡 Средняя | Аналитика |
| **BE-8** | `MobileScannerIngestAPIView` не в `urls.py` | 🟡 Средняя | Мёртвый эндпоинт |
| **BE-9** | Sales bulk-delete без PIN | 🔴 Критическая | Безопасность |
| **BE-10** | Product bulk-update — формат ошибок | 🟢 Низкая | API-контракт |

### 2.2. Фронтенд (аудит NurFront)

| № | Модуль | Серьёзность | Тип |
|---|--------|-------------|-----|
| **F1** | `Sell.jsx` bulk-delete: нет PIN + хардкод prod URL | 🔴 Критическая | Безопасность / окружения |
| **F2** | PaymentPage: dual-write долга; на «Старт» `return` обрывает success | 🔴 Критическая | Потеря UX / рассинхрон долга |
| **F3** | `DebtModal`: cashflow без await оплаты сделки | 🔴 Критическая | Рассинхрон кассы и долга |
| **F4** | Гард клиента на отсрочке только UI | 🟠 Высокая | Обход через API |
| **F5** | `InventoryModal`: clamp до 2 знаков | 🟠 Высокая | Усиливает BE-3 |
| **F6** | Журнал движений склада мёртв / неверный API | 🟠 Высокая | Нет аудита в UI |
| **F7** | Agent checkout: нет preflight кассы | 🟠 Высокая | Плохой UX при BE-2 |
| **F8** | `DebtPaymentModal`: N+1, общие ошибки | 🟡 Средняя | UX / perf |
| **F9** | Sell PaymentPage: нет in-flight lock | 🟡 Средняя | Double checkout |
| **F10** | Ошибки cashflow/предоплаты глотаются | 🟡 Средняя | Тихий рассинхрон |
| **F11** | `ReceiptsModal`: слабые ошибки, лимит 200 | 🟡 Средняя | UX |
| **F12** | `MovementHistory`: фильтры/API не работают | 🟡 Средняя | Мёртвый UI |
| **F13** | Finished→raw cancel: ок plumbing, сырой 500 | 🟡 Средняя | Зависит от BE-5 |
| **F14** | Bulk-update: только alert, без полей | 🟢 Низкая | UX ошибок |
| **F15** | Нет UI mobile-scanner | 🟢 Низкая | Фича не подключена |
| **F16** | `deleteSale` thunk без `delete_code` | 🟡 Средняя | Согласованность PIN |
| **F17** | Хардкод `https://app.nurcrm.kg` | 🟠 Высокая | Dev/staging |
| **F18** | COGS warning только в аналитике | 🟢 Низкая | Data quality UX |

---

## 3. Аудит бэкенда (подробно)

### BE-1. Долг без клиента при checkout

- **Файлы (бэк):** `apps/main/pos_serializers.py` (~458–526), `apps/main/pos_views.py` (~2535–2591).
- **Симптом:** `POST /api/main/pos/sales/<cart_id>/checkout/` с `{"payment_method": "debt"}` и без `client_id` → `201`, `Sale(status='debt', client=None)`.
- **Почему критично:** продажа списана со склада, долг не попадет в `/clients/with-debts/` и сверку.
- **Причина:** в `CheckoutSerializer.validate()` нет проверки клиента для `debt` (и для строк `payments[]` с method `debt`).
- **Исправление:**
  ```python
  # псевдокод
  if payment_method == Sale.PaymentMethod.DEBT or any(p.method == "debt" for p in payments):
      if not client_id:
          raise ValidationError({"client_id": "При продаже в долг выбор клиента обязателен."})
  ```
- **Также проверить:** agent checkout, split-оплаты с частью debt.

### BE-2. Agent checkout → 500 без кассы

- **Файлы:** `apps/main/services_agent_pos.py` (~252–263), `apps/main/models.py` `Sale.clean()` (~2175–2182).
- **Симптом:** `Sale(shift=None)` + `_resolve_cashbox() → None` → `full_clean()` → необработанный `django.core.exceptions.ValidationError` → HTTP 500.
- **Исправление:** до `Sale.objects.create` проверить cashbox; Django `ValidationError` мапить в DRF `serializers.ValidationError` → HTTP 400  
  `{"cashbox": "Нет доступной кассы. Создайте кассу для филиала."}` (или `cashbox_id`).

### BE-3. Округление инвентаризации до 0.01

- **Файл:** `apps/main/inventory_views.py` (~122–128).
- **Симптом:** `qf = Decimal(...).quantize(Decimal("0.01"))` — `12.345` → `12.35`.
- **Исправление:** `quantize(Decimal("0.001"))` или общая утилита `qty3()` / `decimal_places` поля `Product.quantity`.
- **Регрессия:** штучные товары с целыми количествами не должны ломаться (хвостовые нули допустимы в БД).

### BE-4. Нет StockMovement при apply инвентаризации

- **Файл:** `apps/main/inventory_views.py` (~103–142).
- **Симптом:** `Product.quantity` меняется, записей в `StockMovement` нет.
- **Исправление:** для каждой строки с `change = qf - qb != 0` вызывать `record_stock_movement(...)` с типом `INVENTORY` / `RECONCILIATION`, user, session id, comment.

### BE-5. Cancel finished→raw → 500

- **Файл:** `apps/main/views.py` (~4915–4923).
- **Симптом:** `ItemMake.objects.select_for_update().get(pk=...)` → `DoesNotExist` → 500.
- **Исправление:** `filter(...).first()` / try-except → `400` или `404`  
  `{"detail": "Запись сырья не найдена."}`.

### BE-6. Кассир не может оплатить чужую сделку

- **Файл:** `apps/main/views.py` (~2967–2968, ~3080–3081).
- **Симптом:** `deal_qs.filter(client__salesperson=request.user)` → кассир получает **404**.
- **Исправление (продуктовое решение):**
  - Роли `cashier`, `employee` (и при необходимости `owner`/`admin`) филиала/компании видят и оплачивают сделки клиентов **своего филиала/компании**.
  - Персональный менеджер — без ограничений своих клиентов.
  - При реальном запрете — **403** с текстом, не 404 (чтобы фронт отличил «нет прав» от «не найдено»).

### BE-7. COGS = 0

- **Файлы:** `apps/main/services/__init__.py` (~117), `models.py` SaleItem (~2406–2430).
- **Симптом:** `bulk_create` не вызывает `save()`; пустой `purchase_price` → snapshot `0.00` → маржа 100% в аналитике.
- **Исправление (минимум):**
  - при оприходовании/создании товара валидировать/предупреждать пустую закупочную;
  - в аналитике уже есть/расширить `cogs_warning`;
  - опционально: при checkout подтягивать актуальный `purchase_price` и не писать 0 без явного флага.

### BE-8. Mobile scanner не в urls

- **Файлы:** `pos_views.py` `MobileScannerIngestAPIView`, `urls.py`.
- **Исправление:** добавить  
  `path("pos/sales/mobile-scanner/ingest/", MobileScannerIngestAPIView.as_view())`  
  **или** удалить мёртвый view, если фича отложена. Решение зафиксировать в релизе.

### BE-9. Bulk-delete без PIN

- **Файлы:** `pos_views.py` `SaleBulkDeleteAPIView` (~3356–3420 / ~3494–3575).
- **Симптом:** при `require_code_for_deletion` одиночное удаление требует код, bulk — нет.
- **Исправление:** читать `MarketCashierSettings` / аналог; требовать `delete_code` в теле; та же проверка, что у VerifyDeleteCode / одиночного delete.
- **Связь с фронтом:** см. [cashier-settings.md](./cashier-settings.md).

### BE-10. Формат ошибок bulk-update

- **Файл:** `views.py` `ProductBulkUpdateAPIView` (~2168–2195).
- **Симптом:** `{"detail": "Бренд «имя» не найден"}` вместо `{"brand_name": ["Бренд не найден"]}`.
- **Исправление:** стандартные field-errors DRF.

---

## 4. Аудит фронтенда (подробно)

### F1. Bulk-delete без PIN + хардкод URL

- **Файл:** `src/Components/pages/Sell/Sell.jsx` (~583–655), UI массового удаления (~793+).
- **Сейчас:**
  ```js
  fetch("https://app.nurcrm.kg/api/main/sales/bulk-delete/", {
    body: JSON.stringify({ ids, allow_paid: allowPaid }),
  })
  ```
  - нет `delete_code`;
  - всегда production host;
  - мимо axios (`api`) → нет refresh interceptors.
- **Нужно:**
  1. Если настройки кассы требуют код — показать `DeleteCodeModal` / переиспользовать логику `ensureDeleteCode` / `verifyDeleteCode` из `useMarketCashierSettings`.
  2. `api.post("/main/sales/bulk-delete/", { ids, allow_paid, delete_code })`.
  3. Обработать 400 по `delete_code` и по `paid_ids` (как сейчас).
  4. То же для «удалить всё» / clear-all, если есть.

### F2. Dual-write долга и обрыв success на «Старт»

- **Файлы:**
  - `src/Components/Sectors/Market/CashierPage/PaymentPage.jsx` (~549–622);
  - `src/Components/pages/Sell/Cashier/PaymentPage.jsx` (~365–431).
- **Сейчас (Market):** после успешного `productCheckout` создаётся `/main/debts/` (тариф «Старт») и/или `createDeal`. При ошибке «Старт»:
  ```js
  showAlert("warning", ...);
  return; // ← обрывает success modal / onComplete / очистку корзины
  ```
- **Последствие:** продажа в долг уже в БД, кассир остаётся на экране оплаты, долг может отсутствовать.
- **Нужно:**
  1. **Никогда** не делать `return` после успешного checkout — только warning.
  2. Всегда показывать success / вызывать `onComplete` / закрывать корзину.
  3. Сохранять контекст для retry: `clientId`, `amount`, `due_date`, `saleId` (если есть в ответе).
  4. UI: «Создать запись долга повторно».
  5. Долгосрочно — атомарность на бэке (checkout создаёт deal в одной транзакции).

### F3. DebtModal: cashflow без успешной оплаты

- **Файл:** `src/Components/Sectors/Market/ClientDetails/components/DebtModal.jsx` (~658–681).
- **Сейчас:**
  ```js
  onPayDeal(paymentData); // не await
  dispatch(addCashFlows({ ... })); // сразу
  ```
- **Эталон:** `DebtPaymentModal` (касса) — сначала await pay, потом cashflow.
- **Нужно:**
  ```js
  onConfirm: async () => {
    try {
      setPaying(true);
      await onPayDeal(paymentData); // или unwrap thunk
      await dispatch(addCashFlows(...)).unwrap();
      // очистить amount, закрыть dialog, refresh
    } catch (e) {
      showAlert/error через validateResErrors;
      // cashflow НЕ создавать
    } finally {
      setPaying(false);
    }
  }
  ```
- Маппинг ошибок: 403/404 → понятный текст про права (до/после BE-6).

### F4. Гард клиента только на UI

- **Файлы:** Market/Sell `PaymentPage` (~396–404 / ~250–257); `saleThunk.js` `productCheckout` (~325–328): `client_id` не уходит, если falsy.
- **Сейчас:** UI блокирует deferred без клиента — хорошо для happy path.
- **Нужно:** оставить гард; кнопка Accept `disabled` при deferred без клиента; BE-1 обязателен.

### F5. Инвентаризация: 2 знака на фронте

- **Файл:** `src/Components/Sectors/Market/Warehouse/components/InventoryModal.jsx` (~22–28, inputs ~284+).
- **Сейчас:** комментарий «бэкенд принимает максимум 2 цифры»; `clampToTwoDecimals`; `step="0.01"`.
- **Нужно (после BE-3):** `clampToThreeDecimals` / `qty3`; `step="0.001"`; для штучных — по желанию step 1, но хранение 3 знака ок.
- Согласовать с [scales-weight-products.md](./scales-weight-products.md).

### F6 / F12. Журнал движений

- **Файлы:**
  - `Warehouse/components/MovementHistory.jsx` — `/main/warehouse/history/`, дата-фильтр без пикера;
  - `ProductDetail.jsx` — блок истории закомментирован;
  - эталон: `Production/Warehouse/ProductionMovementsTab.jsx` → `GET /main/stock-movements/`.
- **Нужно:** единый журнал на `/main/stock-movements/` с фильтрами product/date/type; показывать движения `INVENTORY` после BE-4.

### F7. Agent: нет preflight кассы

- **Файлы:** `agentCartCreators.js` checkout; `SellStart.jsx` (~2491+).
- **Нужно:** перед checkout убедиться, что касса есть (если API отдаёт); показать 400-сообщение; не оставлять «Неизвестная ошибка» на 500.

### F8–F11, F14, F16–F18

См. этапы C в §9. Кратко:

| ID | Действие |
|----|----------|
| F8 | Меньше N+1 в `DebtPaymentModal`; disable Pay; тексты прав |
| F9 | `payingInFlightRef` + disable на Sell PaymentPage |
| F10 | `showAlert` при ошибке cashflow/prepay после успеха продажи |
| F11 | Ошибка загрузки чеков; пагинация; меньше client-only фильтров |
| F14 | После BE-10 — field errors в BulkEditModal |
| F16 | Прокинуть `delete_code` в thunks удаления продаж/корзин, где требует BE |
| F17 | Убрать все хардкоды prod URL в Market/Sell delete-flow |
| F18 | Warning при оприходовании без закупочной цены |

---

## 5. Матрица соответствия BE ↔ FE

| BE | FE | Совместная поставка |
|----|----|---------------------|
| BE-1 | F4 | BE validate + UI disabled/alert |
| BE-2 | F7 | 400 + preflight/текст |
| BE-3 | F5 | 0.001 на обоих слоях |
| BE-4 | F6, F12 | record + UI journal |
| BE-5 | F13 | 400 detail + уже есть validateResErrors |
| BE-6 | F3, F8 | права кассира + await pay/cashflow |
| BE-7 | F18 | warning + аналитика |
| BE-8 | F15 | сначала urls, потом UI (или отложить оба) |
| BE-9 | F1, F16 | PIN на bulk + api client |
| BE-10 | F14 | field-errors + подсветка |

Отдельные FE-only: **F2** (success path), **F9**, **F10**, **F11**, **F17**.

---

## 6. Общие требования

### 6.1. Код и стиль

- Комментарии и UI-тексты — на русском (как в проекте).
- Фронт: использовать `api` из `src/api`, `validateResErrors`.
- Не добавлять хардкод `https://app.nurcrm.kg`.
- Не логировать PIN/коды удаления в console.
- Не коммитить `.env` / секреты.

### 6.2. Ошибки API

| HTTP | Когда | Тело (пример) |
|------|-------|----------------|
| 400 | Валидация | `{"client_id": ["…"]}` или `{"delete_code": ["…"]}` |
| 403 | Нет прав | `{"detail": "Недостаточно прав для оплаты этой сделки."}` |
| 404 | Объект реально не найден | `{"detail": "…"}` |
| 500 | Только непредвиденное | не использовать для бизнес-ошибок |

### 6.3. Идемпотентность

- Оплата сделки: сохранять `idempotency_key` (уже есть в DebtModal).
- Checkout: защита от double-submit на UI (ref + disable); на BE — существующие гарантии корзины не ослаблять.

### 6.4. Роли (целевая модель для Маркета)

| Действие | owner/admin | cashier/employee филиала | salesperson |
|----------|-------------|--------------------------|-------------|
| Checkout debt | да + клиент | да + клиент | да + клиент |
| Удаление чека (PIN вкл.) | код или bypass по политике | код обязателен | по правам + код |
| Bulk-delete | то же | то же | то же |
| Pay deal любого клиента филиала | да | **да (после BE-6)** | свои + по политике |
| Inventory apply | по правам склада | по правам | по правам |
| Agent checkout | — | агент своего филиала + касса | — |

Точную матрицу bypass PIN для owner согласовать с [cashier-settings.md](./cashier-settings.md) (не ломать `can_view_market_delete_cart_item`).

---

## 7. Этап A — P0: безопасность и деньги

### 7.1. A1 — PIN на bulk-delete (BE-9 + F1)

#### Backend

1. В `SaleBulkDeleteAPIView.post`:
   - загрузить настройки кассы компании;
   - если код удаления **задан** / `require_code_for_deletion` / аналог из cashier-settings:
     - требовать поле `delete_code` (string);
     - сверить через тот же сервис, что `VerifyDeleteCodeAPIView`;
     - при отсутствии/неверном коде → `400 {"delete_code": ["Неверный или отсутствующий код подтверждения."]}`;
   - если код в настройках пуст — поведение как сейчас (без кода), **согласованно** с одиночным delete.
2. Не ослаблять проверку `allow_paid` / список `paid_ids`.
3. Логировать факт массового удаления (кто, сколько id) — желательно.

#### Frontend

1. В `Sell.jsx` заменить `fetch` на:
   ```js
   await api.post("/main/sales/bulk-delete/", {
     ids: [...],
     allow_paid: boolean,
     delete_code: code || undefined,
   });
   ```
2. Перед запросом:
   - определить, нужен ли код (`useMarketCashierSettings.deleteCodeRequired` или GET settings);
   - если да — модалка ввода (переиспользовать `DeleteCodeModal`);
   - опционально: сначала `verifyDeleteCode`, потом bulk (или один запрос с кодом — как решит BE; предпочтительно **один** запрос с `delete_code`, чтобы не было TOCTOU).
3. UX-последовательность:
   1. Пользователь жмёт «Удалить выбранные».
   2. Confirm: «Удалить N чеков?»
   3. Если нужен PIN → модалка.
   4. Запрос; если `paid_ids` → второй confirm → повтор с `allow_paid: true` **и тем же** `delete_code`.
   5. Success alert; сброс selection; reload списка.
4. Ошибки:
   - неверный код → подсветка поля в модалке, чеки не удалять;
   - сеть → `validateResErrors`.
5. Найти и исправить другие вызовы bulk-delete продаж с хардкодом URL (grep `sales/bulk-delete`, `app.nurcrm.kg`).

#### Приёмка A1

- [ ] При включённом коде bulk без кода → 400, UI не чистит список.
- [ ] С верным кодом → удаление.
- [ ] Dev/staging бьёт в свой `VITE_API_URL`, не в prod.
- [ ] Одиночное удаление по-прежнему работает.

---

### 7.2. A2 — Долг только с клиентом (BE-1 + F4)

#### Backend

1. `CheckoutSerializer.validate()`:
   - debt method / debt в `payments[]` → обязателен `client_id`;
   - сообщение на русском в `client_id`.
2. Аналогично agent checkout serializer/service.
3. Unit/API-тест: без client → 400; с client → 201.

#### Frontend

1. Оставить существующие `showAlert` при deferred без клиента.
2. Кнопка «ПРИНЯТЬ ОПЛАТУ» / аналог: `disabled={paymentMethod === "deferred" && !selectedCustomer?.id}` (+ spinner при in-flight).
3. Визуально: блок выбора клиента подсветить / scroll into view при попытке оплаты.
4. При 400 `client_id` с сервера — показать текст поля.

#### Данные (подзадача A2-data)

1. SQL/admin-отчёт: `Sale` где status/payment debt и `client_id IS NULL`.
2. Экспорт для владельца; ручная привязка или списание — **не** автоматом без согласования.
3. Документировать в релизе.

#### Приёмка A2

- [ ] API без client_id → 400.
- [ ] UI без клиента → нельзя завершить.
- [ ] С клиентом → sale + дальнейший debt/deal flow.

---

### 7.3. A3 — Завершение сценария после checkout + долг (F2, желательно BE)

#### Backend (предпочтительно, можно фазой 2)

- Вариант **A3-BE-atomic:** checkout с `payment_method=debt` в одной транзакции создаёт Deal (или Debt для «Старт») по полям:
  - `client_id`, `debt_days` / `first_due_date`, `prepayment` / `cash_received`.
- Если создание deal падает — **rollback** всей продажи (или явная компенсация) — продукт выбирает: либо всё атомарно, либо sale commit + outbox.  
  **Рекомендация ТЗ:** атомарно для нового контракта; пока FE чинит UX.

#### Frontend (обязательно в первой поставке)

1. Удалить `return` после ошибки создания долга на «Старт» в Market и Sell PaymentPage.
2. Единый блок post-checkout:
   ```
   checkout OK
   → try create debt/deal
   → if fail: warning + сохранить retryPayload
   → always: success modal / onComplete / clear cart / print if needed
   ```
3. Retry: кнопка в warning или на success modal «Повторить создание долга».
4. Не создавать дубликаты deal при повторном успехе (BE должен быть идемпотентен по `sale_id` если передан — желательно).
5. Тексты:
   - «Оплата оформлена, но не удалось создать запись о долге. Продажа уже сохранена.»
   - «Попробуйте создать долг ещё раз или обратитесь к администратору.»

#### Приёмка A3

- [ ] Forced fail `/main/debts/` или `createDeal` → кассир видит success + warning, корзина закрыта.
- [ ] Retry создаёт долг.
- [ ] Нет «залипания» на PaymentPage.

---

### 7.4. A4 — Оплата сделки и cashflow (BE-6 + F3 + F8)

#### Backend

1. Ослабить фильтр `client__salesperson=request.user` для pay (и get deal detail, если нужно для кассы):
   - разрешить `cashier` / `employee` в рамках company/branch;
   - 403 вместо 404 при запрете.
2. Тесты ролей.

#### Frontend DebtModal

1. `await` оплаты; cashflow только после успеха.
2. Loading на кнопке; блокировка повторного confirm.
3. Ошибки через `validateResErrors` + спец. текст для 403.
4. При ошибке cashflow после успешного pay — отдельный warning «Оплата долга прошла, но не записалась в кассу» + не откатывать pay на клиенте (данные уже на сервере).

#### Frontend DebtPaymentModal

1. Тексты прав; disable in-flight.
2. Оптимизация загрузки долгов (агрегат `with-debts`, без N запросов на каждого клиента, если API позволяет).

#### Приёмка A4

- [ ] Кассир оплачивает сделку клиента другого менеджера того же филиала → 200.
- [ ] При падении pay cashflow **не** создаётся.
- [ ] При падении cashflow после pay — warning, долг на сервере погашен.

---

## 8. Этап B — P1: остатки и стабильность API

### 8.1. B1 — Точность 0.001 (BE-3 + F5)

#### Backend

- Заменить все `quantize(Decimal("0.01"))` в inventory apply (и связанных write-off/surplus) на `0.001`.
- Проверить сериализаторы линий инвентаризации (принимают 3 знака).

#### Frontend

- `InventoryModal.jsx`: переименовать/заменить clamp; `step="0.001"`; inputMode decimal.
- `InventorySessionsTab.jsx`: если есть ручной ввод fact — та же точность.
- Отображение остатков: не округлять до 2 в UI для весовых (`formatStock` — проверить).

#### Приёмка

- [ ] Ввод 12.345 → в БД 12.345 после apply.
- [ ] Штучный товар 5 → 5 (или 5.000 — без вреда).

### 8.2. B2 — StockMovement + журнал UI (BE-4 + F6 + F12)

#### Backend

- На apply для каждой изменённой строки — `record_stock_movement`.
- Поля: product, qty_before, qty_after, change, type, user, inventory_session_id, timestamp, note.

#### Frontend

1. Новый или починенный таб/модалка истории на `GET /main/stock-movements/` (как Production).
2. Фильтры: product_id, date_from, date_to, type.
3. Убрать/не использовать сломанный `/main/warehouse/history/` либо починить прокси на stock-movements.
4. В карточке товара показать последние движения.

#### Приёмка

- [ ] После apply в журнале есть строки инвентаризации с верным change.

### 8.3. B3 — Cancel finished→raw (BE-5 + F13)

#### Backend

- Нет raw item → 400/404 с `detail`.
- Не частичный откат в Mid-state: либо cancel целиком, либо ошибка до мутаций.

#### Frontend

- Убедиться, что `FinishedToRawModals.jsx` показывает `detail`.
- Кнопка cancel disabled while busy (уже есть — проверить).

### 8.4. B4 — Agent cashbox (BE-2 + F7)

#### Backend

- 400 с полем `cashbox` / `cashbox_id`.
- Не 500.

#### Frontend

- Preflight при открытии агентской продажи / перед checkout.
- Alert: «Нет доступной кассы. Создайте кассу в настройках филиала.»
- После фикса BE — отображать текст сервера.

---

## 9. Этап C — P2: UX и надёжность

### C1. Double-submit на Sell PaymentPage (F9)

- Добавить `payingInFlightRef` по образцу Market PaymentPage.
- `disabled={paying}` на кнопке Accept.
- Игнорировать повторный Enter.

### C2. Видимые ошибки cashflow/prepay (F10)

- Market PaymentPage: заменить `console.warn` на `showAlert("warning", ...)`.
- Не откатывать успешный checkout.

### C3. ReceiptsModal (F11)

- Показ ошибки загрузки.
- Пагинация / «загрузить ещё» вместо одного `page_size=200`.
- Фильтр по товару — по возможности серверный; иначе честный UX «ищем в загруженных».

### C4. DebtPaymentModal perf/UX (F8)

- См. A4; вынести в C, если не успели в A.

### C5. Bulk-update field errors (BE-10 + F14)

- BE: field dict.
- FE `BulkEditModal` / `Warehouse.jsx`: подсветка `brand_name`, `category_name` и т.д.

### C6. Mobile scanner (BE-8 + F15) — отдельный мини-релиз

1. BE: route в `urls.py` + тест.
2. FE: экран пары QR/token + ingest (только после BE).
3. До этого — не показывать пункт меню «Мобильный сканер», если его нет.

### C7. COGS / закупочная (BE-7 + F18)

- Warning в аналитике (уже есть `cogs_warning`) — сохранить.
- При приёмке товара/накладной без `purchase_price` — confirm «Себестоимость будет 0, маржа исказится».
- Опционально BE: запрет продажи в долг/вообще без себеса — **только** если продукт согласует (не включать молча).

### C8. delete_code в thunks (F16)

- Проверить `deleteSale` и пути удаления открытых корзин/чеков.
- Если BE требует код на API delete — прокинуть из CashierPage `ensureDeleteCode`.

### C9. Grep хардкодов URL (F17)

```bash
rg -n "app\\.nurcrm\\.kg" src/
```

- Заменить на `api` / `VITE_API_URL` во всех найденных Market/Sell критичных местах (как минимум delete/checkout).

---

## 10. UX-требования «до мелочей»

### 10.1. Касса — экран оплаты

| Элемент | Требование |
|---------|------------|
| Способ «Отсрочка / Долг» | Без клиента кнопка Accept disabled; под кнопкой серый хинт «Выберите клиента» |
| Выбор клиента | Обязателен до Accept; поиск по имени/телефону без зависаний |
| Срок долга | min 1 день; невалидное → warning, не уходить на API |
| Предоплата | сумма > 0 и ≤ total; для безнала — банк обязателен |
| In-flight | кнопка «Оплата…», повторный клик игнорируется |
| Успех | модалка успеха всегда после checkout OK |
| Частичный сбой долга | warning + retry, корзина закрыта |
| Ошибка checkout | остаёмся на PaymentPage, корзина жива, текст ошибки понятный |
| Принтер | как сейчас: без чека — не трогать принтер |

### 10.2. История продаж — удаление

| Элемент | Требование |
|---------|------------|
| Выбор чеков | чекбоксы + «выбрать все на странице» |
| Удалить | confirm с количеством |
| PIN | если включён — модалка до API; маска ввода; Enter = подтвердить |
| Оплаченные | отдельный confirm со списком id |
| Результат | «Удалено N» / ошибка кода без потери selection при fail кода |

### 10.3. Долги / сделки

| Элемент | Требование |
|---------|------------|
| Касса → погашение | список должников филиала; сумма; confirm |
| ClientDetails → взнос | await pay → cashflow; spinner |
| Нет прав | «Недостаточно прав…», не «Не найдено» |
| Успех | обновление остатка долга без перезагрузки всей страницы (или мягкий refresh) |

### 10.4. Инвентаризация

| Элемент | Требование |
|---------|------------|
| Ввод fact | до 3 знаков после запятой; `,` и `.` |
| Весовой hint | «Можно указать граммы, например 12.345» |
| Apply confirm | явное «Провести акт? Остатки изменятся» |
| Ошибка apply | черновик не теряется; текст ошибки |
| После успеха | тост + возможность открыть журнал движений |

### 10.5. Агент

| Элемент | Требование |
|---------|------------|
| Нет кассы | блокирующий баннер до checkout |
| Checkout 400 | текст с сервера |
| Долг | клиент обязателен (как на кассе) |

### 10.6. Общие мелочи

- Все алерты через существующие `showAlert` / модалки проекта — не сырой `window.alert` там, где уже есть design system (допустимо временно в Sell.jsx, но предпочтительно унифицировать).
- Не показывать технические stack traces пользователю.
- Кнопки деструктивные — красный/confirm.
- Loading-состояния на всех мутациях > 300ms.

---

## 11. Контракты API (ожидаемые)

### 11.1. Checkout

`POST /api/main/pos/sales/<cart_id>/checkout/`

**Тело (фрагмент):**
```json
{
  "print_receipt": false,
  "client_id": 123,
  "payment_method": "debt",
  "cash_received": null,
  "debt_days": 30,
  "first_due_date": "2026-09-04"
}
```

**400 без клиента:**
```json
{ "client_id": ["При продаже в долг выбор клиента обязателен."] }
```

### 11.2. Bulk-delete

`POST /api/main/sales/bulk-delete/`

```json
{
  "ids": [1, 2, 3],
  "allow_paid": false,
  "delete_code": "1234"
}
```

**400 код:**
```json
{ "delete_code": ["Неверный или отсутствующий код подтверждения."] }
```

**400 оплаченные (как сейчас):**
```json
{
  "detail": "Среди выбранных продаж есть оплаченные. Удалить их тоже?",
  "paid_ids": [2]
}
```

### 11.3. Deals pay

`POST /api/main/deals/<id>/pay/`

```json
{
  "idempotency_key": "uuid",
  "installment_id": 10,
  "amount": "100.00",
  "date": "2026-08-05",
  "note": ""
}
```

**403:**
```json
{ "detail": "Недостаточно прав для оплаты этой сделки." }
```

### 11.4. Inventory apply

`POST /api/main/inventory/sessions/<id>/apply/`

- Принимает/хранит quantity с 3 знаками.
- Создаёт stock movements.

### 11.5. Stock movements

`GET /api/main/stock-movements/?product_id=&date_from=&date_to=&type=`

Ответ — пагинированный список с `change`, `quantity_before/after`, `type`, `created_at`, `user`, `comment`.

### 11.6. Agent checkout

При отсутствии кассы:

```json
{ "cashbox": ["Нет доступной кассы (если смены нет)."] }
```
HTTP 400.

### 11.7. Finished→raw cancel

`POST /api/main/finished-to-raw-transfers/<id>/cancel/`

```json
{ "detail": "Запись сырья не найдена." }
```
HTTP 400 или 404.

### 11.8. Mobile scanner (если включаем)

`POST /api/main/pos/sales/mobile-scanner/ingest/`

- Контракт как у существующего view; задокументировать поля token/barcode в отдельном мини-ТЗ при реализации C6.

### 11.9. Product bulk-update errors

```json
{
  "brand_name": ["Бренд «X» не найден"],
  "category_name": ["Категория «Y» не найдена"]
}
```

---

## 12. Файлы для правок

### 12.1. Backend (репозиторий NurCRM)

| Файл | Задачи |
|------|--------|
| `apps/main/pos_serializers.py` | BE-1 validate client |
| `apps/main/pos_views.py` | checkout, bulk-delete PIN, mobile scanner view |
| `apps/main/services_agent_pos.py` | BE-2 |
| `apps/main/models.py` | Sale.clean / SaleItem COGS context |
| `apps/main/inventory_views.py` | BE-3, BE-4 |
| `apps/main/views.py` | BE-5, BE-6, BE-10 |
| `apps/main/services/__init__.py` | BE-7 checkout COGS |
| `apps/main/urls.py` | BE-8 |
| tests `apps/main/...` | на каждый BE-* |

### 12.2. Frontend (NurFront)

| Файл | Задачи |
|------|--------|
| `src/Components/pages/Sell/Sell.jsx` | F1, F17 bulk-delete |
| `src/Components/Sectors/Market/CashierPage/PaymentPage.jsx` | F2, F4, F10 |
| `src/Components/pages/Sell/Cashier/PaymentPage.jsx` | F2, F4, F9 |
| `src/Components/Sectors/Market/CashierPage/components/DeleteCodeModal.jsx` | reuse A1 |
| `src/hooks/useMarketCashierSettings.js` | A1 |
| `src/Components/Sectors/Market/ClientDetails/components/DebtModal.jsx` | F3 |
| `src/Components/Sectors/Market/CashierPage/components/DebtPaymentModal.jsx` | F8, A4 |
| `src/Components/Sectors/Market/Warehouse/components/InventoryModal.jsx` | F5 |
| `src/Components/Sectors/Market/Documents/components/InventorySessionsTab.jsx` | B1/B2 |
| `src/Components/Sectors/Market/Warehouse/components/MovementHistory.jsx` | F6/F12 |
| `src/Components/Sectors/Production/FinishedGoods/FinishedToRawModals.jsx` | F13 |
| `src/Components/Sectors/Production/ProductionAgents/SellStart/SellStart.jsx` | F7 |
| `src/store/creators/agentCartCreators.js` | F7 |
| `src/store/creators/saleThunk.js` | F4 payload, F16 |
| `src/Components/Sectors/Market/CashierPage/components/ReceiptsModal.jsx` | F11 |
| `src/Components/Sectors/Market/Warehouse/Warehouse.jsx` + BulkEditModal | F14 |
| `src/Components/Sectors/Market/Analytics/Analytics.jsx` | F18 (проверка warning) |
| `src/Components/Sectors/Production/Warehouse/ProductionMovementsTab.jsx` | эталон для B2 |

---

## 13. Порядок внедрения и зависимости

```
Неделя / итерация 1 (P0)
  ├─ A1 BE PIN bulk-delete
  ├─ A1 FE PIN + api client          ← после или параллельно с A1 BE
  ├─ A2 BE client_id required
  ├─ A2 FE disabled + alerts
  ├─ A3 FE success path / retry      ← можно без BE atomic
  └─ A4 BE cashier pay + FE await cashflow

Итерация 2 (P1)
  ├─ B1 BE+FE 0.001
  ├─ B2 BE movements + FE journal
  ├─ B3 BE cancel 400
  └─ B4 BE+FE agent cashbox

Итерация 3 (P2)
  ├─ C1–C5, C7–C9
  └─ C6 mobile scanner (опционально)

Параллельно
  └─ A2-data: отчёт висячих долгов
```

**Правило:** для пар BE/FE из матрицы §5 не выкатывать только фронт, ожидающий новый контракт, без бэка (и наоборот для breaking changes). Исключение: A3 FE (устойчивость UX) можно раньше atomic BE.

---

## 14. Тест-план

### 14.1. API (бэк)

| # | Сценарий | Ожидание |
|---|----------|----------|
| T1 | Checkout debt без client_id | 400 `client_id` |
| T2 | Checkout debt с client_id | 201, client заполнен |
| T3 | Checkout payments[] с debt без client | 400 |
| T4 | Agent checkout без cashbox | 400, не 500 |
| T5 | Inventory apply 12.345 | quantity 12.345 |
| T6 | После apply есть StockMovement | change = fact − book |
| T7 | Cancel transfer, raw удалён | 400/404 detail |
| T8 | Cashier pay чужой deal филиала | 200 |
| T9 | Посторонний user без прав | 403 |
| T10 | Bulk-delete без кода (код включён) | 400 `delete_code` |
| T11 | Bulk-delete с верным кодом | 200 |
| T12 | Bulk-update неизвестный бренд | field error |

### 14.2. UI (фронт)

| # | Сценарий | Ожидание |
|---|----------|----------|
| U1 | Отсрочка без клиента | Accept disabled / alert |
| U2 | Отсрочка с клиентом | success + deal/debt |
| U3 | Fail createDeal после checkout | success + warning + retry |
| U4 | «Старт» fail `/main/debts/` | нет залипания на PaymentPage |
| U5 | Bulk-delete, PIN вкл. | модалка кода |
| U6 | Bulk-delete на staging | запрос не на app.nurcrm.kg |
| U7 | Инвентаризация 1.234 кг | сохраняется 1.234 |
| U8 | Журнал после apply | видно движение |
| U9 | DebtModal: mock pay 500 | cashflow не создан |
| U10 | Кассир платит чужую рассрочку | успех после BE-6 |
| U11 | Double-click Accept (Sell) | один checkout |
| U12 | Agent без кассы | понятное сообщение |
| U13 | Cancel finished→raw bad raw | текст detail |
| U14 | Весовой ввод с запятой `12,345` | принимается как 12.345 |

### 14.3. Регрессия

- Наличные / безнал / split / отсрочка с предоплатой.
- Печать чека / «Без чека».
- Удаление позиции из корзины с PIN (cashier-settings).
- Одиночное удаление чека.
- Аналитика маркета открывается, `cogs_warning` не ломает график.
- Supplier receipt / оприходование.

---

## 15. Миграция данных и регресс

### 15.1. Висячие долги (BE-1)

1. Выгрузка: id sale, date, amount, branch, cashier, client_id NULL.
2. Владелец решает: привязать клиента / отменить / оставить как списание.
3. Не авто-удалять продажи.

### 15.2. Искажённые остатки после инвентаризаций (BE-3)

1. Опциональный отчёт сессий apply за период, где fact имел >2 знаков (если логировалось).
2. Повторная инвентаризация весовых критичных позиций после фикса.

### 15.3. Рассинхрон cashflow / deal (F3)

1. Найти cashflow «оплата долга» без успешного pay (ручной SQL/админка) — по возможности.
2. После фикса F3 новые случаи не появляются.

---

## 16. Критерии приёмки (DoD)

Общий DoD релиза Маркет-фиксов:

1. Все пункты этапа A закрыты и прогнаны по §14.
2. Этап B закрыт (или явно перенесён с причиной в тикете).
3. Нет 500 на сценариях BE-2 и BE-5.
4. Нет bulk-delete без PIN при включённом коде.
5. Нет checkout debt без client на API.
6. Фронт не использует хардкод production URL в исправленных потоках.
7. QA подписал чеклист U1–U14 (или актуальный сокращённый).
8. Документация: этот файл обновлён статусами; при C6 — ссылка на мини-ТЗ сканера.
9. Для висячих долгов есть хотя бы отчёт/выгрузка (A2-data).

Статусы задач вести так:

| Статус | Значение |
|--------|----------|
| `todo` | не начато |
| `be-done` | бэк влит |
| `fe-done` | фронт влит |
| `qa` | на проверке |
| `done` | принято |

---

## 17. Оценка трудозатрат

| Этап | Backend | Frontend | QA |
|------|---------|----------|-----|
| A (P0) | 1–1.5 дн | 1.5–2 дн | 0.5 дн |
| B (P1) | 1–1.5 дн | 1–1.5 дн | 0.5 дн |
| C (P2) | 0.5–1 дн | 1–1.5 дн | 0.5 дн |
| A2-data | 0.25–0.5 дн | — | 0.25 дн |
| **Итого** | **~3–4.5 дн** | **~4–5 дн** | **~1.5–2 дн** |

C6 (mobile scanner UI) — отдельно **+1–2 дн** FE после BE route.

---

## 18. Вне объёма / отложено

| Тема | Решение |
|------|---------|
| Полный UI мобильного сканера | Только после BE-8 в urls; иначе не начинать |
| Атомарный checkout+deal на BE | Желательно, но FE A3 обязателен раньше |
| Запрет продажи без закупочной цены | Продуктовое решение; не включать без согласования |
| Redesign кассы | Вне ТЗ |
| Авто-чистка исторических Sale без client | Только после выгрузки и решения владельца |
| Cafe/Building debt flows | Не трогать, кроме общих thunks — регрессию смотреть точечно |

---

## 19. Чеклист релиза

### Перед merge

- [ ] BE тесты T1–T12 зелёные (или актуальный набор)
- [ ] FE lint/test затронутых файлов
- [ ] Grep: нет новых `app.nurcrm.kg` в Sell/Market delete
- [ ] Ручной прогон U1–U6 на staging

### После deploy

- [ ] Включить/проверить cashier delete code на тестовой компании
- [ ] Прогнать debt checkout с клиентом и без (ожидать 400)
- [ ] Инвентаризация весового товара
- [ ] Кассир — оплата чужой сделки
- [ ] Agent checkout на филиале без кассы (ожидать 400)
- [ ] Выгрузить отчёт висячих долгов (A2-data)

### Коммуникация владельцам

Кратко сообщить:

1. Больше нельзя оформить долг без клиента (защита от потери долгов).
2. Массовое удаление чеков теперь с тем же кодом, что и обычное.
3. Весовая инвентаризация точнее (граммы).
4. Если были старые продажи «в долг без клиента» — пришлём список на разбор.

---

## Приложение A. Быстрые ссылки на текущий код фронта

| Тема | Путь |
|------|------|
| Market PaymentPage | `src/Components/Sectors/Market/CashierPage/PaymentPage.jsx` |
| Sell PaymentPage | `src/Components/pages/Sell/Cashier/PaymentPage.jsx` |
| Bulk delete | `src/Components/pages/Sell/Sell.jsx` |
| Delete code hook | `src/hooks/useMarketCashierSettings.js` |
| DeleteCodeModal | `src/Components/Sectors/Market/CashierPage/components/DeleteCodeModal.jsx` |
| DebtModal | `src/Components/Sectors/Market/ClientDetails/components/DebtModal.jsx` |
| DebtPaymentModal | `src/Components/Sectors/Market/CashierPage/components/DebtPaymentModal.jsx` |
| InventoryModal | `src/Components/Sectors/Market/Warehouse/components/InventoryModal.jsx` |
| Inventory sessions | `src/Components/Sectors/Market/Documents/components/InventorySessionsTab.jsx` |
| productCheckout | `src/store/creators/saleThunk.js` |
| Agent SellStart | `src/Components/Sectors/Production/ProductionAgents/SellStart/SellStart.jsx` |
| Stock movements эталон | `src/Components/Sectors/Production/Warehouse/ProductionMovementsTab.jsx` |
| Finished→raw | `src/Components/Sectors/Production/FinishedGoods/FinishedToRawModals.jsx` |

## Приложение B. Источник бэк-багов

Исходный отчёт аудита: `MARKET_BUGS_REPORT.md` (4 августа 2026), объект — `apps/main` монолита NurCRM.

Нумерация в этом ТЗ:

- `BE-1` … `BE-10` = пункты 1–10 отчёта бэка;
- `F1` … `F18` = находки аудита фронта NurFront.

---

*Конец документа.*
