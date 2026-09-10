# 7. Изоляция видимости «Продавец / Менеджер»

**ТЗ:** «Доработка логики и автоматизация CRM», блок 2 (День 1).  
**Фронт:** `consultingFunnelAccess.js`, `consultingMenu.js`, `Funnel.jsx`, `sale.jsx`

## 7.1. Задача

Сотрудник с ролью продавца видит **только** свои лиды и сделки, не имеет доступа
к общемu inbox, чужим воронкам и системным настройкам.

---

## 7.2. Ролевая модель

| Роль / право | Видимость |
|---|---|
| `owner`, `admin` | Всё |
| **Продавец** (`can_view_funnel`, без расширений) | Свои лиды на **разрешённых** воронках; свои продажи |
| `can_view_all_funnel_leads` | Все лиды на доступных воронках |
| `can_view_leads_inbox` | `/crm/consulting/leads` |
| `can_view_all_sales` | Все продажи компании |

### Рекомендуемый профиль «Продавец Бишкек»

| Право | Значение |
|---|---|
| `can_view_funnel` | ✓ |
| `can_manage_funnel_leads` | ✓ |
| `can_view_sale` | ✓ |
| `funnel_grants` | только воронка «Бишкек» |
| `can_view_leads_inbox` | ✗ |
| `can_view_all_funnel_leads` | ✗ |
| `can_view_all_sales` | ✗ |
| `can_view_analytics` | ✗ |

---

## 7.3. Поля профиля (backend)

```python
can_view_all_funnel_leads = models.BooleanField(default=False)
can_view_leads_inbox = models.BooleanField(default=False)
can_view_all_sales = models.BooleanField(default=False)
```

---

## 7.4. Фильтрация queryset (обязательно)

Фронт **не заменяет** серверную изоляцию.

### Лиды / доска

```python
def leads_for_user(qs, user, profile):
    if profile.role in ("owner", "admin") or profile.can_view_all_funnel_leads:
        return qs.filter(funnel__in=allowed_funnels(user))
    return qs.filter(owner=user, funnel__in=allowed_funnels(user))
```

- `GET /consalting/funnels/{id}/board/` — не-manager: только `owner=request.user`.
- `PATCH/claim/assign` на чужой лид → `403`.
- `funnel_grants` проверять на каждом доступе к воронке.

### Inbound leads

- Без `can_view_leads_inbox` → `403` на `GET /consalting/inbound-leads/`.

### Продажи

```python
def sales_for_user(qs, user, profile):
    if profile.role in ("owner", "admin") or profile.can_view_all_sales:
        return qs
    return qs.filter(user=user)
```

- `GET /consalting/sales/?user=` — без `can_view_all_sales` игнорировать чужой
  `user`, подставлять `request.user`.

### Касса, аналитика, настройки

| Эндпоинт | Продавец |
|---|---|
| `cashbox/requests/` confirm/reject | только `owner`/`admin` или роль кассира |
| `analytics/*` | `403` без `can_view_analytics` |
| `regional-funnel-routing/` PUT | `403` |
| `lead-distribution/` PUT | `403` |

---

## 7.5. Поведение UI (справочно)

| Пункт меню | Продавец |
|---|---|
| Лиды | Скрыт |
| Воронка | ✓ (свои) |
| Продажи | ✓ (`?user=me`) |
| Аналитика, Сотрудники | ✗ |

Переключатель «Мои / Все / Пул» — только owner/admin.

---

## 7.6. Чек-лист приёмки

- [ ] API не отдаёт чужие лиды при подмене query.
- [ ] `GET /consalting/sales/` без права — только свои.
- [ ] Inbound list → `403` для продавца.
- [ ] Owner/admin — без регрессий.
- [ ] UI: прямой URL `/crm/consulting/leads` → redirect (фронт).
