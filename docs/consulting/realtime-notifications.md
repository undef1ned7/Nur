# Консалтинг — Реалтайм: WebSocket + пуш (персонально пользователю)

**Фронт:** общий per-user сокет `useNotificationsSocket`
(`/ws/notifications/?token=<accessToken>`), смонтирован в `Header.jsx`.
`useConsultingRealtime` обновляет Лиды / Воронку / CRM-чаты и показывает
десктоп-пуш. Чат-сокет `/ws/wazzup/` держит `ConsultingWazzupNotifyBridge`
(только live-чат, без дублей в колокольчике).

**Статус бэка (2026-07):** готово.

| Требование | Бэкенд |
|---|---|
| Лид написал → колокольчик | `wazzup.py` → `create_and_publish_notification` → `/ws/notifications/` |
| Долго не отвечали (SLA) | `signals.py`: `no_activity`, `sla_breach`, `task_overdue` (level warning) |

## 1. Адресность

Событие уходит **владельцу лида** (персональная группа пользователя), не всей
компании.

## 2. Типы событий (фронт принимает)

| Событие | `type` (алиасы) |
|---|---|
| Назначение лида | `lead.assigned`, `consulting.lead.assigned`, … |
| Новое сообщение от лида | `lead.message`, `consulting.lead.message`, либо обычное notification из `create_and_publish_notification` |
| SLA / нет ответа | `sla_breach`, `no_activity`, `task_overdue`, `lead.no_reply`, … |
| Задача / зарплата | `consulting.lead.task.assigned`, `consulting.salary.accrued` |

Пример с бэка (`create_and_publish_notification`):

```jsonc
{
  "type": "notification",
  "data": {
    "type": "lead_message",
    "title": "📩 Сообщение от лида: Иван Иванов",
    "message": "Здравствуйте! Подскажите стоимость услуг",
    "url": "/consalting/leads/ea88bcfa-…",
    "level": "info"
  }
}
```

Фронт:
- показывает в колокольчике as-is;
- клик: `/consalting/leads/{id}` → `/crm/consulting/chats/whatsapp/{id}`.

## 3. Формат (рекомендуемый)

```jsonc
{
  "type": "notification",          // или сразу "sla_breach" / "consulting.lead.message"
  "data": {
    "id": "notif-uuid",
    "title": "⏰ Превышено время ответа по лиду: Иван",
    "message": "Клиент долго ожидает ответа! (Тел: +7700…)",
    "type": "sla_breach",
    "level": "warning",
    "is_read": false,
    "created_at": "2026-07-26T18:12:00",
    "meta": { "lead_id": "…", "source": "whatsapp" }
  }
}
```

Для нового сообщения — тот же конверт, `type: "consulting.lead.message"` (или
внутренний type из publish), `level: "info"`.

## 4. Поведение фронта

- Колокольчик: звук + бейдж + центр уведомлений
- Клик → CRM-чат (если есть `meta.lead_id` / `url`)
- Лиды / Воронка / CRM inbox обновляются через `useConsultingRealtime`
- Если этот чат уже открыт на видимой вкладке — звук не дублируется

## 5. Чек-лист

- [x] Inbound → уведомление ответственному через `/ws/notifications/`
- [x] SLA: `no_activity` / `sla_breach` / `task_overdue`
- [ ] В `meta` желательно `lead_id` + `source` (для клика в чат)
- [ ] Уникальный `id` на каждое уведомление
