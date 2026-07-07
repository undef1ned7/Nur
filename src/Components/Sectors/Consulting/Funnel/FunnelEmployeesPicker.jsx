import { useEffect, useState } from "react";
import { fetchFunnelEmployees } from "../../../../utils/consultingFunnelEmployees";

export default function FunnelEmployeesPicker({
  funnelId,
  value = [],
  onChange,
  disabled = false,
}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!funnelId) return undefined;
    let cancelled = false;
    setLoading(true);
    setErr("");
    fetchFunnelEmployees(funnelId)
      .then((rows) => {
        if (!cancelled) setEmployees(rows);
      })
      .catch(() => {
        if (!cancelled) setErr("Не удалось загрузить сотрудников воронки.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [funnelId]);

  const toggle = (id) => {
    const sid = String(id);
    const set = new Set((value || []).map(String));
    if (set.has(sid)) set.delete(sid);
    else set.add(sid);
    onChange?.([...set]);
  };

  if (loading) {
    return <p className="funnel__hint">Загрузка сотрудников…</p>;
  }

  if (err) {
    return <p className="funnel__error funnel__error--inline">{err}</p>;
  }

  if (!employees.length) {
    return (
      <p className="funnel__hint">Нет сотрудников для привязки к этой воронке.</p>
    );
  }

  return (
    <div className="funnel__empPick">
      {employees.map((e) => {
        const checked = (value || []).map(String).includes(String(e.id));
        return (
          <label key={e.id} className="funnel__empPickItem">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(e.id)}
            />
            <span>{e.name}</span>
          </label>
        );
      })}
      <p className="funnel__hint">
        Выбранные сотрудники смогут работать с этим лидом в рамках воронки.
      </p>
    </div>
  );
}
