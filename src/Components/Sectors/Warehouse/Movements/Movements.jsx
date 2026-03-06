import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaFileInvoiceDollar,
  FaShoppingCart,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import warehouseAPI from "../../../../api/warehouse";
import "./Movements.scss";

const PAGE_SIZE = 15;

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

const WarehouseMovements = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("receipt");
  const [q, setQ] = useState("");
  const [receiptDocs, setReceiptDocs] = useState([]);
  const [saleDocs, setSaleDocs] = useState([]);
  const [loadingReceipt, setLoadingReceipt] = useState(true);
  const [loadingSale, setLoadingSale] = useState(true);
  const [page, setPage] = useState(1);

  const loadReceipt = useCallback(async () => {
    setLoadingReceipt(true);
    try {
      const data = await warehouseAPI.listReceiptDocuments({ page_size: 200 });
      const results = data?.results ?? (Array.isArray(data) ? data : []);
      setReceiptDocs(results);
    } catch {
      setReceiptDocs([]);
    } finally {
      setLoadingReceipt(false);
    }
  }, []);

  const loadSale = useCallback(async () => {
    setLoadingSale(true);
    try {
      const data = await warehouseAPI.listSaleDocuments({ page_size: 200 });
      const results = data?.results ?? (Array.isArray(data) ? data : []);
      setSaleDocs(results);
    } catch {
      setSaleDocs([]);
    } finally {
      setLoadingSale(false);
    }
  }, []);

  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);
  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const safeIncludes = (str = "", needle = "") =>
    (str + "").toLowerCase().includes((needle + "").toLowerCase());

  const filteredReceipt = useMemo(
    () =>
      (receiptDocs || []).filter(
        (r) =>
          safeIncludes(r?.number, q) ||
          safeIncludes(r?.counterparty_display_name, q) ||
          safeIncludes(r?.comment, q) ||
          safeIncludes(statusLabel(r?.status), q)
      ),
    [receiptDocs, q]
  );
  const filteredSale = useMemo(
    () =>
      (saleDocs || []).filter(
        (r) =>
          safeIncludes(r?.number, q) ||
          safeIncludes(r?.counterparty_display_name, q) ||
          safeIncludes(r?.comment, q) ||
          safeIncludes(statusLabel(r?.status), q)
      ),
    [saleDocs, q]
  );

  const source = tab === "receipt" ? filteredReceipt : filteredSale;
  const loading = tab === "receipt" ? loadingReceipt : loadingSale;
  const totalPages = Math.max(1, Math.ceil(source.length / PAGE_SIZE));
  const validPage = Math.min(page, totalPages);
  const pageItems = source.slice(
    (validPage - 1) * PAGE_SIZE,
    validPage * PAGE_SIZE
  );

  const goToCreateReceipt = () =>
    navigate("/crm/warehouse/documents/create?doc_type=RECEIPT");
  const goToCreateSale = () =>
    navigate("/crm/warehouse/documents/create?doc_type=SALE");

  return (
    <div className="sklad-movements">
      <div className="sklad-movements__header">
        <div className="sklad-movements__titleWrap">
          <h2 className="sklad-movements__title">
            {tab === "receipt" ? (
              <>
                <FaFileInvoiceDollar aria-hidden /> Приход
              </>
            ) : (
              <>
                <FaShoppingCart aria-hidden /> Отгрузки (продажа)
              </>
            )}
          </h2>
          <div className="sklad-movements__subtitle">
            Документы прихода товара на склад и отгрузки (продажи)
          </div>
        </div>

        <div className="sklad-movements__actions">
          <div
            className="sklad-movements__tabs"
            role="tablist"
            aria-label="Тип операции"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "receipt"}
              className={`sklad-movements__tab ${
                tab === "receipt" ? "is-active" : ""
              }`}
              onClick={() => {
                setTab("receipt");
                setPage(1);
              }}
            >
              Приход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "issue"}
              className={`sklad-movements__tab ${
                tab === "issue" ? "is-active" : ""
              }`}
              onClick={() => {
                setTab("issue");
                setPage(1);
              }}
            >
              Отгрузки
            </button>
          </div>

          <div className="sklad-movements__search">
            <input
              className="sklad-movements__searchInput"
              type="text"
              placeholder="Поиск: номер, контрагент, комментарий…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              aria-label="Поиск"
            />
          </div>

          <button
            className="sklad-movements__btn sklad-movements__btn--primary"
            type="button"
            onClick={tab === "receipt" ? goToCreateReceipt : goToCreateSale}
          >
            <FaPlus aria-hidden />
            <span className="sklad-movements__btnText">
              {tab === "receipt" ? "Новый приход" : "Новая отгрузка"}
            </span>
          </button>
        </div>
      </div>

      <div className="sklad-movements-table" aria-label="Документы">
        <table className="sklad-movements-table__table">
          <thead>
            <tr className="sklad-movements-table__head">
              <th className="sklad-movements-table__col">Номер</th>
              <th className="sklad-movements-table__col">Дата</th>
              <th className="sklad-movements-table__col">Контрагент</th>
              <th className="sklad-movements-table__col">Склад</th>
              <th className="sklad-movements-table__col">Сумма</th>
              <th className="sklad-movements-table__col">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="sklad-movements-table__empty">
                  Загрузка…
                </td>
              </tr>
            ) : !pageItems.length ? (
              <tr>
                <td colSpan={6} className="sklad-movements-table__empty">
                  Нет документов.
                </td>
              </tr>
            ) : (
              pageItems.map((r) => (
                <tr key={r.id} className="sklad-movements-table__row">
                  <td className="sklad-movements-table__col" data-label="Номер">
                    {r.number ?? "—"}
                  </td>
                  <td
                    className="sklad-movements-table__col sklad-movements__nowrap"
                    data-label="Дата"
                  >
                    {fmtDate(r.date)}
                  </td>
                  <td className="sklad-movements-table__col" data-label="Контрагент">
                    {r.counterparty_display_name ?? "—"}
                  </td>
                  <td className="sklad-movements-table__col" data-label="Склад">
                    {r.warehouse_from_name ?? "—"}
                  </td>
                  <td className="sklad-movements-table__col" data-label="Сумма">
                    {r.total != null
                      ? Number(r.total).toLocaleString("ru-RU")
                      : "—"}
                  </td>
                  <td className="sklad-movements-table__col" data-label="Статус">
                    <span className="sklad-movements__badge">
                      {statusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {source.length > PAGE_SIZE && (
        <div className="sklad-movements__pager" aria-label="Пагинация">
          <ul className="sklad-movements__pageList">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <li key={p}>
                <button
                  type="button"
                  className={`sklad-movements__pageBtn ${
                    p === validPage ? "is-active" : ""
                  }`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WarehouseMovements;
