// import React, { useMemo } from "react";
// import { FaSearch, FaCheckCircle, FaClock, FaChevronDown } from "react-icons/fa";

// const CookHeader = ({
//   activeTab,
//   setActiveTab,
//   query,
//   setQuery,
//   statusFilter,
//   setStatusFilter,
//   statusOptions,
// }) => {
//   const selectedLabel = useMemo(() => {
//     const found = statusOptions.find((o) => o.value === statusFilter);
//     return found?.label || "Все статусы";
//   }, [statusOptions, statusFilter]);

//   return (
//     <>
//       <div className="cook__header">
//         <div className="cook__headText">
//           <h2 className="cook__title">Заказы повара</h2>
//           <div className="cook__subtitle">
//             Управление текущими задачами и просмотр истории
//           </div>
//         </div>

//         <div className="cook__tools">
//           <div className="cook__search">
//             <FaSearch className="cook__searchIcon" />
//             <input
//               className="cook__searchInput"
//               placeholder="Поиск: стол, клиент, блюдо, статус…"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               type="text"
//               autoComplete="off"
//             />
//             {query && (
//               <button
//                 className="cook__searchClear"
//                 onClick={() => setQuery("")}
//                 title="Очистить поиск"
//                 type="button"
//               >
//                 ×
//               </button>
//             )}
//           </div>

//           <div className="cook__combo" role="combobox" aria-expanded="false">
//             <FaChevronDown className="cook__comboIcon" />
//             <select
//               className="cook__comboSelect"
//               value={statusFilter}
//               onChange={(e) => setStatusFilter(e.target.value)}
//               aria-label="Фильтр по статусу"
//             >
//               {statusOptions.map((o) => (
//                 <option key={o.value} value={o.value}>
//                   {o.label}
//                 </option>
//               ))}
//             </select>
//             <div className="cook__comboValue" title={selectedLabel}>
//               {selectedLabel}
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="cook__tabs" role="tablist" aria-label="Разделы">
//         <button
//           className={`cook__tab ${activeTab === "current" ? "cook__tab--active" : ""}`}
//           onClick={() => setActiveTab("current")}
//           type="button"
//           role="tab"
//           aria-selected={activeTab === "current" ? "true" : "false"}
//         >
//           <FaClock /> Текущие задачи
//         </button>

//         <button
//           className={`cook__tab ${activeTab === "history" ? "cook__tab--active" : ""}`}
//           onClick={() => setActiveTab("history")}
//           type="button"
//           role="tab"
//           aria-selected={activeTab === "history" ? "true" : "false"}
//         >
//           <FaCheckCircle /> История
//         </button>
//       </div>
//     </>
//   );
// };

// export default CookHeader;



import React, { useMemo } from "react";
import { FaSearch, FaCheckCircle, FaClock, FaChevronDown, FaPlus } from "react-icons/fa";

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
  const selectedLabel = useMemo(() => {
    const found = statusOptions.find((o) => o.value === statusFilter);
    return found?.label || "Все статусы";
  }, [statusOptions, statusFilter]);

  return (
    <>
      <div className="cook__header">
        <div className="cook__headText">
          <h2 className="cook__title">Заказы повара</h2>
          <div className="cook__subtitle">Управление текущими задачами и просмотр истории</div>
        </div>

        <div className="cook__tools">
          <div className="cook__search">
            <FaSearch className="cook__searchIcon" />
            <input
              className="cook__searchInput"
              placeholder="Поиск: стол, клиент, блюдо, статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              autoComplete="off"
            />
            {query && (
              <button
                className="cook__searchClear"
                onClick={() => setQuery("")}
                title="Очистить поиск"
                type="button"
              >
                ×
              </button>
            )}
          </div>

          <div className="cook__combo" role="combobox" aria-expanded="false">
            <FaChevronDown className="cook__comboIcon" />
            <select
              className="cook__comboSelect"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Фильтр по статусу"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="cook__comboValue" title={selectedLabel}>
              {selectedLabel}
            </div>
          </div>

          <button
            type="button"
            className="cook__btn cook__btn--primary cook__btn--header"
            onClick={onCreateKitchen}
            title="Создать кухню"
          >
            <FaPlus /> Создать кухню
          </button>
        </div>
      </div>

      <div className="cook__tabs" role="tablist" aria-label="Разделы">
        <button
          className={`cook__tab ${activeTab === "current" ? "cook__tab--active" : ""}`}
          onClick={() => setActiveTab("current")}
          type="button"
          role="tab"
          aria-selected={activeTab === "current" ? "true" : "false"}
        >
          <FaClock /> Текущие задачи
        </button>

        <button
          className={`cook__tab ${activeTab === "history" ? "cook__tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
          type="button"
          role="tab"
          aria-selected={activeTab === "history" ? "true" : "false"}
        >
          <FaCheckCircle /> История
        </button>
      </div>
    </>
  );
};

export default CookHeader;
