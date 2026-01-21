import React from "react";
import { FaTimes, FaFilter } from "react-icons/fa";
import BarberSelect from "../../common/BarberSelect";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новые" },
  { value: "confirmed", label: "Подтверждены" },
  { value: "no_show", label: "Не пришли" },
  { value: "spam", label: "Спам" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "price_desc", label: "По сумме ↓" },
  { value: "price_asc", label: "По сумме ↑" },
];

const FiltersModal = ({
  isOpen,
  onClose,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  masterFilter,
  setMasterFilter,
  masterOptions,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="barberrequests__filtersOverlay" onClick={onClose} />
      <div className="barberrequests__filtersPanel">
        <div className="barberrequests__filtersPanelHeader">
          <div className="barberrequests__filtersPanelTitleWrap">
            <FaFilter className="barberrequests__filtersPanelIcon" />
            <h3 className="barberrequests__filtersPanelTitle">Фильтры</h3>
          </div>
          <button
            type="button"
            className="barberrequests__filtersPanelClose"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="barberrequests__filtersPanelBody">
          <div className="barberrequests__filtersPanelRow">
            <label className="barberrequests__filtersPanelLabel">Статус</label>
            <BarberSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              placeholder="Все статусы"
              hideSearch
            />
          </div>

          <div className="barberrequests__filtersPanelRow">
            <label className="barberrequests__filtersPanelLabel">Сортировка</label>
            <BarberSelect
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS}
              placeholder="Сначала новые"
              hideSearch
            />
          </div>

          <div className="barberrequests__filtersPanelRow">
            <label className="barberrequests__filtersPanelLabel">Мастер</label>
            <BarberSelect
              value={masterFilter}
              onChange={setMasterFilter}
              options={masterOptions}
              placeholder="Все мастера"
            />
          </div>

          <div className="barberrequests__filtersPanelRow">
            <label className="barberrequests__filtersPanelLabel">Период</label>
            <div className="barberrequests__filtersPanelDates">
              <input
                type="date"
                className="barberrequests__filtersPanelDateInput"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="От"
              />
              <span className="barberrequests__filtersPanelDateSep">—</span>
              <input
                type="date"
                className="barberrequests__filtersPanelDateInput"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="До"
              />
            </div>
          </div>
        </div>

        <div className="barberrequests__filtersPanelFooter">
          <button
            type="button"
            className="barberrequests__filtersPanelClear"
            onClick={onClear}
          >
            Сбросить фильтры
          </button>
        </div>
      </div>
    </>
  );
};

export default FiltersModal;
