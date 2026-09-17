/**
 * Массовый перенос выбранных лидов в другую воронку (без смены владельца —
 * в отличие от `BulkAssignLeadsModal`, который переносит В воронку
 * сотрудника И переназначает его владельцем одним действием).
 *
 * POST /leads/{id}/transfer/ { target_funnel, target_stage } — тот же
 * эндпоинт, что при переносе одной карточки кнопкой «В другую воронку»
 * (`TransferLeadModal`). `owner` в теле не передаём — по контракту
 * (backend-main-funnel-inbound.md §5) он сохраняется, если не задан явно.
 *
 * Контракт: docs/consulting/backend-money-tenant/22-bulk-lead-transfer.md §7.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../../api";
import { transferLeadToFunnel } from "../../../../store/creators/funnelThunk";
import { getFunnelDisplayName } from "../../../../utils/consultingFunnelDefaults";
import { runWithConcurrency } from "./bulkLeadOps";

const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);

export default function BulkMoveFunnelModal({
  leadIds = [],
  sourceFunnelId,
  funnels = [],
  onClose,
  onDone,
}) {
  const dispatch = useDispatch();
  const targetOptions = useMemo(
    () => funnels.filter((f) => String(f.id) !== String(sourceFunnelId)),
    [funnels, sourceFunnelId],
  );

  const [targetFunnelId, setTargetFunnelId] = useState("");
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [targetStageId, setTargetStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Смена целевой воронки — сброс стадии/списка синхронно в обработчике
  // выбора (не в эффекте, чтобы не звать setState прямо в теле эффекта).
  const selectFunnel = (nextId) => {
    setTargetFunnelId(nextId);
    setTargetStageId("");
    setStages([]);
    setLoadingStages(!!nextId);
  };

  // Стадии выбранной целевой воронки — необязательно указывать: пусто
  // означает «первая стадия воронки», её подставит бэк.
  useEffect(() => {
    if (!targetFunnelId) return undefined;
    const controller = new AbortController();
    api
      .get("/consalting/funnel-stages/", {
        params: { funnel: targetFunnelId },
        signal: controller.signal,
      })
      .then((res) => {
        const rows = asArray(res.data)
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setStages(rows);
      })
      .catch(() => setStages([]))
      .finally(() => setLoadingStages(false));
    return () => controller.abort();
  }, [targetFunnelId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!targetFunnelId || saving) return;
    setSaving(true);
    setResult(null);

    const results = await runWithConcurrency(leadIds, 4, (leadId) =>
      dispatch(
        transferLeadToFunnel({
          id: leadId,
          target_funnel: targetFunnelId,
          target_stage: targetStageId || null,
        }),
      ).unwrap(),
    );

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    setResult({ ok, fail });
    setSaving(false);

    const movedFunnelIds = [sourceFunnelId, targetFunnelId].filter(Boolean);
    if (fail === 0) {
      onDone?.({ movedFunnelIds });
      return;
    }
    onDone?.({ movedFunnelIds, keepOpenOnError: true });
  };

  return (
    <div
      className="funnel__overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onClose()}
    >
      <div className="funnel__modal" onClick={(e) => e.stopPropagation()}>
        <div className="funnel__modalHead">
          <h3 className="funnel__modalTitle">
            Перенести {leadIds.length}{" "}
            {leadIds.length === 1 ? "лид" : "лидов"} в другую воронку
          </h3>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={() => !saving && onClose()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {result && (
          <div className={result.fail ? "funnel__error" : "funnel__notice"}>
            Готово: {result.ok} перенесено
            {result.fail
              ? `, ${result.fail} с ошибкой — проверьте права на этих лидов`
              : ""}
            .
          </div>
        )}

        <form className="funnel__form" onSubmit={submit}>
          <div className="funnel__field">
            <label className="funnel__label">Воронка *</label>
            <select
              className="funnel__input"
              value={targetFunnelId}
              onChange={(e) => selectFunnel(e.target.value)}
              required
            >
              <option value="">Выберите воронку…</option>
              {targetOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {getFunnelDisplayName(f)}
                </option>
              ))}
            </select>
          </div>

          {!!targetFunnelId && (
            <div className="funnel__field">
              <label className="funnel__label">Стадия</label>
              <select
                className="funnel__input"
                value={targetStageId}
                onChange={(e) => setTargetStageId(e.target.value)}
                disabled={loadingStages}
              >
                <option value="">Первая стадия воронки (по умолчанию)</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="funnel__hint">
            Ответственный за лид (`owner`) не меняется — переносятся только
            сами карточки. Чтобы одновременно передать лиды сотруднику,
            используйте «Передать сотруднику».
          </p>

          <div className="funnel__formActions">
            <button
              type="button"
              className="funnel__btn"
              onClick={onClose}
              disabled={saving}
            >
              {result ? "Закрыть" : "Отмена"}
            </button>
            <button
              type="submit"
              className="funnel__btn funnel__btn--primary"
              disabled={saving || !targetFunnelId}
            >
              {saving ? "Переносим…" : "Перенести"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
