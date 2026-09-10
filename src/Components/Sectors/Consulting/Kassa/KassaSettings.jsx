import React, { useEffect, useState } from "react";
import {
  getCashConfirmationSettings,
  updateCashConfirmationSettings,
} from "../../../../api/consultingCashbox";
import {
  CASH_CONFIRM_MODE_OPTIONS,
  normalizeCashConfirmMode,
} from "../../../../utils/consultingMoney";
import { useAlert } from "../../../../hooks/useDialog";

/**
 * Настройки подтверждения поступлений в кассе (ТЗ №9, owner/admin).
 *
 * Контракт: docs/consulting/backend-money-tenant/03-cash-confirmation.md §9.4,
 * docs/consulting/backend-money-tenant/09-frontend-contract.md.
 *
 * Пока эндпоинт не готов (404/501) — панель показывает заглушку, не ломая кассу.
 */
const DEFAULTS = { mode: "cash_only", skip_for_cashier: true, overdue_hours: 24 };

export default function KassaSettings() {
  const alert = useAlert();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const data = await getCashConfirmationSettings({
          signal: controller.signal,
        });
        setForm({
          mode: normalizeCashConfirmMode(data?.mode),
          skip_for_cashier: data?.skip_for_cashier !== false,
          overdue_hours: Number(data?.overdue_hours) || DEFAULTS.overdue_hours,
        });
      } catch (e) {
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (e?.status === 404 || e?.status === 501) setNotReady(true);
        else console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const patch = (next) => setForm((f) => ({ ...f, ...next }));

  const onSave = async () => {
    try {
      setSaving(true);
      const payload = {
        mode: normalizeCashConfirmMode(form.mode),
        skip_for_cashier: Boolean(form.skip_for_cashier),
        overdue_hours: Math.max(1, Number(form.overdue_hours) || 24),
      };
      const saved = await updateCashConfirmationSettings(payload);
      if (saved && typeof saved === "object") {
        patch({
          mode: normalizeCashConfirmMode(saved.mode ?? payload.mode),
          skip_for_cashier: saved.skip_for_cashier ?? payload.skip_for_cashier,
          overdue_hours: Number(saved.overdue_hours) || payload.overdue_hours,
        });
      }
      alert("Настройки кассы сохранены");
    } catch (e) {
      console.error(e);
      if (e?.status === 404 || e?.status === 501) {
        setNotReady(true);
        alert("Раздел ещё не подключён на сервере", true);
      } else {
        alert(e?.detail || "Не удалось сохранить настройки", true);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="kassa__center">Загрузка…</div>;

  if (notReady) {
    return (
      <div className="kassa__alert">
        Настройки подтверждения кассы ещё не подключены на сервере
        (<code>GET /consalting/cashbox/confirmation-settings/</code>). Пока
        действует режим по умолчанию: заявка создаётся только для наличных.
      </div>
    );
  }

  return (
    <div className="kassaSettings">
      <p className="kassaSettings__lead">
        Определяет, когда продажа и абонентский платёж создают заявку в кассу.
        Пока заявка не подтверждена, деньги не входят в остаток кассы.
      </p>

      <fieldset className="kassaSettings__group">
        <legend>Когда требуется подтверждение</legend>
        {CASH_CONFIRM_MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className="kassaSettings__radio">
            <input
              type="radio"
              name="cash-confirm-mode"
              value={opt.value}
              checked={form.mode === opt.value}
              onChange={() => patch({ mode: opt.value })}
            />
            <span>
              <b>{opt.label}</b>
              <em>{opt.hint}</em>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="kassaSettings__check">
        <input
          type="checkbox"
          checked={Boolean(form.skip_for_cashier)}
          onChange={(e) => patch({ skip_for_cashier: e.target.checked })}
        />
        <span>
          Кассир не подтверждает собственные продажи
          <em>Если продажу оформил сам кассир — заявка не создаётся.</em>
        </span>
      </label>

      <label className="kassaSettings__field">
        <span>Срок подтверждения, часов</span>
        <input
          type="number"
          min={1}
          value={form.overdue_hours}
          onChange={(e) => patch({ overdue_hours: e.target.value })}
        />
        <em>
          Заявка старше этого срока попадает в напоминание руководителю.
        </em>
      </label>

      <div className="kassaSettings__actions">
        <button
          type="button"
          className="kassa__btn kassa__btn--primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
