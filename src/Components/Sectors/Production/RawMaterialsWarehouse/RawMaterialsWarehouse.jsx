import { useEffect, useMemo, useState, useRef } from "react";
import { useProducts } from "../../../../store/slices/productSlice";
import { useDispatch } from "react-redux";
import {
  createItemMake,
  fetchCategoriesAsync,
  fetchProductsAsync,
  getItemsMake,
  // EDIT: добавлены санки редактирования/удаления сырья
  updateItemsMake,
  deleteItemsMake,
} from "../../../../store/creators/productCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { Plus, X, Search, LayoutGrid, Table2 } from "lucide-react";
import { useUser } from "../../../../store/slices/userSlice";
import AddRawMaterials from "../AddRawMaterials/AddRawMaterials";
import "../../Market/Warehouse/Warehouse.scss";
import { useAlert, useConfirm, useErrorModal } from "../../../../hooks/useDialog";
import useResize from "../../../../hooks/useResize";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/* ---------- helpers ---------- */
const toStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const toEndOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const safeDate = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/* =========================================
   AddModal — добавление сырья
   ========================================= */
const AddModal = ({ onClose, selectCashBox, onSaved }) => {
  const alert = useAlert()
  const error = useErrorModal()
  const { company } = useUser();
  const [state, setState] = useState({
    name: "",
    price: "",
    quantity: "",
    unit: "",
  });
  const dispatch = useDispatch();
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Сырье",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      // EDIT: count -> quantity
      const result = await dispatch(createItemMake(state)).unwrap();

      await dispatch(
        addCashFlows({
          ...cashData,
          amount: (Number(state?.price) || 0) * (Number(state?.quantity) || 0),
          source_cashbox_flow_id: result.id,
        })
      ).unwrap();
      alert('Сырье добавлен!', () => {
        onSaved?.();
        onClose();
      })
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка при добавлении сырья");
      error(errorMessage);
    }
  };

  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: state.name,
      amount: state.price,
    }));
  }, [state, selectCashBox]);

  return (
    <div className="add-modal raw-modal">
      <div className="add-modal__overlay z-50!" onClick={onClose} />
      <form className="add-modal__content z-50!" onSubmit={onSubmit}>
        <div className="add-modal__header">
          <h3>Добавление сырья</h3>
          <button
            className="add-modal__close-icon"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="add-modal__section">
          <label>Название *</label>
          <input
            name="name"
            value={state.name}
            onChange={onChange}
            required
            placeholder="Название *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Ед. измерения *</label>
          <input
            name="unit"
            value={state.unit}
            onChange={onChange}
            required
            placeholder="Ед. измерения *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Цена *</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={state.price}
            onChange={onChange}
            required
            placeholder="Цена *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Количество *</label>
          <input
            name="quantity"
            type="number"
            min="0"
            step="0.0001"

            value={state.quantity}
            onChange={onChange}
            required
            placeholder="Количество *"
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="add-modal__save">Добавить</button>
        </div>
      </form>
    </div>
  );
};

/* =========================================
   EditModal — редактирование/удаление сырья
   Поля: name, unit, price, quantity
   ========================================= */
const EditModal = ({ item, onClose, onSaved, onDeleted }) => {
  const alert = useAlert()
  const confirm = useConfirm()
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    unit: item?.unit ?? "",
    price: item?.price ?? "",
    quantity: item?.quantity ?? "",
  });

  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const onChange = (e) => {
    const { name, value, type } = e.target;
    setForm((p) => ({
      ...p,
      [name]: type === "number" ? (value === "" ? "" : value) : value,
    }));
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
      };

      await dispatch(
        updateItemsMake({ id: item.id, updatedData: payload })
      ).unwrap();
      alert('Редактировано!', () => {
        setSaving(false);
        onSaved?.();
        onClose();
      })
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка при обновлении сырья");
      alert(errorMessage,
        () => {
          setSaving(false);
        }, true);
    }
  };

  const onDelete = async () => {
    confirm(`Удалить сырьё «${item?.name}»?`, async (result) => {
      if (result) {
        try {
          setDeleting(true);
          await dispatch(deleteItemsMake(item.id)).unwrap();
          setDeleting(false);
          onDeleted?.();
          onClose();
        } catch (e) {
          setDeleting(false);
          const errorMessage = validateResErrors(e, "Ошибка при удалении сырья");
          alert(errorMessage, true);
        }
      } else {
        setDeleting(false);
      }
    })
  };

  return (
    <div className="add-modal raw-modal">
      <div className="add-modal__overlay z-50!" onClick={onClose} />
      <div className="add-modal__content z-50!">
        <div className="add-modal__header">
          <h3>Редактирование сырья</h3>
          <X className="add-modal__close-icon" onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Название *</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Ед. измерения *</label>
          <input
            name="unit"
            value={form.unit}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Цена *</label>
          <input
            type="number"
            name="price"
            min="0"
            step="0.01"
            value={form.price}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__section">
          <label>Количество *</label>
          <input
            type="number"
            name="quantity"
            min="0"
            step="0.0001"
            max={2147483647}
            value={form.quantity}
            onChange={onChange}
            required
            className="add-modal__input"
          />
        </div>

        <div className="add-modal__footer">
          <button
            className="add-modal__save bg-red-400! text-white!"
            onClick={onDelete}
            disabled={saving || deleting}
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
          <button
            className="add-modal__save"
            onClick={onSave}
            disabled={saving || deleting}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================
   Основной экран «Склад сырья»
   ========================================= */
const RawMaterialsWarehouse = () => {
  const { categories, loading, error, itemsMake: products } = useProducts();
  const { list: cashBoxes } = useCash();
  const dispatch = useDispatch();

  // --- UI state ---
  const [selectCashBox, setSelectCashBox] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // EDIT: состояние для редактирования
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemId, setItemId] = useState(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // View mode (table/cards)
  const STORAGE_KEY = "raw_materials_view_mode";
  const getInitialViewMode = () => {
    if (typeof window === "undefined") return "table";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "table" || saved === "cards") return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? "cards" : "table";
  };
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const debounceTimerRef = useRef(null);
  const { isMobile } = useResize(({ isMobile }) => {
    if (isMobile) {
      setViewMode('cards')
    } else {
      setViewMode(getInitialViewMode())
    }
  });

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Сохраняем режим просмотра в localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    dispatch(fetchProductsAsync());
    dispatch(fetchCategoriesAsync());
    dispatch(getCashBoxes());
    dispatch(getItemsMake());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const refresh = () => {
    dispatch(getItemsMake());
  };

  // --- Filtering ---
  const filtered = useMemo(() => {
    const from = dateFrom ? toStartOfDay(dateFrom) : null;
    const to = dateTo ? toEndOfDay(dateTo) : null;
    const q = debouncedSearch.trim().toLowerCase();

    return (products || [])
      .filter((p) => {
        if (
          q &&
          !String(p.name || "")
            .toLowerCase()
            .includes(q)
        )
          return false;

        if (categoryId && String(p.category) !== String(categoryId))
          return false;

        const created = safeDate(p.created_at);
        if (!created) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;

        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [products, debouncedSearch, categoryId, dateFrom, dateTo]);

  const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

  const handleOpen = (id) => {
    setShowAddProductModal(true);
    setItemId(id);
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryId("");
    setDateFrom("");
    setDateTo("");
  };

  const openEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  return (
    <div className="warehouse-page">
      {/* Header */}
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📦</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Склад сырья</h1>
            <p className="warehouse-header__subtitle">
              Управление сырьем и материалами
            </p>
          </div>
        </div>
        <button
          className="warehouse-header__create-btn"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} />
          Добавить сырье
        </button>
      </div>

      {/* Search and Filters */}
      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <Search className="warehouse-search__icon" size={18} />
          <input
            type="text"
            className="warehouse-search__input"
            placeholder="Поиск по названию сырья..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            Всего: {products?.length || 0} • Найдено: {filtered.length}
          </span>

          {/* Category filter */}
          <select
            className="warehouse-search__input"
            style={{ width: "auto", minWidth: "180px" }}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {/* Date filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 flex gap-2 justify-between items-center">
              <label className="text-sm text-slate-600">От:</label>
              <input
                type="date"
                className="warehouse-search__input flex-1"
                style={{ width: "auto", minWidth: "140px" }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 items-center gap-2 flex justify-between">
              <label className="text-sm  text-slate-600">До:</label>
              <input
                type="date"
                className="warehouse-search__input flex-1"
                style={{ width: "auto", minWidth: "140px" }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {(dateFrom || dateTo || search || categoryId) && (
              <button
                type="button"
                className="warehouse-search__filter-btn"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            )}
          </div>

          {/* View toggle */}
          {!isMobile && (<div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${viewMode === "table"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-black"
                }`}
            >
              <Table2 size={16} />
              Таблица
            </button>

            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${viewMode === "cards"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-black"
                }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>)}
        </div>
      </div>

      {/* Products */}
      <DataContainer>
        <div className="warehouse-table-container w-full">
          {/* ===== TABLE ===== */}
          {viewMode === "table" && (
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="warehouse-table w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Название</th>
                    <th>Ед.</th>
                    <th>Дата</th>
                    <th>Цена</th>
                    <th>Количество</th>
                    <th>Действия</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="warehouse-table__loading">
                        Загрузка...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={7} className="warehouse-table__empty">
                        Ошибка загрузки
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="warehouse-table__empty">
                        Сырье не найдено
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, index) => (
                      <tr key={item.id} className="warehouse-table__row">
                        <td>{index + 1}</td>
                        <td className="warehouse-table__name">
                          <div className="warehouse-table__name-cell">
                            <span>{item.name || "—"}</span>
                          </div>
                        </td>
                        <td>{item.unit || "—"}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>{formatPrice(item.price)}</td>
                        <td>
                          {item.quantity === 0 ? (
                            <span
                              style={{
                                padding: "4px 8px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                borderRadius: "6px",
                                fontSize: "12px",
                              }}
                            >
                              Нет в наличии
                            </span>
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="warehouse-header__create-btn"
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                background: "#f7d74f",
                                color: "black",
                              }}
                              onClick={() => handleOpen(item)}
                            >
                              Добавить
                            </button>
                            <button
                              className="warehouse-header__create-btn"
                              style={{
                                padding: "6px 12px",
                                fontSize: "12px",
                                // background: "#3b82f6",
                                // color: "#fff",
                              }}
                              onClick={() => openEdit(item)}
                            >
                              Редактировать
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== CARDS ===== */}
          {viewMode === "cards" && (
            <div className="block">
              {loading ? (
                <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Загрузка...
                </div>
              ) : error ? (
                <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Ошибка загрузки
                </div>
              ) : filtered.length === 0 ? (
                <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                  Сырье не найдено
                </div>
              ) : (
                <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((item, idx) => (
                    <div
                      key={item.id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-500">#{idx + 1}</div>
                        <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
                          {item.name || "—"}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="whitespace-nowrap">
                            Ед. изм:{" "}
                            <span className="font-medium">
                              {item.unit || "—"}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Цена</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {formatPrice(item.price)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Дата</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="col-span-2 rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Количество</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {item.quantity === 0 ? (
                              <span
                                style={{
                                  padding: "2px 6px",
                                  background: "#fee2e2",
                                  color: "#dc2626",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                }}
                              >
                                Нет в наличии
                              </span>
                            ) : (
                              item.quantity
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="mt-4 flex flex-wrap gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="warehouse-header__create-btn"
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            background: "#f7d74f",
                            color: "black",
                            flex: "1",
                            minWidth: "80px",
                          }}
                          onClick={() => handleOpen(item)}
                        >
                          Добавить
                        </button>
                        <button
                          className="warehouse-header__create-btn"
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            // background: "#3b82f6",
                            color: "#000",
                            flex: "1",
                            minWidth: "80px",
                          }}
                          onClick={() => openEdit(item)}
                        >
                          Редактировать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DataContainer>

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          selectCashBox={selectCashBox}
          onSaved={refresh}
        />
      )}

      {showEditModal && selectedItem && (
        <EditModal
          item={selectedItem}
          onClose={() => {
            setShowEditModal(false);
            setSelectedItem(null);
          }}
          onSaved={refresh}
          onDeleted={refresh}
        />
      )}
      {showAddProductModal && (
        <AddRawMaterials
          onClose={() => setShowAddProductModal(false)}
          onChanged={() => dispatch(getItemsMake()).unwrap()}
          item={itemId}
        />
      )}
    </div>
  );
};

export default RawMaterialsWarehouse;
