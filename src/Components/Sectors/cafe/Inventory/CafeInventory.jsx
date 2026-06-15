import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaTools,
  FaEdit,
  FaTrash,
  FaClipboardList,
  FaCheckCircle,
  FaBoxes,
  FaThList,
  FaUtensils,
} from "react-icons/fa";
import HouseholdInventoryTab from "./HouseholdInventoryTab";
import api from "../../../../api";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import InventoryItemsPickerModal from "./InventoryItemsPickerModal";
import "./CafeInventory.scss";
import ReactPortal from "../../../common/Portal/ReactPortal";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { suppressOfflineError } from "../../../../utils/cafeOfflineError";
import {
  pickExpenseIdFromResponse,
  recordCafePurchaseExpense,
} from "../../../../../tools/cafePurchaseExpense";

/* helpers */
const listFrom = (res) => res?.data?.results || res?.data || [];
const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const numStr = (n) => String(Number(n) || 0).replace(",", ".");
const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
};

const CafeInventory = () => {
  const alert = useAlert();
  const [activeTab, setActiveTab] = useState("equipment"); // "equipment", "sessions" или "stock-check"
  const [equipment, setEquipment] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [warehouseItems, setWarehouseItems] = useState([]);
  const [stockCheckSessions, setStockCheckSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // модалки подтверждения удаления
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmSessionOpen, setConfirmSessionOpen] = useState(false);
  const [confirmSessionId, setConfirmSessionId] = useState(null);
  const [confirmSessionBusy, setConfirmSessionBusy] = useState(false);
  const [confirmStockCheckOpen, setConfirmStockCheckOpen] = useState(false);
  const [confirmStockCheckId, setConfirmStockCheckId] = useState(null);
  const [confirmStockCheckBusy, setConfirmStockCheckBusy] = useState(false);

  // модалка оборудования
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    serial_number: "",
    category: "",
    purchase_date: "",
    price: "",
    condition: "good",
    is_active: true,
    notes: "",
  });

  // модалка акта инвентаризации
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    comment: "",
    items: [], // [{equipment: id, is_present: bool, condition: string, notes: string}]
  });
  const [selectedEquipment, setSelectedEquipment] = useState(null);

  // модалка просмотра акта
  const [viewSessionModalOpen, setViewSessionModalOpen] = useState(false);
  const [viewingSession, setViewingSession] = useState(null);

  // модалка сверки продуктов
  const [stockCheckModalOpen, setStockCheckModalOpen] = useState(false);
  const [stockCheckForm, setStockCheckForm] = useState({
    comment: "",
    items: [], // [{product: id, qty_counted: number}]
  });
  const [selectedProduct, setSelectedProduct] = useState(null);

  // выбор карточками (оборудование / продукты)
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
  const [equipmentPickerSearch, setEquipmentPickerSearch] = useState("");
  const [equipmentPickerSelected, setEquipmentPickerSelected] = useState(
    () => new Set()
  );
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const [productPickerSelected, setProductPickerSelected] = useState(
    () => new Set()
  );

  // модалка просмотра акта сверки продуктов
  const [viewStockCheckModalOpen, setViewStockCheckModalOpen] = useState(false);
  const [viewingStockCheck, setViewingStockCheck] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [equipmentRes, sessionsRes, warehouseRes, stockCheckRes] =
        await Promise.all([
          api.get("/cafe/equipment/"),
          api
            .get("/cafe/equipment/inventory/sessions/")
            .catch(() => ({ data: [] })),
          api.get("/cafe/warehouse/").catch(() => ({ data: [] })),
          api.get("/cafe/inventory/sessions/").catch(() => ({ data: [] })),
        ]);
      setEquipment(listFrom(equipmentRes));
      setSessions(listFrom(sessionsRes));
      setWarehouseItems(listFrom(warehouseRes));
      setStockCheckSessions(listFrom(stockCheckRes));
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка загрузки данных");
      alert(errorMessage, true);
      // Ошибка загрузки данных
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter(
      (e) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.serial_number || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q) ||
        (e.condition || "").toLowerCase().includes(q)
    );
  }, [equipment, query]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.comment || "").toLowerCase().includes(q) ||
        (s.id || "").toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const filteredStockCheckSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stockCheckSessions;
    return stockCheckSessions.filter(
      (s) =>
        (s.comment || "").toLowerCase().includes(q) ||
        (s.id || "").toLowerCase().includes(q)
    );
  }, [stockCheckSessions, query]);

  const getConditionLabel = (condition) => {
    const labels = {
      good: "Исправно",
      repair: "На ремонте",
      broken: "Списано",
    };
    return labels[condition] || condition;
  };

  const getConditionColor = (condition) => {
    const colors = {
      good: "success",
      repair: "warning",
      broken: "danger",
    };
    return colors[condition] || "muted";
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      serial_number: "",
      category: "",
      purchase_date: "",
      price: "",
      condition: "good",
      is_active: true,
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      serial_number: item.serial_number || "",
      category: item.category || "",
      purchase_date: formatDate(item.purchase_date) || "",
      price: item.price || "",
      condition: item.condition || "good",
      is_active: item.is_active !== false,
      notes: item.notes || "",
    });
    setModalOpen(true);
  };

  const recordEquipmentPurchaseExpense = async ({
    title,
    amount,
    equipmentId,
    purchaseDate,
    notes,
    source,
  }) => {
    const amt = toNum(amount);
    if (amt < 0.01) return null;

    let expenseId = null;
    try {
      expenseId = await recordCafePurchaseExpense({
        title: `Закупка оборудования: ${title}`,
        amount: amt,
        note:
          String(notes || "").trim() ||
          `Инвентаризация: оборудование «${title}»`,
        source,
        sourceId: equipmentId,
        expenseDate: purchaseDate || null,
      });
    } catch (expErr) {
      alert(
        `Оборудование сохранено, но расход «Закупки» не записан: ${validateResErrors(expErr)}`,
        true,
      );
      return null;
    }

    if (expenseId) {
      alert(`Расход «Закупки»: ${fmtMoney(amt)} сом.`);
    }
    return expenseId;
  };

  const saveEquipment = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const title = form.title.trim();
    const priceNum = Math.max(0, toNum(form.price));
    const payload = {
      title,
      serial_number: form.serial_number.trim() || null,
      category: form.category.trim() || null,
      purchase_date: form.purchase_date || null,
      price: priceNum > 0 ? numStr(priceNum) : null,
      condition: form.condition,
      is_active: form.is_active,
      notes: form.notes.trim() || "",
    };

    try {
      if (editingId == null) {
        const res = await api.post("/cafe/equipment/", payload);
        setEquipment((prev) => [...prev, res.data]);

        let expenseId = pickExpenseIdFromResponse(res.data);
        if (!expenseId && priceNum >= 0.01) {
          expenseId = await recordEquipmentPurchaseExpense({
            title,
            amount: priceNum,
            equipmentId: res.data?.id,
            purchaseDate: form.purchase_date,
            notes: form.notes,
            source: "equipment_create",
          });
        }
      } else {
        const prevRow = equipment.find((eq) => eq.id === editingId);
        const prevPrice = toNum(prevRow?.price);

        const res = await api.patch(`/cafe/equipment/${editingId}/`, payload);
        setEquipment((prev) =>
          prev.map((eq) => (eq.id === editingId ? res.data : eq)),
        );

        let expenseId = pickExpenseIdFromResponse(res.data);
        if (!expenseId && priceNum >= 0.01 && prevPrice < 0.01) {
          expenseId = await recordEquipmentPurchaseExpense({
            title,
            amount: priceNum,
            equipmentId: editingId,
            purchaseDate: form.purchase_date,
            notes: form.notes,
            source: "equipment_price_set",
          });
        }
      }
      setModalOpen(false);
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка сохранения оборудования");
      alert(errorMessage, true);
    }
  };

  const openDeleteConfirm = (id) => {
    setDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (deleteBusy) return;
    setConfirmDeleteOpen(false);
    setDeleteId(null);
  };

  const handleDelete = async () => {
    if (!deleteId || deleteBusy) return;

    setDeleteBusy(true);
    try {
      await api.delete(`/cafe/equipment/${deleteId}/`);
      setEquipment((prev) => prev.filter((e) => e.id !== deleteId));
      closeDeleteConfirm();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка удаления оборудования");
      alert(errorMessage, true);
    } finally {
      setDeleteBusy(false);
    }
  };

  const openCreateSession = () => {
    setSessionForm({
      comment: "",
      items: [],
    });
    setSelectedEquipment(null);
    setSessionModalOpen(true);
  };

  const addItemToSession = () => {
    if (!selectedEquipment) return;
    const exists = sessionForm.items.some(
      (i) => i.equipment === selectedEquipment.id
    );
    if (exists) {
      return;
    }
    setSessionForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          equipment: selectedEquipment.id,
          is_present: true,
          condition: selectedEquipment.condition || "good",
          notes: "",
        },
      ],
    }));
    setSelectedEquipment(null);
  };

  const removeItemFromSession = (equipmentId) => {
    setSessionForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.equipment !== equipmentId),
    }));
  };

  const updateSessionItem = (equipmentId, field, value) => {
    setSessionForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.equipment === equipmentId ? { ...i, [field]: value } : i
      ),
    }));
  };

  const saveSession = async (e) => {
    e.preventDefault();

    if (sessionForm.items.length === 0) {
      return;
    }

    try {
      const res = await api.post("/cafe/equipment/inventory/sessions/", {
        comment: sessionForm.comment.trim() || "",
        items: sessionForm.items,
      });
      setSessions((prev) => [res.data, ...prev]);
      setSessionModalOpen(false);
      fetchAll();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка создания акта");
      alert(errorMessage, true);
    }
  };

  const viewSession = async (sessionId) => {
    try {
      const res = await api.get(
        `/cafe/equipment/inventory/sessions/${sessionId}/`
      );
      setViewingSession(res.data);
      setViewSessionModalOpen(true);
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка загрузки акта");
      alert(errorMessage, true);
    }
  };

  const openConfirmSession = (sessionId) => {
    setConfirmSessionId(sessionId);
    setConfirmSessionOpen(true);
  };

  const closeConfirmSession = () => {
    if (confirmSessionBusy) return;
    setConfirmSessionOpen(false);
    setConfirmSessionId(null);
  };

  const confirmSession = async () => {
    if (!confirmSessionId || confirmSessionBusy) return;

    setConfirmSessionBusy(true);
    try {
      await api.post(
        `/cafe/equipment/inventory/sessions/${confirmSessionId}/confirm/`
      );
      await fetchAll(); // Обновляем все данные
      setViewSessionModalOpen(false);
      closeConfirmSession();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка подтверждения акта");
      alert(errorMessage, true);
    } finally {
      setConfirmSessionBusy(false);
    }
  };

  const getEquipmentById = (id) => {
    return equipment.find((e) => e.id === id);
  };

  // Функции для сверки продуктов
  const openCreateStockCheck = () => {
    setStockCheckForm({
      comment: "",
      items: [],
    });
    setSelectedProduct(null);
    setStockCheckModalOpen(true);
  };

  const addProductToStockCheck = () => {
    if (!selectedProduct) return;
    const exists = stockCheckForm.items.some(
      (i) => i.product === selectedProduct.id
    );
    if (exists) {
      return;
    }
    setStockCheckForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product: selectedProduct.id,
          qty_counted: toNum(selectedProduct.remainder), // По умолчанию берем текущий остаток
        },
      ],
    }));
    setSelectedProduct(null);
  };

  const removeProductFromStockCheck = (productId) => {
    setStockCheckForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.product !== productId),
    }));
  };

  const updateStockCheckItem = (productId, field, value) => {
    setStockCheckForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.product === productId ? { ...i, [field]: value } : i
      ),
    }));
  };

  const saveStockCheck = async (e) => {
    e.preventDefault();
    if (stockCheckForm.items.length === 0) {
      return;
    }

    try {
      const res = await api.post("/cafe/inventory/sessions/", {
        comment: stockCheckForm.comment.trim() || "",
        items: stockCheckForm.items.map((item) => {
          const prod = getProductById(item.product);
          const expectedQty = toNum(prod?.remainder || 0);
          return {
            product: item.product,
            expected_qty: numStr(expectedQty),
            actual_qty: numStr(item.qty_counted),
          };
        }),
      });
      setStockCheckSessions((prev) => [res.data, ...prev]);
      setStockCheckModalOpen(false);
      await fetchAll(); // Обновляем список продуктов
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка создания акта сверки");
      alert(errorMessage, true);
    }
  };

  const viewStockCheck = async (sessionId) => {
    try {
      const res = await api.get(`/cafe/inventory/sessions/${sessionId}/`);
      setViewingStockCheck(res.data);
      setViewStockCheckModalOpen(true);
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка загрузки акта");
      alert(errorMessage, true);
    }
  };

  const openConfirmStockCheck = (sessionId) => {
    setConfirmStockCheckId(sessionId);
    setConfirmStockCheckOpen(true);
  };

  const closeConfirmStockCheck = () => {
    if (confirmStockCheckBusy) return;
    setConfirmStockCheckOpen(false);
    setConfirmStockCheckId(null);
  };

  const confirmStockCheck = async () => {
    if (!confirmStockCheckId || confirmStockCheckBusy) return;

    setConfirmStockCheckBusy(true);
    try {
      await api.post(`/cafe/inventory/sessions/${confirmStockCheckId}/confirm/`);
      await fetchAll(); // Обновляем все данные
      setViewStockCheckModalOpen(false);
      closeConfirmStockCheck();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      const errorMessage = validateResErrors(err, "Ошибка подтверждения акта");
      alert(errorMessage, true);
    } finally {
      setConfirmStockCheckBusy(false);
    }
  };

  const getProductById = (id) => {
    return warehouseItems.find((p) => p.id === id);
  };

  useEffect(() => {
    if (!sessionModalOpen) {
      setEquipmentPickerOpen(false);
      setEquipmentPickerSearch("");
      setEquipmentPickerSelected(new Set());
    }
  }, [sessionModalOpen]);

  useEffect(() => {
    if (!stockCheckModalOpen) {
      setProductPickerOpen(false);
      setProductPickerSearch("");
      setProductPickerSelected(new Set());
    }
  }, [stockCheckModalOpen]);

  const availableEquipmentForSession = useMemo(
    () =>
      equipment.filter(
        (eq) => !sessionForm.items.some((i) => i.equipment === eq.id)
      ),
    [equipment, sessionForm.items]
  );

  const availableProductsForStockCheck = useMemo(
    () =>
      warehouseItems.filter(
        (p) => !stockCheckForm.items.some((i) => i.product === p.id)
      ),
    [warehouseItems, stockCheckForm.items]
  );

  const equipmentPickerItems = useMemo(() => {
    const q = equipmentPickerSearch.trim().toLowerCase();
    return availableEquipmentForSession
      .filter((eq) => {
        if (!q) return true;
        return (
          (eq.title || "").toLowerCase().includes(q) ||
          (eq.serial_number || "").toLowerCase().includes(q) ||
          (eq.category || "").toLowerCase().includes(q)
        );
      })
      .map((eq) => ({
        id: String(eq.id),
        title: eq.title || "Без названия",
        subtitle: [eq.serial_number, eq.category].filter(Boolean).join(" · "),
        meta: getConditionLabel(eq.condition),
      }));
  }, [availableEquipmentForSession, equipmentPickerSearch]);

  const productPickerItems = useMemo(() => {
    const q = productPickerSearch.trim().toLowerCase();
    return availableProductsForStockCheck
      .filter((p) => {
        if (!q) return true;
        return (
          (p.title || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q) ||
          (p.unit || "").toLowerCase().includes(q)
        );
      })
      .map((p) => ({
        id: String(p.id),
        title: p.title || "Без названия",
        subtitle: p.code ? `Код: ${p.code}` : "",
        meta: `Остаток: ${toNum(p.remainder)} ${p.unit || "шт"}`,
      }));
  }, [availableProductsForStockCheck, productPickerSearch]);

  const isAllEquipmentPickerSelected =
    equipmentPickerItems.length > 0 &&
    equipmentPickerItems.every((item) => equipmentPickerSelected.has(item.id));

  const isAllProductPickerSelected =
    productPickerItems.length > 0 &&
    productPickerItems.every((item) => productPickerSelected.has(item.id));

  const openEquipmentPicker = () => {
    setEquipmentPickerSearch("");
    setEquipmentPickerSelected(new Set());
    setEquipmentPickerOpen(true);
  };

  const openProductPicker = () => {
    setProductPickerSearch("");
    setProductPickerSelected(new Set());
    setProductPickerOpen(true);
  };

  const toggleEquipmentPickerItem = (id) => {
    setEquipmentPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProductPickerItem = (id) => {
    setProductPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEquipmentPickerSelectAll = () => {
    const ids = equipmentPickerItems.map((item) => item.id);
    if (isAllEquipmentPickerSelected) {
      setEquipmentPickerSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setEquipmentPickerSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleProductPickerSelectAll = () => {
    const ids = productPickerItems.map((item) => item.id);
    if (isAllProductPickerSelected) {
      setProductPickerSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setProductPickerSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const applyEquipmentPicker = () => {
    if (equipmentPickerSelected.size === 0) return;

    const newItems = [...equipmentPickerSelected]
      .map((id) => equipment.find((eq) => String(eq.id) === id))
      .filter(Boolean)
      .map((eq) => ({
        equipment: eq.id,
        is_present: true,
        condition: eq.condition || "good",
        notes: "",
      }));

    setSessionForm((prev) => {
      const existing = new Set(prev.items.map((i) => i.equipment));
      const merged = [
        ...prev.items,
        ...newItems.filter((item) => !existing.has(item.equipment)),
      ];
      return { ...prev, items: merged };
    });
    setEquipmentPickerOpen(false);
    setEquipmentPickerSelected(new Set());
  };

  const applyProductPicker = () => {
    if (productPickerSelected.size === 0) return;

    const newItems = [...productPickerSelected]
      .map((id) => warehouseItems.find((p) => String(p.id) === id))
      .filter(Boolean)
      .map((prod) => ({
        product: prod.id,
        qty_counted: toNum(prod.remainder),
      }));

    setStockCheckForm((prev) => {
      const existing = new Set(prev.items.map((i) => i.product));
      const merged = [
        ...prev.items,
        ...newItems.filter((item) => !existing.has(item.product)),
      ];
      return { ...prev, items: merged };
    });
    setProductPickerOpen(false);
    setProductPickerSelected(new Set());
  };

  return (
    <section className="cafeInventory">
      <div className="cafeInventory__header">
        <div>
          <h2 className="cafeInventory__title">Инвентаризация</h2>
        </div>

        <div className="cafeInventory__actions">
          <div className="cafeInventory__search">
            <FaSearch className="cafeInventory__searchIcon" />
            <input
              className="cafeInventory__searchInput"
              placeholder={
                activeTab === "equipment"
                  ? "Поиск оборудования…"
                  : activeTab === "sessions"
                    ? "Поиск актов инвентаризации…"
                    : activeTab === "household"
                      ? "Поиск посуды и расходников…"
                      : "Поиск актов сверки продуктов…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {activeTab === "equipment" ? (
            <button
              className="cafeInventory__btn cafeInventory__btn--primary"
              onClick={openCreate}
            >
              <FaPlus /> Новое оборудование
            </button>
          ) : activeTab === "sessions" ? (
            <button
              className="cafeInventory__btn cafeInventory__btn--primary"
              onClick={openCreateSession}
            >
              <FaPlus /> Новый акт
            </button>
          ) : activeTab === "household" ? null : (
            <button
              className="cafeInventory__btn cafeInventory__btn--primary"
              onClick={openCreateStockCheck}
            >
              <FaPlus /> Новая сверка
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="cafeInventory__tabs">
        <button
          className={`cafeInventory__tab ${
            activeTab === "equipment" ? "cafeInventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("equipment")}
        >
          <FaTools /> Оборудование
        </button>
        <button
          className={`cafeInventory__tab ${
            activeTab === "sessions" ? "cafeInventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("sessions")}
        >
          <FaClipboardList /> Акты инвентаризации
        </button>
        <button
          className={`cafeInventory__tab ${
            activeTab === "stock-check" ? "cafeInventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("stock-check")}
        >
          <FaBoxes /> Сверка продуктов
        </button>
        <button
          className={`cafeInventory__tab ${
            activeTab === "household" ? "cafeInventory__tab--active" : ""
          }`}
          onClick={() => setActiveTab("household")}
        >
          <FaUtensils /> Посуда и расходники
        </button>
      </div>

      {/* List */}
      <div className="cafeInventory__list">
        {activeTab === "household" ? (
          <HouseholdInventoryTab query={query} />
        ) : null}

        {activeTab !== "household" && loading && (
          <div className="cafeInventory__alert">Загрузка…</div>
        )}

        {activeTab === "equipment" && (
          <>
            {!loading &&
              filteredEquipment.map((item) => (
                <article key={item.id} className="cafeInventory__card">
                  <div className="cafeInventory__cardLeft">
                    <div className="cafeInventory__avatar">
                      <FaTools />
                    </div>
                    <div>
                      <h3 className="cafeInventory__name">{item.title}</h3>
                      <div className="cafeInventory__meta">
                        {item.serial_number && (
                          <span className="cafeInventory__muted">
                            Серийный: {item.serial_number}
                          </span>
                        )}
                        {item.category && (
                          <span className="cafeInventory__muted">
                            Категория: {item.category}
                          </span>
                        )}
                        {item.purchase_date && (
                          <span className="cafeInventory__muted">
                            Покупка: {formatDate(item.purchase_date)}
                          </span>
                        )}
                        {item.price && (
                          <span className="cafeInventory__muted">
                            Цена: {fmtMoney(item.price)} сом
                          </span>
                        )}
                        <span
                          className={`cafeInventory__status cafeInventory__status--${getConditionColor(
                            item.condition
                          )}`}
                        >
                          {getConditionLabel(item.condition)}
                        </span>
                        <span
                          className={`cafeInventory__status ${
                            item.is_active
                              ? "cafeInventory__status--active"
                              : "cafeInventory__status--inactive"
                          }`}
                        >
                          {item.is_active ? "Активно" : "Неактивно"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cafeInventory__rowActions">
                    <button
                      className="cafeInventory__btn cafeInventory__btn--secondary"
                      onClick={() => openEdit(item)}
                    >
                      <FaEdit /> Изменить
                    </button>
                    <button
                      className="cafeInventory__btn cafeInventory__btn--danger"
                      onClick={() => openDeleteConfirm(item.id)}
                    >
                      <FaTrash /> Удалить
                    </button>
                  </div>
                </article>
              ))}
            {!loading && !filteredEquipment.length && (
              <div className="cafeInventory__alert">
                {query ? `Ничего не найдено по «${query}»` : "Нет оборудования"}
              </div>
            )}
          </>
        )}

        {activeTab === "sessions" && (
          <>
            {!loading &&
              filteredSessions.map((session) => (
                <article key={session.id} className="cafeInventory__card">
                  <div className="cafeInventory__cardLeft">
                    <div className="cafeInventory__avatar">
                      <FaClipboardList />
                    </div>
                    <div>
                      <h3 className="cafeInventory__name">
                        {session.comment || "Акт инвентаризации"}
                      </h3>
                      <div className="cafeInventory__meta">
                        <span className="cafeInventory__muted">
                          Создан:{" "}
                          {new Date(session.created_at).toLocaleString("ru-RU")}
                        </span>
                        {session.confirmed_at && (
                          <span className="cafeInventory__muted">
                            Подтвержден:{" "}
                            {new Date(session.confirmed_at).toLocaleString(
                              "ru-RU"
                            )}
                          </span>
                        )}
                        <span className="cafeInventory__muted">
                          Позиций: {session.items?.length || 0}
                        </span>
                        <span
                          className={`cafeInventory__status ${
                            session.is_confirmed
                              ? "cafeInventory__status--confirmed"
                              : "cafeInventory__status--pending"
                          }`}
                        >
                          {session.is_confirmed ? "Подтвержден" : "Ожидает"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cafeInventory__rowActions">
                    <button
                      className="cafeInventory__btn cafeInventory__btn--secondary"
                      onClick={() => viewSession(session.id)}
                    >
                      Просмотр
                    </button>
                    {!session.is_confirmed && (
                      <button
                        className="cafeInventory__btn cafeInventory__btn--success"
                        onClick={() => openConfirmSession(session.id)}
                      >
                        <FaCheckCircle /> Подтвердить
                      </button>
                    )}
                  </div>
                </article>
              ))}
            {!loading && !filteredSessions.length && (
              <div className="cafeInventory__alert">
                {query ? `Ничего не найдено по «${query}»` : "Нет актов"}
              </div>
            )}
          </>
        )}

        {activeTab === "stock-check" && (
          <>
            {!loading &&
              filteredStockCheckSessions.map((session) => (
                <article key={session.id} className="cafeInventory__card">
                  <div className="cafeInventory__cardLeft">
                    <div className="cafeInventory__avatar">
                      <FaBoxes />
                    </div>
                    <div>
                      <h3 className="cafeInventory__name">
                        {session.comment || "Акт сверки продуктов"}
                      </h3>
                      <div className="cafeInventory__meta">
                        <span className="cafeInventory__muted">
                          Создан:{" "}
                          {new Date(session.created_at).toLocaleString("ru-RU")}
                        </span>
                        {session.confirmed_at && (
                          <span className="cafeInventory__muted">
                            Подтвержден:{" "}
                            {new Date(session.confirmed_at).toLocaleString(
                              "ru-RU"
                            )}
                          </span>
                        )}
                        <span className="cafeInventory__muted">
                          Позиций: {session.items?.length || 0}
                        </span>
                        <span
                          className={`cafeInventory__status ${
                            session.is_confirmed
                              ? "cafeInventory__status--confirmed"
                              : "cafeInventory__status--pending"
                          }`}
                        >
                          {session.is_confirmed ? "Подтвержден" : "Ожидает"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cafeInventory__rowActions">
                    <button
                      className="cafeInventory__btn cafeInventory__btn--secondary"
                      onClick={() => viewStockCheck(session.id)}
                    >
                      Просмотр
                    </button>
                    {!session.is_confirmed && (
                      <button
                        className="cafeInventory__btn cafeInventory__btn--success"
                        onClick={() => openConfirmStockCheck(session.id)}
                      >
                        <FaCheckCircle /> Подтвердить
                      </button>
                    )}
                  </div>
                </article>
              ))}
            {!loading && !filteredStockCheckSessions.length && (
              <div className="cafeInventory__alert">
                {query
                  ? `Ничего не найдено по «${query}»`
                  : "Нет актов сверки продуктов"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Модалка оборудования */}
      {modalOpen && (
        <ReactPortal wrapperId="cafe-inventory-equipment-modal">
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="cafeInventory__modal cafeInventory__modal--form cafeInventory__modal--equipment"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cafe-equipment-modal-title"
          >
            <div className="cafeInventory__modalHeader">
              <h3
                id="cafe-equipment-modal-title"
                className="cafeInventory__modalTitle"
              >
                {editingId == null
                  ? "Новое оборудование"
                  : "Изменить оборудование"}
              </h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={() => setModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form
              className="cafeInventory__form cafeInventory__form--modal"
              onSubmit={saveEquipment}
            >
              <div className="cafeInventory__formBody">
              <div className="cafeInventory__formGrid">
                <div className="cafeInventory__field cafeInventory__field--full">
                  <label className="cafeInventory__label">Название *</label>
                  <input
                    className="cafeInventory__input"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                    maxLength={255}
                  />
                </div>

                <div className="cafeInventory__field">
                  <label className="cafeInventory__label">Серийный номер</label>
                  <input
                    className="cafeInventory__input"
                    value={form.serial_number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serial_number: e.target.value }))
                    }
                    maxLength={255}
                  />
                </div>

                <div className="cafeInventory__field">
                  <label className="cafeInventory__label">Категория</label>
                  <input
                    className="cafeInventory__input"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    maxLength={255}
                  />
                </div>

                <div className="cafeInventory__field">
                  <label className="cafeInventory__label">Дата покупки</label>
                  <input
                    type="date"
                    className="cafeInventory__input"
                    value={form.purchase_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, purchase_date: e.target.value }))
                    }
                  />
                </div>

                <div className="cafeInventory__field">
                  <label className="cafeInventory__label">Цена закупки (сом)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="cafeInventory__input"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                  <span className="cafeInventory__hint">
                    При указании цены создаётся операционный расход «Закупки» (как
                    на складе кафе).
                  </span>
                </div>

                <div className="cafeInventory__field">
                  <label className="cafeInventory__label">Состояние</label>
                  <SearchableCombobox
                    value={form.condition}
                    onChange={(v) => setForm((f) => ({ ...f, condition: v }))}
                    options={[
                      { value: "good", label: "Исправно" },
                      { value: "repair", label: "На ремонте" },
                      { value: "broken", label: "Списано" },
                    ]}
                    placeholder="Выберите состояние…"
                    classNamePrefix="cafeInventoryCombo"
                    menuPortal
                  />
                </div>

                <div className="cafeInventory__field">
                  <label className="cafeInventory__label">Активно</label>
                  <SearchableCombobox
                    value={form.is_active ? "true" : "false"}
                    onChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        is_active: v === "true",
                      }))
                    }
                    options={[
                      { value: "true", label: "Да" },
                      { value: "false", label: "Нет" },
                    ]}
                    placeholder="Выберите…"
                    classNamePrefix="cafeInventoryCombo"
                    menuPortal
                  />
                </div>

                <div className="cafeInventory__field cafeInventory__field--full">
                  <label className="cafeInventory__label">Примечания</label>
                  <textarea
                    className="cafeInventory__textarea"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
              </div>
              </div>

              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="cafeInventory__btn cafeInventory__btn--primary"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
        </ReactPortal>
      )}

      {/* Модалка создания акта */}
      {sessionModalOpen && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setSessionModalOpen(false)}
        >
          <div
            className="cafeInventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">
                Новый акт инвентаризации
              </h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={() => setSessionModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form
              className="cafeInventory__form cafeInventory__form--modal"
              onSubmit={saveSession}
            >
              <div className="cafeInventory__formBody">
              <div className="cafeInventory__formGrid">
                <div className="cafeInventory__field cafeInventory__field--full">
                  <label className="cafeInventory__label">
                    Комментарий (необязательно)
                  </label>
                  <input
                    className="cafeInventory__input"
                    value={sessionForm.comment}
                    onChange={(e) =>
                      setSessionForm((f) => ({
                        ...f,
                        comment: e.target.value,
                      }))
                    }
                    placeholder="Например: Плановая проверка кухни (необязательно)"
                  />
                </div>

                <div className="cafeInventory__field cafeInventory__field--full">
                  <label className="cafeInventory__label">
                    Добавить оборудование
                  </label>
                  <div className="cafeInventory__selectGroup">
                    <SearchableCombobox
                      value={selectedEquipment?.id || ""}
                      onChange={(v) => {
                        const eq = equipment.find((eq) => eq.id === v);
                        setSelectedEquipment(eq || null);
                      }}
                      classNamePrefix="cafeInventoryCombo"
                      options={equipment
                        .filter(
                          (eq) =>
                            !sessionForm.items.some(
                              (i) => i.equipment === eq.id
                            )
                        )
                        .map((eq) => ({
                          value: eq.id,
                          label: `${eq.title}${eq.serial_number ? ` (${eq.serial_number})` : ""}`,
                        }))}
                      placeholder="Выберите оборудование…"
                      menuPortal
                    />
                    <button
                      type="button"
                      className="cafeInventory__btn cafeInventory__btn--secondary cafeInventory__btn--picker"
                      onClick={openEquipmentPicker}
                      disabled={availableEquipmentForSession.length === 0}
                    >
                      <FaThList /> Выбрать из списка
                    </button>
                    <button
                      type="button"
                      className="cafeInventory__btn cafeInventory__btn--secondary"
                      onClick={addItemToSession}
                      disabled={!selectedEquipment}
                    >
                      <FaPlus /> Добавить
                    </button>
                  </div>
                </div>

                {sessionForm.items.length > 0 && (
                  <div className="cafeInventory__field cafeInventory__field--full">
                    <label className="cafeInventory__label">
                      Оборудование в акте ({sessionForm.items.length})
                    </label>
                    <div className="cafeInventory__sessionItems">
                      {sessionForm.items.map((item, idx) => {
                        const eq = getEquipmentById(item.equipment);
                        return (
                          <div key={idx} className="cafeInventory__sessionItem">
                            <div style={{ flex: 1 }}>
                              <strong>{eq?.title || "Неизвестно"}</strong>
                              {eq?.serial_number && (
                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  {eq.serial_number}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <label className="cafeInventory__checkboxLabel">
                                <input
                                  type="checkbox"
                                  checked={item.is_present}
                                  onChange={(e) =>
                                    updateSessionItem(
                                      item.equipment,
                                      "is_present",
                                      e.target.checked
                                    )
                                  }
                                />{" "}
                                На месте
                              </label>
                              <div className="cafeInventory__conditionSelect">
                                <SearchableCombobox
                                  value={item.condition}
                                  onChange={(v) =>
                                    updateSessionItem(
                                      item.equipment,
                                      "condition",
                                      v
                                    )
                                  }
                                  options={[
                                    { value: "good", label: "Исправно" },
                                    { value: "repair", label: "На ремонте" },
                                    { value: "broken", label: "Списано" },
                                  ]}
                                  placeholder="Состояние…"
                                  classNamePrefix="cafeInventoryCombo"
                                  menuPortal
                                />
                              </div>
                              <input
                                type="text"
                                placeholder="Примечания"
                                style={{
                                  fontSize: 12,
                                  padding: "4px 8px",
                                  minWidth: "120px",
                                }}
                                value={item.notes || ""}
                                onChange={(e) =>
                                  updateSessionItem(
                                    item.equipment,
                                    "notes",
                                    e.target.value
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="cafeInventory__iconBtn"
                                style={{ width: "24px", height: "24px" }}
                                onClick={() =>
                                  removeItemFromSession(item.equipment)
                                }
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              </div>

              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={() => setSessionModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="cafeInventory__btn cafeInventory__btn--primary"
                  disabled={sessionForm.items.length === 0}
                >
                  Создать акт
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка просмотра акта */}
      {viewSessionModalOpen && viewingSession && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setViewSessionModalOpen(false)}
        >
          <div
            className="cafeInventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">
                Акт: {viewingSession.comment || "Инвентаризация"}
              </h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={() => setViewSessionModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="cafeInventory__form cafeInventory__form--modal">
              <div className="cafeInventory__formBody">
                <div className="cafeInventory__sessionDetails">
                  <div className="cafeInventory__sessionInfo">
                    <div>
                      <strong>Создан:</strong>{" "}
                      {new Date(viewingSession.created_at).toLocaleString(
                        "ru-RU"
                      )}
                    </div>
                    {viewingSession.confirmed_at && (
                      <div>
                        <strong>Подтвержден:</strong>{" "}
                        {new Date(viewingSession.confirmed_at).toLocaleString(
                          "ru-RU"
                        )}
                      </div>
                    )}
                    <div>
                      <strong>Статус:</strong>{" "}
                      {viewingSession.is_confirmed ? "Подтвержден" : "Ожидает"}
                    </div>
                  </div>

                  <div className="cafeInventory__sessionItemsList">
                    <h4>Оборудование ({viewingSession.items?.length || 0}):</h4>
                    {viewingSession.items?.map((item, idx) => (
                      <div key={idx} className="cafeInventory__sessionItemView">
                        <div>
                          <strong>{item.equipment_title || "Неизвестно"}</strong>
                          {item.serial_number && (
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              {item.serial_number}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            className={`cafeInventory__status cafeInventory__status--${
                              item.is_present ? "success" : "danger"
                            }`}
                          >
                            {item.is_present ? "На месте" : "Отсутствует"}
                          </span>
                          <span
                            className={`cafeInventory__status cafeInventory__status--${getConditionColor(
                              item.condition
                            )}`}
                          >
                            {getConditionLabel(item.condition)}
                          </span>
                          {item.notes && (
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {!viewingSession.is_confirmed && (
                <div className="cafeInventory__formActions">
                  <button
                    type="button"
                    className="cafeInventory__btn cafeInventory__btn--secondary"
                    onClick={() => setViewSessionModalOpen(false)}
                  >
                    Закрыть
                  </button>
                  <button
                    type="button"
                    className="cafeInventory__btn cafeInventory__btn--success"
                    onClick={() => confirmSession(viewingSession.id)}
                  >
                    <FaCheckCircle /> Подтвердить акт
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания акта сверки продуктов */}
      {stockCheckModalOpen && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setStockCheckModalOpen(false)}
        >
          <div
            className="cafeInventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">
                Новый акт сверки продуктов
              </h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={() => setStockCheckModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form
              className="cafeInventory__form cafeInventory__form--modal"
              onSubmit={saveStockCheck}
            >
              <div className="cafeInventory__formBody">
              <div className="cafeInventory__formGrid">
                <div className="cafeInventory__field cafeInventory__field--full">
                  <label className="cafeInventory__label">Комментарий</label>
                  <input
                    className="cafeInventory__input"
                    value={stockCheckForm.comment}
                    onChange={(e) =>
                      setStockCheckForm((f) => ({
                        ...f,
                        comment: e.target.value,
                      }))
                    }
                    placeholder="Например: Ночная инвентаризация бара (необязательно)"
                  />
                </div>

                <div className="cafeInventory__field cafeInventory__field--full">
                  <label className="cafeInventory__label">Добавить продукт</label>
                  <div className="cafeInventory__selectGroup">
                    <SearchableCombobox
                      value={selectedProduct?.id || ""}
                      onChange={(v) => {
                        const prod = warehouseItems.find((p) => p.id === v);
                        setSelectedProduct(prod || null);
                      }}
                      classNamePrefix="cafeInventoryCombo"
                      options={warehouseItems
                        .filter(
                          (p) =>
                            !stockCheckForm.items.some(
                              (i) => i.product === p.id
                            )
                        )
                        .map((p) => ({
                          value: p.id,
                          label: `${p.title} (${toNum(p.remainder)} ${p.unit || "шт"})`,
                        }))}
                      placeholder="Выберите продукт…"
                      menuPortal
                    />
                    <button
                      type="button"
                      className="cafeInventory__btn cafeInventory__btn--secondary cafeInventory__btn--picker"
                      onClick={openProductPicker}
                      disabled={availableProductsForStockCheck.length === 0}
                    >
                      <FaThList /> Выбрать из списка
                    </button>
                    <button
                      type="button"
                      className="cafeInventory__btn cafeInventory__btn--secondary"
                      onClick={addProductToStockCheck}
                      disabled={!selectedProduct}
                    >
                      <FaPlus /> Добавить
                    </button>
                  </div>
                </div>

                {stockCheckForm.items.length > 0 && (
                  <div className="cafeInventory__field cafeInventory__field--full">
                    <label className="cafeInventory__label">
                      Продукты в акте ({stockCheckForm.items.length})
                    </label>
                    <div className="cafeInventory__sessionItems">
                      {stockCheckForm.items.map((item, idx) => {
                        const prod = getProductById(item.product);
                        const qtyExpected = toNum(prod?.remainder || 0);
                        const qtyCounted = toNum(item.qty_counted);
                        const difference = qtyCounted - qtyExpected;
                        return (
                          <div key={idx} className="cafeInventory__sessionItem">
                            <div style={{ flex: 1 }}>
                              <strong>{prod?.title || "Неизвестно"}</strong>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>
                                Ожидается: {qtyExpected} {prod?.unit || "шт"}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <label style={{ fontSize: 12 }}>
                                Фактически:
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  style={{
                                    fontSize: 12,
                                    padding: "4px 8px",
                                    marginLeft: "4px",
                                    width: "80px",
                                  }}
                                  value={item.qty_counted}
                                  onChange={(e) =>
                                    updateStockCheckItem(
                                      item.product,
                                      "qty_counted",
                                      e.target.value
                                    )
                                  }
                                />
                                {prod?.unit || "шт"}
                              </label>
                              <span
                                style={{
                                  fontSize: 12,
                                  color:
                                    difference > 0
                                      ? "#10b981"
                                      : difference < 0
                                      ? "#ef4444"
                                      : "#6b7280",
                                  fontWeight: "bold",
                                }}
                              >
                                {difference > 0 ? "+" : ""}
                                {difference.toFixed(2)} {prod?.unit || "шт"}
                              </span>
                              <button
                                type="button"
                                className="cafeInventory__iconBtn"
                                style={{ width: "24px", height: "24px" }}
                                onClick={() =>
                                  removeProductFromStockCheck(item.product)
                                }
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              </div>

              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={() => setStockCheckModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="cafeInventory__btn cafeInventory__btn--primary"
                  disabled={stockCheckForm.items.length === 0}
                >
                  Создать акт
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка просмотра акта сверки продуктов */}
      {viewStockCheckModalOpen && viewingStockCheck && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setViewStockCheckModalOpen(false)}
        >
          <div
            className="cafeInventory__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">
                Акт: {viewingStockCheck.comment || "Сверка продуктов"}
              </h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={() => setViewStockCheckModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="cafeInventory__form cafeInventory__form--modal">
              <div className="cafeInventory__formBody">
                <div className="cafeInventory__sessionDetails">
                  <div className="cafeInventory__sessionInfo">
                    <div>
                      <strong>Создан:</strong>{" "}
                      {new Date(viewingStockCheck.created_at).toLocaleString(
                        "ru-RU"
                      )}
                    </div>
                    {viewingStockCheck.confirmed_at && (
                      <div>
                        <strong>Подтвержден:</strong>{" "}
                        {new Date(viewingStockCheck.confirmed_at).toLocaleString(
                          "ru-RU"
                        )}
                      </div>
                    )}
                    <div>
                      <strong>Статус:</strong>{" "}
                      {viewingStockCheck.is_confirmed ? "Подтвержден" : "Ожидает"}
                    </div>
                  </div>

                  <div className="cafeInventory__sessionItemsList">
                    <h4>Продукты ({viewingStockCheck.items?.length || 0}):</h4>
                    {viewingStockCheck.items?.map((item, idx) => {
                      const qtyExpected = toNum(item.qty_expected || 0);
                      const qtyCounted = toNum(item.qty_counted || 0);
                      const difference = toNum(item.difference || 0);
                      return (
                        <div key={idx} className="cafeInventory__sessionItemView">
                          <div>
                            <strong>{item.product_title || "Неизвестно"}</strong>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              Ед. измерения: {item.product_unit || "шт"}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              <strong>Ожидается:</strong> {qtyExpected}{" "}
                              {item.product_unit || "шт"}
                            </span>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              <strong>Фактически:</strong> {qtyCounted}{" "}
                              {item.product_unit || "шт"}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color:
                                  difference > 0
                                    ? "#10b981"
                                    : difference < 0
                                    ? "#ef4444"
                                    : "#6b7280",
                                fontWeight: "bold",
                              }}
                            >
                              <strong>Разница:</strong>{" "}
                              {difference > 0 ? "+" : ""}
                              {difference.toFixed(2)} {item.product_unit || "шт"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {!viewingStockCheck.is_confirmed && (
                <div className="cafeInventory__formActions">
                  <button
                    type="button"
                    className="cafeInventory__btn cafeInventory__btn--secondary"
                    onClick={() => setViewStockCheckModalOpen(false)}
                  >
                    Закрыть
                  </button>
                  <button
                    type="button"
                    className="cafeInventory__btn cafeInventory__btn--success"
                    onClick={() => openConfirmStockCheck(viewingStockCheck.id)}
                  >
                    <FaCheckCircle /> Подтвердить акт
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка подтверждения удаления оборудования */}
      {confirmDeleteOpen && (
        <div className="cafeInventory__modalOverlay" onClick={closeDeleteConfirm}>
          <div className="cafeInventory__modal cafeInventory__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">Удалить оборудование?</h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={closeDeleteConfirm}
                type="button"
                aria-label="Закрыть"
                disabled={deleteBusy}
              >
                <FaTimes />
              </button>
            </div>

            <div className="cafeInventory__confirmBody">
              <div className="cafeInventory__confirmText">Оборудование будет удалено. Это действие нельзя отменить.</div>

              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={closeDeleteConfirm}
                  disabled={deleteBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--danger"
                  onClick={handleDelete}
                  disabled={deleteBusy}
                >
                  {deleteBusy ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка подтверждения акта инвентаризации */}
      {confirmSessionOpen && (
        <div className="cafeInventory__modalOverlay" onClick={closeConfirmSession}>
          <div className="cafeInventory__modal cafeInventory__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">Подтвердить акт инвентаризации?</h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={closeConfirmSession}
                type="button"
                aria-label="Закрыть"
                disabled={confirmSessionBusy}
              >
                <FaTimes />
              </button>
            </div>

            <div className="cafeInventory__confirmBody">
              <div className="cafeInventory__confirmText">Акт будет подтвержден. Это обновит состояние оборудования.</div>

              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={closeConfirmSession}
                  disabled={confirmSessionBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--success"
                  onClick={confirmSession}
                  disabled={confirmSessionBusy}
                >
                  {confirmSessionBusy ? "Подтверждение…" : "Подтвердить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка подтверждения акта сверки продуктов */}
      {confirmStockCheckOpen && (
        <div className="cafeInventory__modalOverlay" onClick={closeConfirmStockCheck}>
          <div className="cafeInventory__modal cafeInventory__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cafeInventory__modalHeader">
              <h3 className="cafeInventory__modalTitle">Подтвердить акт сверки продуктов?</h3>
              <button
                className="cafeInventory__iconBtn"
                onClick={closeConfirmStockCheck}
                type="button"
                aria-label="Закрыть"
                disabled={confirmStockCheckBusy}
              >
                <FaTimes />
              </button>
            </div>

            <div className="cafeInventory__confirmBody">
              <div className="cafeInventory__confirmText">Акт будет подтвержден. Это обновит остатки продуктов на складе.</div>

              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={closeConfirmStockCheck}
                  disabled={confirmStockCheckBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--success"
                  onClick={confirmStockCheck}
                  disabled={confirmStockCheckBusy}
                >
                  {confirmStockCheckBusy ? "Подтверждение…" : "Подтвердить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <InventoryItemsPickerModal
        open={equipmentPickerOpen}
        onClose={() => setEquipmentPickerOpen(false)}
        title="Выбор оборудования"
        description="Отметьте позиции для добавления в акт. Можно выбрать все сразу или по одной."
        searchValue={equipmentPickerSearch}
        onSearchChange={setEquipmentPickerSearch}
        items={equipmentPickerItems}
        selectedIds={equipmentPickerSelected}
        onToggle={toggleEquipmentPickerItem}
        onToggleSelectAll={toggleEquipmentPickerSelectAll}
        isAllFilteredSelected={isAllEquipmentPickerSelected}
        onConfirm={applyEquipmentPicker}
        confirmLabel={
          equipmentPickerSelected.size > 0
            ? `Добавить (${equipmentPickerSelected.size})`
            : "Добавить выбранные"
        }
        emptyText={
          availableEquipmentForSession.length === 0
            ? "Всё оборудование уже добавлено в акт"
            : "Оборудование не найдено. Измените поиск."
        }
        icon={FaTools}
      />

      <InventoryItemsPickerModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        title="Выбор продуктов"
        description="Отметьте продукты для сверки. Фактическое количество по умолчанию — текущий остаток на складе."
        searchValue={productPickerSearch}
        onSearchChange={setProductPickerSearch}
        items={productPickerItems}
        selectedIds={productPickerSelected}
        onToggle={toggleProductPickerItem}
        onToggleSelectAll={toggleProductPickerSelectAll}
        isAllFilteredSelected={isAllProductPickerSelected}
        onConfirm={applyProductPicker}
        confirmLabel={
          productPickerSelected.size > 0
            ? `Добавить (${productPickerSelected.size})`
            : "Добавить выбранные"
        }
        emptyText={
          availableProductsForStockCheck.length === 0
            ? "Все продукты уже добавлены в акт"
            : "Продукты не найдены. Измените поиск."
        }
        icon={FaBoxes}
      />
    </section>
  );
};

export default CafeInventory;