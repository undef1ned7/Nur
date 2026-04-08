import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Package, Search, User, X } from "lucide-react";
import api from "../../../../../api";
import "./DeletionsLogModal.scss";

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const DeletionsLogModal = ({ onClose }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      try {
        const aggregated = [];
        let nextUrl = "/main/pos/cart-item-deletions/";
        let pages = 0;
        const maxPages = 100;

        while (nextUrl && pages < maxPages) {
          const { data } = await api.get(nextUrl);
          aggregated.push(...normalizeRows(data));
          nextUrl = data?.next || null;
          pages += 1;
        }

        setRows(aggregated);
      } catch (error) {
        console.error("Ошибка загрузки журнала удалений:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadRows();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const productName = String(row?.product_name || "").toLowerCase();
      const deletedBy = String(
        row?.deleted_by_display || row?.deleted_by || "",
      ).toLowerCase();
      const quantity = String(row?.quantity || "").toLowerCase();
      return (
        productName.includes(query) ||
        deletedBy.includes(query) ||
        quantity.includes(query)
      );
    });
  }, [rows, search]);

  return (
    <div className="deletions-log-modal-overlay" onClick={onClose}>
      <div className="deletions-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deletions-log-modal__header">
          <h2 className="deletions-log-modal__title">Журнал удалений</h2>
          <button className="deletions-log-modal__close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="deletions-log-modal__toolbar">
          <div className="deletions-log-modal__searchWrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Поиск по товару, сотруднику, количеству"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="deletions-log-modal__count">
            Записей: {filteredRows.length}
          </div>
        </div>

        <div className="deletions-log-modal__tableWrap">
          {loading ? (
            <div className="deletions-log-modal__state">Загрузка...</div>
          ) : filteredRows.length === 0 ? (
            <div className="deletions-log-modal__state">Записи не найдены</div>
          ) : (
            <table className="deletions-log-modal__table">
              <thead>
                <tr>
                  <th>
                    <Package size={14} /> Товар
                  </th>
                  <th>Кол-во</th>
                  <th>
                    <User size={14} /> Удалил
                  </th>
                  <th>
                    <Calendar size={14} /> Дата
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={`${row?.cart_id || "cart"}-${row?.product || "p"}-${idx}`}>
                    <td>{row?.product_name || "-"}</td>
                    <td>{row?.quantity ?? "-"}</td>
                    <td>{row?.deleted_by_display || row?.deleted_by || "-"}</td>
                    <td>{formatDateTime(row?.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="deletions-log-modal__footer">
          <button className="deletions-log-modal__btn" onClick={onClose}>
            Закрыть [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeletionsLogModal;
