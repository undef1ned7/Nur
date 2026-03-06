import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaBalanceScale, FaPlus, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import warehouseAPI from "../../../../api/warehouse";
import "./WriteOffs.scss";

const PAGE = 15;

const fmtDate = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("ru-RU");
  } catch {
    return String(v);
  }
};

const statusLabel = (s) =>
  s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—";

const WarehouseWriteOffs = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await warehouseAPI.listWriteOffDocuments({ page_size: 200 });
      const results = data?.results ?? (Array.isArray(data) ? data : []);
      setList(results);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!q?.trim()) return list;
    const lower = q.toLowerCase().trim();
    return list.filter(
      (r) =>
        (r.number ?? "").toLowerCase().includes(lower) ||
        (r.comment ?? "").toLowerCase().includes(lower) ||
        (r.warehouse_from_name ?? "").toLowerCase().includes(lower) ||
        statusLabel(r.status).toLowerCase().includes(lower)
    );
  }, [list, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const goToCreate = () =>
    navigate("/crm/warehouse/documents/create?doc_type=WRITE_OFF");

  return (
    <section className="sklad-writeoff" aria-label="Списание со склада">
      <div className="sklad-writeoff__header">
        <div className="sklad-writeoff__titleWrap">
          <h2 className="sklad-writeoff__title">
            <FaBalanceScale aria-hidden /> Списание
          </h2>
          <div className="sklad-writeoff__subtitle">
            Документы списания товара со склада
          </div>
        </div>

        <div className="sklad-writeoff__actions">
          <div className="sklad-writeoff__search">
            <input
              className="sklad-writeoff__searchInput"
              type="text"
              placeholder="Поиск: номер, комментарий, склад…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              aria-label="Поиск по списаниям"
            />
          </div>

          <button
            className="sklad-writeoff__btn sklad-writeoff__btn--primary"
            type="button"
            onClick={goToCreate}
          >
            <FaPlus aria-hidden />
            <span className="sklad-writeoff__btnText">Новое списание</span>
          </button>
        </div>
      </div>

      <div className="sklad-writeoff-table" aria-label="Списания">
        <table className="sklad-writeoff-table__table">
          <thead>
            <tr className="sklad-writeoff-table__head">
              <th className="sklad-writeoff-table__col">Номер</th>
              <th className="sklad-writeoff-table__col">Дата</th>
              <th className="sklad-writeoff-table__col">Склад</th>
              <th className="sklad-writeoff-table__col">Сумма</th>
              <th className="sklad-writeoff-table__col">Статус</th>
              <th className="sklad-writeoff-table__col">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="sklad-writeoff-table__empty" role="status">
                  Загрузка…
                </td>
              </tr>
            ) : !pageItems.length ? (
              <tr>
                <td colSpan={6} className="sklad-writeoff-table__empty" role="status">
                  Нет документов списания.
                </td>
              </tr>
            ) : (
              pageItems.map((r) => (
                <tr key={r.id} className="sklad-writeoff-table__row">
                  <td className="sklad-writeoff-table__col">{r.number ?? "—"}</td>
                  <td className="sklad-writeoff-table__col">{fmtDate(r.date)}</td>
                  <td className="sklad-writeoff-table__col">{r.warehouse_from_name ?? "—"}</td>
                  <td className="sklad-writeoff-table__col">
                    {r.total != null
                      ? Number(r.total).toLocaleString("ru-RU")
                      : "—"}
                  </td>
                  <td className="sklad-writeoff-table__col">{statusLabel(r.status)}</td>
                  <td className="sklad-writeoff-table__col">{r.comment ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE && (
        <nav
          className="sklad-writeoff__pager"
          aria-label="Постраничная навигация"
        >
          <ul className="sklad-writeoff__pageList">
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
              (p) => (
                <li key={p}>
                  <button
                    type="button"
                    className={`sklad-writeoff__pageBtn ${
                      p === safePage ? "is-active" : ""
                    }`}
                    onClick={() => setPage(p)}
                    aria-current={p === safePage ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              )
            )}
          </ul>
        </nav>
      )}
    </section>
  );
};

export default WarehouseWriteOffs;
