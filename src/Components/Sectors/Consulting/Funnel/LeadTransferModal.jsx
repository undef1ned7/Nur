import { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { transferLeadToFunnel } from "../../../../store/creators/funnelThunk";
import { getFunnelDisplayName } from "../../../../utils/consultingFunnelDefaults";
import { canManageLeadsInFunnel } from "../../../../utils/consultingFunnelAccess";

const errToText = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.detail) return err.detail;
  return fallback;
};

export default function LeadTransferModal({
  sourceLead,
  sourceFunnelId,
  funnels = [],
  boardsMap = {},
  profile,
  onClose,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const [targetFunnelId, setTargetFunnelId] = useState("");
  const [targetStageId, setTargetStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const targetOptions = useMemo(
    () =>
      funnels.filter(
        (f) =>
          String(f.id) !== String(sourceFunnelId) &&
          canManageLeadsInFunnel(profile, f),
      ),
    [funnels, sourceFunnelId, profile],
  );

  const stageOptions = useMemo(() => {
    if (!targetFunnelId) return [];
    const board = boardsMap[targetFunnelId];
    return (board?.columns || []).map((c) => c.stage).filter(Boolean);
  }, [boardsMap, targetFunnelId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!targetFunnelId) {
      setErr("Выберите целевую воронку.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const created = await dispatch(
        transferLeadToFunnel({
          id: sourceLead.id,
          target_funnel: targetFunnelId,
          target_stage: targetStageId || null,
        }),
      ).unwrap();
      onSuccess?.(created, { sourceFunnelId, targetFunnelId });
      onClose();
    } catch (e2) {
      setErr(
        errToText(
          e2,
          "Не удалось передать лид. Проверьте права на целевую воронку.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="funnel__overlay"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onClose()}
    >
      <div className="funnel__modal" onClick={(e) => e.stopPropagation()}>
        <div className="funnel__modalHeader">
          <h3 className="funnel__modalTitle">Передать в другую воронку</h3>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={() => !saving && onClose()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <p className="funnel__transferLead">
          Исходный лид: <strong>{sourceLead?.title || "—"}</strong>
        </p>
        <p className="funnel__transferHint">
          Будет создан новый лид в выбранной воронке на основе данных текущего.
          Исходная карточка остаётся без изменений.
        </p>

        {!!err && <div className="funnel__error">{err}</div>}

        {!targetOptions.length ? (
          <div className="funnel__placeholder funnel__placeholder--sm">
            Нет других воронок, куда можно передать лид.
          </div>
        ) : (
          <form className="funnel__form" onSubmit={submit}>
            <div className="funnel__field">
              <label className="funnel__label">Целевая воронка *</label>
              <select
                className="funnel__input"
                value={targetFunnelId}
                onChange={(e) => {
                  setTargetFunnelId(e.target.value);
                  setTargetStageId("");
                }}
                required
              >
                <option value="">Выберите воронку</option>
                {targetOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {getFunnelDisplayName(f)}
                  </option>
                ))}
              </select>
            </div>

            {!!stageOptions.length && (
              <div className="funnel__field">
                <label className="funnel__label">Стадия в целевой воронке</label>
                <select
                  className="funnel__input"
                  value={targetStageId}
                  onChange={(e) => setTargetStageId(e.target.value)}
                >
                  <option value="">Первая системная / без стадии</option>
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="funnel__formActions">
              <button
                type="button"
                className="funnel__btn"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="funnel__btn funnel__btn--primary"
                disabled={saving}
              >
                {saving ? "Передача…" : "Создать в воронке"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
