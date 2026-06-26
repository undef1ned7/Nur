import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  listSummaries,
  getSummaryCalendar,
  getSummary,
  deleteSummary,
} from "../../../../../../api/warehouseSummaries";
import { fetchEmployeesApi } from "../../../../../../api/employees";
import { useAlert, useConfirm } from "../../../../../../hooks/useDialog";
import { normalizeSummary } from "./summaryAggregation";
import SummaryCalendar from "./SummaryCalendar";
import SummaryList from "./SummaryList";
import SummaryCreateModal from "./SummaryCreateModal";
import SummaryViewModal from "./SummaryViewModal";
import SummaryPreviewModal from "./SummaryPreviewModal";
import "./Summary.scss";

const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
};
const monthOf = (dateStr) => (dateStr || todayStr()).slice(0, 7);
const empName = (e) =>
  e?.full_name ||
  `${e?.first_name || ""} ${e?.last_name || ""}`.trim() ||
  e?.name ||
  e?.email ||
  "Без имени";
const asList = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const SummarySection = () => {
  const alert = useAlert();
  const confirm = useConfirm();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [month, setMonth] = useState(monthOf(todayStr()));
  const [countsByDate, setCountsByDate] = useState({});

  // Фильтры
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("");
  const [agent, setAgent] = useState("");
  const [author, setAuthor] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  // Справочники для фильтров
  const [agents, setAgents] = useState([]);
  const [authors, setAuthors] = useState([]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Модалки
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [editSummary, setEditSummary] = useState(null);
  const [pdfSummary, setPdfSummary] = useState(null);

  const usePeriod = Boolean(periodFrom || periodTo);

  // debounce поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Справочники (агенты + авторы) один раз
  useEffect(() => {
    fetchEmployeesApi({ page_size: 500 })
      .then((data) => {
        const list = asList(data);
        setAgents(
          list
            .filter((e) => String(e.role || "").toLowerCase() === "agent")
            .map((e) => ({ id: String(e.id), name: empName(e) })),
        );
        setAuthors(list.map((e) => ({ id: String(e.id), name: empName(e) })));
      })
      .catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const params = { page_size: 100, ordering: "-created_at" };
    if (usePeriod) {
      if (periodFrom) params.date_from = periodFrom;
      if (periodTo) params.date_to = periodTo;
    } else if (selectedDate) {
      params.date = selectedDate;
    }
    if (type) params.type = type;
    if (agent) params.agent = agent;
    if (author) params.author = author;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [usePeriod, periodFrom, periodTo, selectedDate, type, agent, author, debouncedSearch]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSummaries(buildParams());
      setItems(asList(data));
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await getSummaryCalendar(month);
      const map = {};
      (data?.days || []).forEach((d) => {
        if (d?.date) map[d.date] = d.count;
      });
      setCountsByDate(map);
    } catch (e) {
      setCountsByDate({});
    }
  }, [month]);

  useEffect(() => {
    loadList();
  }, [loadList]);
  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const refresh = () => {
    loadList();
    loadCalendar();
  };

  const handleDelete = (s) => {
    confirm(`Удалить сводку «${s.name || ""}»?`, async (ok) => {
      if (!ok) return;
      try {
        await deleteSummary(s.id);
        refresh();
      } catch (e) {
        alert("Не удалось удалить сводку", true);
      }
    });
  };

  const handleQuickPdf = async (s) => {
    try {
      const full = await getSummary(s.id);
      setPdfSummary(normalizeSummary(full));
    } catch (e) {
      alert("Не удалось загрузить сводку для PDF", true);
    }
  };

  const resetFilters = () => {
    setType("");
    setAgent("");
    setAuthor("");
    setPeriodFrom("");
    setPeriodTo("");
    setSearch("");
  };

  const hasFilters =
    type || agent || author || periodFrom || periodTo || search;

  const listTitle = useMemo(() => {
    if (usePeriod) {
      const f = periodFrom || "…";
      const t = periodTo || "…";
      return `Период ${f} — ${t}`;
    }
    return `Сводки за ${selectedDate}`;
  }, [usePeriod, periodFrom, periodTo, selectedDate]);

  return (
    <div className="summary-section">
      <div className="summary-section__layout">
        {/* Календарь */}
        <aside className="summary-section__side">
          <SummaryCalendar
            month={month}
            selectedDate={usePeriod ? null : selectedDate}
            countsByDate={countsByDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setPeriodFrom("");
              setPeriodTo("");
            }}
            onMonthChange={setMonth}
          />

          {/* Период */}
          <div className="summary-period">
            <div className="summary-period__title">Период</div>
            <div className="summary-period__row">
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
              <span>—</span>
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
          </div>
        </aside>

        {/* Основная колонка */}
        <main className="summary-section__main">
          <div className="summary-section__toolbar">
            <div className="summary-section__title">{listTitle}</div>
            <button
              className="summary-btn summary-btn--primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} /> Создать сводку
            </button>
          </div>

          {/* Фильтры */}
          <div className="summary-filters">
            <div className="summary-filters__search">
              <Search size={16} />
              <input
                placeholder="Поиск по названию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Все типы</option>
              <option value="general">Общая</option>
              <option value="by_agents">По агентам</option>
            </select>
            <select value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">Все агенты</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select value={author} onChange={(e) => setAuthor(e.target.value)}>
              <option value="">Все авторы</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button className="summary-filters__reset" onClick={resetFilters}>
                <X size={14} /> Сбросить
              </button>
            )}
          </div>

          <SummaryList
            items={items}
            loading={loading}
            onOpen={(s) => setViewId(s.id)}
            onEdit={(s) => setEditSummary(s)}
            onDelete={handleDelete}
            onPdf={handleQuickPdf}
          />
        </main>
      </div>

      {/* Модалки */}
      {createOpen && (
        <SummaryCreateModal
          date={usePeriod ? todayStr() : selectedDate}
          onClose={() => setCreateOpen(false)}
          onSaved={(created) => {
            setCreateOpen(false);
            refresh();
            if (created?.id) setViewId(created.id);
          }}
        />
      )}

      {editSummary && (
        <SummaryCreateModal
          summary={editSummary}
          onClose={() => setEditSummary(null)}
          onSaved={() => {
            setEditSummary(null);
            refresh();
          }}
        />
      )}

      {viewId && (
        <SummaryViewModal
          id={viewId}
          onClose={() => setViewId(null)}
          onEdit={(s) => {
            setViewId(null);
            setEditSummary(s);
          }}
          onDeleted={() => {
            setViewId(null);
            refresh();
          }}
          onChanged={refresh}
        />
      )}

      {pdfSummary && (
        <SummaryPreviewModal
          summary={pdfSummary}
          onClose={() => setPdfSummary(null)}
        />
      )}
    </div>
  );
};

export default SummarySection;
