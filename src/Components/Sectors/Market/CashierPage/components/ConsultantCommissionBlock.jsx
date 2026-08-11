import React, { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import api from "../../../../../api";
import {
  calcCommissionPreview,
  formatCommissionMoney,
  listFrom,
  mapEmployeeOption,
  parseCommissionPercent,
  pickDefaultSalesPercentFromProfiles,
} from "../../../../../../tools/marketSaleConsultant";

async function fetchAllEmployees() {
  const acc = [];
  let url = "/users/employees/?page_size=200&ordering=last_name,first_name";
  let guard = 0;
  while (url && guard < 30) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await api.get(url);
    acc.push(...listFrom(data));
    url = data?.next || null;
    guard += 1;
  }
  return acc
    .map(mapEmployeeOption)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

async function fetchDefaultPercent(userId) {
  try {
    const { data } = await api.get("/main/market-sale-employee-pay-profiles/", {
      params: { user: userId },
    });
    return pickDefaultSalesPercentFromProfiles(listFrom(data));
  } catch {
    return null;
  }
}

/**
 * Блок выбора консультанта и % на экране оплаты кассы.
 */
export default function ConsultantCommissionBlock({
  saleTotal = 0,
  enabled,
  onEnabledChange,
  consultantId,
  onConsultantChange,
  commissionEnabled,
  onCommissionEnabledChange,
  commissionPercent,
  onCommissionPercentChange,
}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [percentLoading, setPercentLoading] = useState(false);
  const [query, setQuery] = useState("");

  const clearConsultant = () => {
    onConsultantChange?.({ id: "", name: "" });
  };

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const list = await fetchAllEmployees();
        if (!cancelled) setEmployees(list);
      } catch (e) {
        console.warn("[ConsultantCommissionBlock] employees load failed", e);
        if (!cancelled) {
          setEmployees([]);
          setLoadError("Не удалось загрузить сотрудников");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !consultantId) return undefined;
    let cancelled = false;
    (async () => {
      setPercentLoading(true);
      try {
        const def = await fetchDefaultPercent(consultantId);
        if (cancelled || def == null) return;
        if (
          commissionPercent === "" ||
          commissionPercent == null ||
          parseCommissionPercent(commissionPercent) == null
        ) {
          onCommissionPercentChange(def);
          if (!commissionEnabled) onCommissionEnabledChange(true);
        }
      } finally {
        if (!cancelled) setPercentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при смене консультанта
  }, [enabled, consultantId]);

  const filtered = useMemo(() => {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, query]);

  const selected = useMemo(
    () => employees.find((e) => String(e.id) === String(consultantId)) || null,
    [employees, consultantId],
  );

  const previewAmount = useMemo(() => {
    if (!commissionEnabled) return 0;
    const pct = parseCommissionPercent(commissionPercent);
    if (pct == null) return 0;
    return calcCommissionPreview(saleTotal, pct);
  }, [commissionEnabled, commissionPercent, saleTotal]);

  return (
    <div className="payment-page__section payment-page__consultant">
      <h3 className="payment-page__section-title">КОНСУЛЬТАНТ</h3>

      <label className="payment-page__consultant-toggle">
        <input
          type="checkbox"
          checked={Boolean(enabled)}
          onChange={(e) => {
            const next = e.target.checked;
            onEnabledChange(next);
            if (!next) {
              clearConsultant();
              onCommissionEnabledChange(false);
              onCommissionPercentChange("");
              setQuery("");
            }
          }}
        />
        <span>Указать консультанта</span>
      </label>

      {enabled ? (
        <div className="payment-page__consultant-body">
          <div className="payment-page__consultant-hint">
            Кассир чека — вы. Процент с этой продажи получит консультант.
          </div>

          <label className="payment-page__consultant-field">
            <span className="payment-page__consultant-label">
              <UserRound size={14} aria-hidden /> Сотрудник
            </span>
            <input
              type="search"
              className="payment-page__consultant-search"
              placeholder="Поиск по ФИО…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <select
              className="payment-page__consultant-select"
              value={consultantId || ""}
              onChange={(e) => {
                const id = e.target.value;
                const emp = employees.find((x) => String(x.id) === String(id));
                onConsultantChange?.({
                  id,
                  name: emp?.name || "",
                });
                onCommissionPercentChange("");
                if (id) onCommissionEnabledChange(true);
              }}
              disabled={loading}
            >
              <option value="">
                {loading ? "Загрузка…" : "Выберите консультанта"}
              </option>
              {filtered.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {loadError ? (
              <span className="payment-page__consultant-error">{loadError}</span>
            ) : null}
            {selected ? (
              <span className="payment-page__consultant-selected">
                Выбран: {selected.name}
              </span>
            ) : null}
          </label>

          <label className="payment-page__consultant-toggle payment-page__consultant-toggle--nested">
            <input
              type="checkbox"
              checked={Boolean(commissionEnabled)}
              disabled={!consultantId}
              onChange={(e) => onCommissionEnabledChange(e.target.checked)}
            />
            <span>Начислять процент от продажи</span>
          </label>

          {commissionEnabled ? (
            <div className="payment-page__consultant-percent-row">
              <label className="payment-page__consultant-field">
                <span className="payment-page__consultant-label">Процент (%)</span>
                <input
                  type="number"
                  className="payment-page__amount-input"
                  min={0}
                  max={100}
                  step={0.01}
                  inputMode="decimal"
                  placeholder={percentLoading ? "…" : "0"}
                  value={commissionPercent}
                  onChange={(e) => onCommissionPercentChange(e.target.value)}
                  disabled={!consultantId || percentLoading}
                />
              </label>
              <div className="payment-page__consultant-preview">
                <span className="payment-page__consultant-preview-label">
                  Комиссия ≈
                </span>
                <span className="payment-page__consultant-preview-value">
                  {formatCommissionMoney(previewAmount)} сом
                </span>
              </div>
            </div>
          ) : (
            <p className="payment-page__consultant-note">
              Консультант будет привязан к чеку без начисления процента.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
