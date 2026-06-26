import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Receipt, Search, Download, ArrowUpDown } from "lucide-react";
import api from "../../../../api";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/**
 * Задача №4 — Расходы из кассы в Аналитике Производства.
 * Подтягивает расходы (type=expense) напрямую из модуля Касса
 * (GET /construction/cashflows/) и показывает детальный список:
 * дата, сумма, категория, комментарий, пользователь, касса.
 * Поддерживает фильтрацию (поиск), сортировку (по колонкам), экспорт (CSV).
 *
 * Компонент изолирован и read-only: не меняет данные кассы и не влияет
 * на остальную аналитику. При недоступности эндпоинта — безопасно
 * показывает ошибку через validateResErrors и пустую таблицу.
 */

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDateTime = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

// Нормализация записи кассы — терпима к разным именам полей бэкенда.
const normalizeFlow = (x) => {
  const amountRaw = Number(x?.amount ?? x?.sum ?? x?.value ?? x?.total ?? 0) || 0;
  let type = String(x?.type ?? x?.kind ?? x?.direction ?? "")
    .toLowerCase()
    .trim();
  if (type !== "income" && type !== "expense") {
    type = amountRaw >= 0 ? "income" : "expense";
  }
  return {
    id: x?.id ?? x?.uuid ?? null,
    type,
    amount: Math.abs(amountRaw),
    category:
      x?.category_title ??
      x?.category_name ??
      x?.category ??
      x?.source_business_operation_id ??
      "—",
    comment:
      x?.comment ?? x?.note ?? x?.description ?? x?.title ?? x?.name ?? "—",
    created_at:
      x?.created_at ?? x?.created ?? x?.date ?? x?.timestamp ?? x?.createdAt ?? null,
    user:
      x?.user_name ??
      x?.created_by_name ??
      x?.user ??
      x?.created_by ??
      x?.cashier_name ??
      "—",
    cashbox:
      x?.cashbox_name ??
      x?.department_name ??
      x?.box_name ??
      x?.cashbox ??
      "—",
  };
};

const SortHeader = ({ label, sortKey, sort, onSort, numeric }) => {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        textAlign: numeric ? "right" : "left",
      }}
      title="Сортировать"
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          justifyContent: numeric ? "flex-end" : "flex-start",
        }}
      >
        {label}
        <ArrowUpDown
          size={13}
          style={{ opacity: active ? 1 : 0.35 }}
        />
        {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
      </span>
    </th>
  );
};

const ProductionExpensesFromCash = ({ dateFrom, dateTo, date }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { type: "expense" };
      const from = dateFrom || date;
      const to = dateTo || date;
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const { data } = await api.get("/construction/cashflows/", { params });
      const list = Array.isArray(data) ? data : data?.results || [];
      // Подстраховка: даже если бэк не отфильтровал по type — оставляем только расходы.
      setRows(list.map(normalizeFlow).filter((r) => r.type === "expense"));
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить расходы из кассы"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, date]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = useCallback((key) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "created_at" || key === "amount" ? "desc" : "asc" },
    );
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? rows.filter((r) =>
          [r.category, r.comment, r.user, r.cashbox].some((v) =>
            String(v).toLowerCase().includes(q),
          ),
        )
      : rows.slice();

    const { key, dir } = sort;
    list.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === "amount") {
        av = Number(av);
        bv = Number(bv);
      } else if (key === "created_at") {
        av = new Date(av || 0).getTime();
        bv = new Date(bv || 0).getTime();
      } else {
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, search, sort]);

  const total = useMemo(
    () => filtered.reduce((s, r) => s + r.amount, 0),
    [filtered],
  );

  const exportCsv = useCallback(() => {
    const headers = [
      "Дата",
      "Сумма",
      "Категория",
      "Комментарий",
      "Пользователь",
      "Касса",
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(",")];
    for (const r of filtered) {
      lines.push(
        [
          fmtDateTime(r.created_at),
          r.amount.toFixed(2),
          r.category,
          r.comment,
          r.user,
          r.cashbox,
        ]
          .map(esc)
          .join(","),
      );
    }
    // BOM для корректной кириллицы в Excel
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-expenses-${dateFrom || date || ""}_${
      dateTo || date || ""
    }.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [filtered, dateFrom, dateTo, date]);

  return (
    <div className="agent-analytics__section">
      <div className="agent-analytics__table-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <h3
            className="agent-analytics__table-title"
            style={{ margin: 0 }}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Receipt size={20} />
              Расходы из кассы
            </span>
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск: категория, комментарий, касса…"
                style={{
                  height: 36,
                  padding: "0 12px 0 30px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  minWidth: 240,
                  outline: "none",
                }}
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
              style={{
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  loading || filtered.length === 0 ? "not-allowed" : "pointer",
                opacity: loading || filtered.length === 0 ? 0.5 : 1,
              }}
            >
              <Download size={15} />
              Экспорт CSV
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div className="agent-analytics__table">
          <table>
            <thead>
              <tr>
                <SortHeader
                  label="Дата"
                  sortKey="created_at"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Сумма (сом)"
                  sortKey="amount"
                  sort={sort}
                  onSort={toggleSort}
                  numeric
                />
                <SortHeader
                  label="Категория"
                  sortKey="category"
                  sort={sort}
                  onSort={toggleSort}
                />
                <th>Комментарий</th>
                <SortHeader
                  label="Пользователь"
                  sortKey="user"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Касса"
                  sortKey="cashbox"
                  sort={sort}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Загрузка…
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((r, index) => (
                  <tr key={r.id || index}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {fmtMoney(r.amount)}
                    </td>
                    <td>{r.category}</td>
                    <td>{r.comment}</td>
                    <td>{r.user}</td>
                    <td>{r.cashbox}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>Итого</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {fmtMoney(total)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductionExpensesFromCash;
