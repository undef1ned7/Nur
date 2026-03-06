import { FaSearch, FaCheckCircle, FaClock, FaPlus, FaUtensils } from "react-icons/fa";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";

const CookHeader = ({
  activeTab,
  setActiveTab,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  statusOptions,
  onCreateKitchen,
}) => {
  
  return (
    <>
      <div className="cafeCook__header">
        <div className="cafeCook__headText">
          <h2 className="cafeCook__title">Заказы повара</h2>
          <div className="cafeCook__subtitle">Управление текущими задачами и просмотр истории</div>
        </div>

        <div className="cafeCook__tools">
          <div className="cafeCook__search">
            <FaSearch className="cafeCook__searchIcon" />
            <input
              className="cafeCook__searchInput"
              placeholder="Поиск: стол, клиент, блюдо, статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              autoComplete="off"
            />
            {query && (
              <button
                className="cafeCook__searchClear"
                onClick={() => setQuery("")}
                title="Очистить поиск"
                type="button"
              >
                ×
              </button>
            )}
          </div>

          <div className="cafeCook__filter">
            <SearchableCombobox
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="Фильтр по статусу…"
              classNamePrefix="cafeCook__combo"
            />
          </div>

          <button
            type="button"
            className="cafeCook__btn cafeCook__btn--primary cafeCook__btn--header"
            onClick={onCreateKitchen}
            title="Создать кухню"
          >
            <FaPlus /> Создать кухню
          </button>
        </div>
      </div>

      <div className="cafeCook__tabs" role="tablist" aria-label="Разделы">
        <button
          className={`cafeCook__tab ${activeTab === "current" ? "cafeCook__tab--active" : ""}`}
          onClick={() => setActiveTab("current")}
          type="button"
          role="tab"
          aria-selected={activeTab === "current" ? "true" : "false"}
        >
          <FaClock /> Текущие задачи
        </button>

        <button
          className={`cafeCook__tab ${activeTab === "history" ? "cafeCook__tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
          type="button"
          role="tab"
          aria-selected={activeTab === "history" ? "true" : "false"}
        >
          <FaCheckCircle /> История
        </button>

        <button
          className={`cafeCook__tab ${activeTab === "kitchens" ? "cafeCook__tab--active" : ""}`}
          onClick={() => setActiveTab("kitchens")}
          type="button"
          role="tab"
          aria-selected={activeTab === "kitchens" ? "true" : "false"}
        >
          <FaUtensils /> Кухни
        </button>
      </div>
    </>
  );
};

export default CookHeader;
