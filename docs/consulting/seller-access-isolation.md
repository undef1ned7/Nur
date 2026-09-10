# Консалтинг — изоляция видимости для «Продавец / Менеджер»

> **Спека для бэкенда:** [backend-money-tenant/07-seller-access-isolation.md](./backend-money-tenant/07-seller-access-isolation.md)

**Задача:** сотрудник с ролью продавца видит **только** свои лиды и сделки,
не имеет доступа к общему inbox, чужим воронкам и системным настройкам.

**Фронт:** `consultingFunnelAccess.js`, меню `consultingMenu.js`, страницы
Воронка / Лиды / Продажи.

---

## 1. Ролевая модель

| Роль / право | Видимость |
|---|---|
| `owner`, `admin` | Всё (как сейчас) |
| **Продавец** (`can_view_funnel` + `can_manage_funnel_leads`, без расширенных прав) | Только **свои** лиды на **разрешённых** воронках; свои продажи |
| Расширение | `can_view_all_funnel_leads` — видит все лиды на доступных воронках |
| Расширение | `can_view_leads_inbox` — доступ к `/crm/consulting/leads` |
| Расширение | `can_view_all_sales` — все продажи компании |

### Рекомендуемый набор прав для «Продавец Бишкек»

В карточке сотрудника (**Сотрудники → Доступ**):

| Право | Значение |
|---|---|
| `can_view_funnel` | ✓ |
| `can_manage_funnel_leads` | ✓ |
| `can_view_sale` | ✓ (только свои продажи на UI) |
| `can_view_funnel` grants | ✓ только воронка «Бишкек» |
| `can_view_leads_inbox` | ✗ |
| `can_view_all_funnel_leads` | ✗ |
| `can_view_all_sales` | ✗ |
| `can_view_analytics` | ✗ |
| `can_view_employees` | ✗ |
| `can_view_services` | ✗ (опционально ✓ только для справочника в форме) |

---

## 2. Поведение UI

### Меню

| Пункт | Продавец | Руководитель |
|---|---|---|
| Лиды | Скрыт | ✓ |
| Воронка | ✓ (свои лиды) | ✓ |
| Чаты | ✓ (свои диалоги) | ✓ |
| Продажи | ✓ (свои) | ✓ (все) |
| Аналитика, Сотрудники, … | По правам профиля | ✓ |

### Воронка (`/crm/consulting/funnel`)

- Переключатель «Мои / Все / Пул» — **только у owner/admin**.
- Продавец: подпись «Показаны только лиды, где вы ответственный», фильтр `mine`.
- Воронки: ролевая + `funnel_grants`; **главная** не показывается автоматически
  (режим изоляции).
- Архив: только свои архивные лиды.
- Настройки воронок, «+ Воронка», распределение — только owner/admin.

### Лиды (`/crm/consulting/leads`)

- Redirect на воронку, если нет `can_view_leads_inbox`.

### Продажи (`/crm/consulting/sale`)

- Запрос `GET /consalting/sales/?user={id}` для продавца без `can_view_all_sales`.

---

## 3. Бэкенд (обязательно для безопасности)

Фронт **не заменяет** серверную фильтрацию. Бэкенд должен:

1. **Board API** `GET /funnels/{id}/board/` — для не-manager отдавать только
   `owner=request.user` (или 403 на чужие карточки).
2. **Sales list** — honor `?user=`; без права `can_view_all_sales` игнорировать
   чужой `user` и подставлять текущего.
3. **Inbound leads** — без `can_view_leads_inbox` → `403` на list.
4. **Funnel grants** — проверять на каждом `GET/PATCH` лида.

Новые поля профиля (optional, boolean):

```python
can_view_all_funnel_leads = models.BooleanField(default=False)
can_view_leads_inbox = models.BooleanField(default=False)  # True для supervisor
can_view_all_sales = models.BooleanField(default=False)
```

---

## 4. Чек-лист QA

- [ ] Продавец не видит пункт «Лиды» в меню.
- [ ] Прямой URL `/crm/consulting/leads` → redirect на воронку.
- [ ] На воронке нет чужих карточек и нет переключателя «Все».
- [ ] Видна только воронка региона (grant), не Ош/Джалал-Абад.
- [ ] Продажи — только где seller = текущий user.
- [ ] Owner видит всё как раньше.
- [ ] API не отдаёт чужие лиды при подмене query (бэкенд).

---

## 5. Связанные документы

- **[backend-money-tenant/07-seller-access-isolation.md](./backend-money-tenant/07-seller-access-isolation.md)**
- [backend-money-tenant/06-regional-funnels-routing.md](./backend-money-tenant/06-regional-funnels-routing.md)
- [funnel-crm-logic.md](./funnel-crm-logic.md)
