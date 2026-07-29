/**
 * Сотрудники → Рейтинг (ТЗ №6).
 *
 * Та же метрика, что в карточке, но по всей команде и с сортировкой: кто
 * закрывает, а кто копит отложенные. Собирать это руками больше не нужно.
 */
import { useEffect, useState } from "react";
import { getEmployeesRating } from "../../../../api/consultingEmployees";
import {
  ListState,
  Pagination,
  PeriodFilter,
  SearchInput,
} from "../common/ListControls";
import {
  fmtInt,
  fmtMoney,
  fmtPercent,
  num,
  periodRange,
  plural,
} from "../common/listUtils";
import useConsultingList from "../common/useConsultingList";

const COLUMNS = [
  { key: "name", label: "Сотрудник", sortable: false },
  { key: "leads", label: "Лидов", num: true },
  { key: "deferred", label: "Отложено", num: true },
  { key: "overdue", label: "Просрочено", num: true },
  { key: "deals", label: "Сделок", num: true },
  { key: "conversion", label: "Конверсия", num: true },
  { key: "revenue", label: "Выручка", num: true },
  { key: "kpi", label: "КПД", num: true },
];

export default function EmployeesRating({ onOpenEmployee }) {
  const [range, setRange] = useState({ date_from: "", date_to: "" });

  useEffect(() => {
    setRange(periodRange("month"));
  }, []);

  const list = useConsultingList({
    fetcher: getEmployeesRating,
    filters: { ordering: "-kpi", date_from: "", date_to: "" },
    prefix: "rt",
  });

  // Период живёт отдельным состоянием, но в запрос уходит через те же фильтры.
  useEffect(() => {
    if (range.date_from && range.date_from !== list.filters.date_from) {
      list.setFilters({ date_from: range.date_from, date_to: range.date_to });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.date_from, range.date_to]);

  const toggleSort = (key) => {
    const current = list.filters.ordering || "";
    list.setFilter("ordering", current === `-${key}` ? key : `-${key}`);
  };

  return (
    <div className="teachers__rating">
      <div className="cList__toolbar">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearch}
          placeholder="Сотрудник…"
          ariaLabel="Поиск сотрудников"
        />
        <PeriodFilter
          dateFrom={range.date_from}
          dateTo={range.date_to}
          onChange={setRange}
        />
      </div>

      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="Рейтинг подключается"
          notReadyText="После реализации на сервере здесь появится сравнение всей команды по конверсии, выручке и КПД."
          emptyTitle="Нет данных за период"
          hasActiveFilters={list.hasActiveFilters}
          onResetFilters={list.resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.num ? "cList__num" : undefined}
                    onClick={
                      c.sortable === false ? undefined : () => toggleSort(c.key)
                    }
                    style={c.sortable === false ? undefined : { cursor: "pointer" }}
                    title={c.sortable === false ? undefined : "Сортировать"}
                  >
                    {c.label}
                    {list.filters.ordering?.replace("-", "") === c.key && (
                      <span aria-hidden>
                        {list.filters.ordering.startsWith("-") ? " ↓" : " ↑"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.items.map((row, idx) => (
                <tr
                  key={row.user || idx}
                  onClick={() => onOpenEmployee?.(row)}
                  style={{ cursor: onOpenEmployee ? "pointer" : undefined }}
                >
                  <td>
                    <span className="teachers__ratingPlace">
                      {(list.page - 1) * list.pageSize + idx + 1}
                    </span>
                    {row.name || row.user_display || "—"}
                  </td>
                  <td className="cList__num">{fmtInt(row.leads)}</td>
                  <td className="cList__num">{fmtInt(row.deferred)}</td>
                  <td
                    className={`cList__num${num(row.overdue) ? " teachers__cellDanger" : ""}`}
                  >
                    {fmtInt(row.overdue)}
                  </td>
                  <td className="cList__num">{fmtInt(row.deals)}</td>
                  <td className="cList__num">{fmtPercent(row.conversion)}</td>
                  <td className="cList__num">{fmtMoney(row.revenue)}</td>
                  <td className="cList__num">
                    <b>{fmtInt(row.kpi)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        count={list.count}
        pageSize={list.pageSize}
        onPage={list.setPage}
        onPageSize={list.setPageSize}
        unitLabel={plural.employees}
        loading={list.loading}
      />
    </div>
  );
}
