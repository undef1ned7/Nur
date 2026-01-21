import React, { useState, useCallback, useEffect } from "react";
import { FaTimes, FaFilter, FaUndo, FaList, FaTh } from "react-icons/fa";
import { CafeSelect } from "../../common";
import "./TablesFiltersModal.scss";

const STATUSES = [
  { value: "", label: "Все статусы" },
  { value: "free", label: "Свободен" },
  { value: "busy", label: "Занят" },
];

const PLACES_OPTIONS = [
  { value: "", label: "Любое количество" },
  { value: "1", label: "1 место" },
  { value: "2", label: "2 места" },
  { value: "3", label: "3 места" },
  { value: "4", label: "4 места" },
  { value: "5", label: "5 мест" },
  { value: "6+", label: "6 и более мест" },
];

const SORT_OPTIONS = [
  { value: "number_asc", label: "По номеру (возр.)" },
  { value: "number_desc", label: "По номеру (убыв.)" },
  { value: "places_asc", label: "По местам (возр.)" },
  { value: "places_desc", label: "По местам (убыв.)" },
  { value: "zone", label: "По зоне" },
];

const TablesFiltersModal = ({
  isOpen,
  onClose,
  filters,
  onApply,
  zones = [],
  tablesView,
  onViewChange,
}) => {
  const [localFilters, setLocalFilters] = useState(() => ({
    zone: filters?.zone ?? "",
    status: filters?.status ?? "",
    places: filters?.places ?? "",
    sort: filters?.sort ?? "number_asc",
  }));

  // Синхронизация при открытии модалки
  useEffect(() => {
    if (isOpen) {
      setLocalFilters({
        zone: filters?.zone ?? "",
        status: filters?.status ?? "",
        places: filters?.places ?? "",
        sort: filters?.sort ?? "number_asc",
      });
    }
  }, [isOpen, filters]);

  const handleChange = useCallback((key, value) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setLocalFilters({
      zone: "",
      status: "",
      places: "",
      sort: "number_asc",
    });
  }, []);

  const handleApply = useCallback(() => {
    if (typeof onApply === "function") {
      onApply(localFilters);
    }
    onClose();
  }, [localFilters, onApply, onClose]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const zoneOptions = [
    { value: "", label: "Все зоны" },
    ...(zones || []).map((z) => ({ value: String(z.id), label: z.title })),
  ];

  const hasActiveFilters =
    localFilters.zone ||
    localFilters.status ||
    localFilters.places ||
    localFilters.sort !== "number_asc";

  if (!isOpen) return null;

  return (
    <div className="tables-filters-modal__overlay" onClick={handleOverlayClick}>
      <div className="tables-filters-modal">
        <div className="tables-filters-modal__header">
          <div className="tables-filters-modal__header-left">
            <FaFilter className="tables-filters-modal__header-icon" />
            <h3 className="tables-filters-modal__title">Фильтры</h3>
          </div>
          <button
            type="button"
            className="tables-filters-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="tables-filters-modal__body">
          {/* Переключатель вида */}
          <div className="tables-filters-modal__field">
            <label className="tables-filters-modal__label">Вид отображения</label>
            <div className="tables-filters-modal__tabs">
              <button
                type="button"
                className={`tables-filters-modal__tab ${tablesView === "manage" ? "tables-filters-modal__tab--active" : ""}`}
                onClick={() => onViewChange("manage")}
              >
                <FaList /> Список
              </button>
              <button
                type="button"
                className={`tables-filters-modal__tab ${tablesView === "hall" ? "tables-filters-modal__tab--active" : ""}`}
                onClick={() => onViewChange("hall")}
              >
                <FaTh /> Карточки
              </button>
            </div>
          </div>

          <div className="tables-filters-modal__divider" />

          <div className="tables-filters-modal__field">
            <label className="tables-filters-modal__label">Зона</label>
            <CafeSelect
              value={localFilters.zone}
              onChange={(v) => handleChange("zone", v)}
              options={zoneOptions}
              placeholder="Выберите зону"
            />
          </div>

          <div className="tables-filters-modal__field">
            <label className="tables-filters-modal__label">Статус</label>
            <CafeSelect
              value={localFilters.status}
              onChange={(v) => handleChange("status", v)}
              options={STATUSES}
              placeholder="Выберите статус"
            />
          </div>

          <div className="tables-filters-modal__field">
            <label className="tables-filters-modal__label">Количество мест</label>
            <CafeSelect
              value={localFilters.places}
              onChange={(v) => handleChange("places", v)}
              options={PLACES_OPTIONS}
              placeholder="Выберите количество мест"
            />
          </div>

          <div className="tables-filters-modal__field">
            <label className="tables-filters-modal__label">Сортировка</label>
            <CafeSelect
              value={localFilters.sort}
              onChange={(v) => handleChange("sort", v)}
              options={SORT_OPTIONS}
              placeholder="Выберите сортировку"
              hideClear
            />
          </div>
        </div>

        <div className="tables-filters-modal__footer">
          <button
            type="button"
            className="tables-filters-modal__btn tables-filters-modal__btn--secondary"
            onClick={handleReset}
            disabled={!hasActiveFilters}
          >
            <FaUndo /> Сбросить
          </button>
          <button
            type="button"
            className="tables-filters-modal__btn tables-filters-modal__btn--primary"
            onClick={handleApply}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

export default TablesFiltersModal;
