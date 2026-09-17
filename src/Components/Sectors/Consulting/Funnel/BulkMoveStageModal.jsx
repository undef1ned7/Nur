/**
 * Массовый перевод выбранных лидов на другую стадию текущей воронки.
 *
 * Переиспользует тот же одиночный эндпоинт, что и drag&drop карточки между
 * колонками (POST /leads/{id}/move-stage/), просто вызывает его в цикле по
 * выбранным лидам — как и `BulkAssignLeadsModal` для передачи сотруднику.
 *
 * Контракт: docs/consulting/backend-money-tenant/22-bulk-lead-transfer.md §7.
 */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { moveLeadStage } from "../../../../store/creators/funnelThunk";
import { runWithConcurrency } from "./bulkLeadOps";

export default function BulkMoveStageModal({
  leadIds = [],
  funnelId,
  stages = [],
  onClose,
  onDone,
}) {
  const dispatch = useDispatch();
  const [targetStageId, setTargetStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!targetStageId || saving) return;
    setSaving(true);
    setResult(null);

    const results = await runWithConcurrency(leadIds, 4, (leadId) =>
      dispatch(
        moveLeadStage({ id: leadId, stage: targetStageId }),
      ).unwrap(),
    );

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    setResult({ ok, fail });
    setSaving(false);

    if (fail === 0) {
      onDone?.({ movedFunnelIds: [funnelId] });
      return;
    }
    onDone?.({ movedFunnelIds: [funnelId], keepOpenOnError: true });
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
            Перевести {leadIds.length}{" "}
            {leadIds.length === 1 ? "лид" : "лидов"} на стадию
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
              ? `, ${result.fail} с ошибкой — проверьте, разрешён ли переход из текущей стадии для этих лидов`
              : ""}
            .
          </div>
        )}

        {!stages.length ? (
          <p className="funnel__hint">В этой воронке нет стадий.</p>
        ) : (
          <form className="funnel__form" onSubmit={submit}>
            <div className="funnel__field">
              <label className="funnel__label">Стадия *</label>
              <select
                className="funnel__input"
                value={targetStageId}
                onChange={(e) => setTargetStageId(e.target.value)}
                required
              >
                <option value="">Выберите стадию…</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="funnel__hint">
              Лиды, для которых переход в выбранную стадию запрещён правилами
              воронки, попадут в число ошибок — остальные лиды это не
              остановит.
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
                disabled={saving || !targetStageId}
              >
                {saving ? "Переносим…" : "Перевести"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
