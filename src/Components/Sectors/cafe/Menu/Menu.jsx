// // src/Components/Sectors/cafe/Menu/Menu.jsx
// import React, { useEffect, useMemo, useState, useCallback } from "react";
// import { FaListUl, FaThLarge, FaTimes, FaTrash } from "react-icons/fa";
// import api from "../../../../api";
// import "./Menu.scss";

// import MenuHeader from "./components/MenuHeader";
// import MenuItemsTab from "./components/MenuItemsTab";
// import MenuCategoriesTab from "./components/MenuCategoriesTab";
// import MenuItemModal from "./components/MenuItemModal";
// import MenuCategoryModal from "./components/MenuCategoryModal";

// const listFrom = (res) => res?.data?.results || res?.data || [];

// const toNum = (x) => {
//   if (x === null || x === undefined) return 0;
//   const n = Number(String(x).replace(",", "."));
//   return Number.isFinite(n) ? n : 0;
// };

// const fmtMoney = (n) =>
//   new Intl.NumberFormat("ru-RU", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   }).format(toNum(n));

// const numStr = (n) => String(Number(n) || 0).replace(",", ".");

// const normalizeDecimalInput = (value) => {
//   const raw = String(value ?? "").replace(",", ".");
//   // Разрешаем: "", "0", "0.", "0.2", "12.345"
//   if (/^\d*\.?\d*$/.test(raw)) return raw;
//   return null;
// };

// const Menu = () => {
//   const [activeTab, setActiveTab] = useState("items");
//   const [viewMode, setViewMode] = useState("cards");

//   const [categories, setCategories] = useState([]);
//   const [warehouse, setWarehouse] = useState([]);

//   const [items, setItems] = useState([]);
//   const [loadingItems, setLoadingItems] = useState(true);
//   const [loadingCats, setLoadingCats] = useState(true);

//   const [queryItems, setQueryItems] = useState("");
//   const [queryCats, setQueryCats] = useState("");

//   const [modalOpen, setModalOpen] = useState(false);
//   const [editingId, setEditingId] = useState(null);
//   const [form, setForm] = useState({
//     title: "",
//     category: "",
//     price: "0",
//     is_active: true,
//     ingredients: [],
//   });

//   const [imageFile, setImageFile] = useState(null);
//   const [imagePreview, setImagePreview] = useState("");

//   const [catModalOpen, setCatModalOpen] = useState(false);
//   const [catEditId, setCatEditId] = useState(null);
//   const [catTitle, setCatTitle] = useState("");

//   // confirm modal (вместо window.confirm)
//   const [confirmOpen, setConfirmOpen] = useState(false);
//   const [confirmKind, setConfirmKind] = useState(""); // "item" | "cat"
//   const [confirmId, setConfirmId] = useState(null);
//   const [confirmTitle, setConfirmTitle] = useState("");

//   const categoriesMap = useMemo(() => {
//     const m = new Map();
//     categories.forEach((c) => m.set(c.id, c.title));
//     return m;
//   }, [categories]);

//   const warehouseMap = useMemo(() => {
//     const m = new Map();
//     warehouse.forEach((w) => m.set(w.id, w));
//     return m;
//   }, [warehouse]);

//   const categoryTitle = (id) => categoriesMap.get(id) || "Без категории";
//   const productTitle = (id) => warehouseMap.get(id)?.title || id || "";
//   const productUnit = (id) => warehouseMap.get(id)?.unit || "";

//   const fetchCats = async () => {
//     const cats = await api.get("/cafe/categories/");
//     setCategories(listFrom(cats));
//   };

//   const fetchWarehouse = async () => {
//     const wh = await api.get("/cafe/warehouse/");
//     setWarehouse(listFrom(wh));
//   };

//   const fetchMenuList = async () => {
//     const res = await api.get("/cafe/menu-items/");
//     setItems(listFrom(res));
//   };

//   const fetchMenuDetail = async (id) => {
//     if (!id) return null;
//     try {
//       const r = await api.get(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
//       return r?.data || null;
//     } catch (e) {
//       console.error("Ошибка detail блюда:", e);
//       return null;
//     }
//   };

//   useEffect(() => {
//     (async () => {
//       try {
//         setLoadingCats(true);
//         await fetchCats();
//       } catch (e) {
//         console.error("Ошибка категорий:", e);
//       } finally {
//         setLoadingCats(false);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     (async () => {
//       try {
//         await fetchWarehouse();
//       } catch (e) {
//         console.error("Ошибка склада:", e);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     (async () => {
//       try {
//         setLoadingItems(true);
//         await fetchMenuList();
//       } catch (e) {
//         console.error("Ошибка меню:", e);
//       } finally {
//         setLoadingItems(false);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     return () => {
//       if (imagePreview && imagePreview.startsWith("blob:")) {
//         URL.revokeObjectURL(imagePreview);
//       }
//     };
//   }, [imagePreview]);

//   const filteredItems = useMemo(() => {
//     const q = queryItems.trim().toLowerCase();
//     if (!q) return items;
//     return items.filter((m) => {
//       const title = (m.title || "").toLowerCase();
//       const cat = categoryTitle(m.category).toLowerCase();
//       return title.includes(q) || cat.includes(q);
//     });
//   }, [items, queryItems, categoriesMap]);

//   const filteredCats = useMemo(() => {
//     const q = queryCats.trim().toLowerCase();
//     if (!q) return categories;
//     return categories.filter((c) => (c.title || "").toLowerCase().includes(q));
//   }, [categories, queryCats]);

//   const openCreate = () => {
//     setEditingId(null);
//     setForm({
//       title: "",
//       category: categories[0]?.id || "",
//       price: "0",
//       is_active: true,
//       ingredients: [],
//     });
//     setImageFile(null);
//     setImagePreview("");
//     setModalOpen(true);
//   };

//   const openEdit = async (item) => {
//     const baseId = item?.id;
//     let full = item;

//     if (!Array.isArray(item?.ingredients)) {
//       const d = await fetchMenuDetail(baseId);
//       if (d) full = d;
//     }

//     setEditingId(full.id);
//     setForm({
//       title: full.title || "",
//       category: full.category || categories[0]?.id || "",
//       price: String(full.price ?? "0").replace(",", "."),
//       is_active: !!full.is_active,
//       ingredients: Array.isArray(full.ingredients)
//         ? full.ingredients.map((ing) => ({
//             product: ing.product,
//             // ВАЖНО: строка, чтобы "0.2" работало без прыжков
//             amount: String(ing.amount ?? "").replace(",", "."),
//           }))
//         : [],
//     });

//     setImageFile(null);
//     setImagePreview(full.image_url || "");
//     setModalOpen(true);
//   };

//   const onPickImage = (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     if (imagePreview && imagePreview.startsWith("blob:")) {
//       URL.revokeObjectURL(imagePreview);
//     }

//     setImageFile(file);
//     setImagePreview(URL.createObjectURL(file));
//   };

//   const buildPayload = () => {
//     const payload = {
//       title: (form.title || "").trim(),
//       category: form.category,
//       price: numStr(Math.max(0, Number(String(form.price ?? "0").replace(",", ".")) || 0)),
//       is_active: !!form.is_active,
//       ingredients: (form.ingredients || [])
//         .filter((r) => r && r.product && String(r.amount || "").trim() !== "")
//         .map((r) => ({
//           product: r.product,
//           amount: numStr(Math.max(0, Number(String(r.amount).replace(",", ".")) || 0)),
//         })),
//     };

//     if (!payload.title || !payload.category) return null;
//     return payload;
//   };

//   const uploadImageIfNeeded = async (id) => {
//     if (!id || !imageFile) return true;

//     const fd = new FormData();
//     fd.append("image", imageFile);

//     try {
//       await api.patch(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, fd, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       return true;
//     } catch (e) {
//       try {
//         const p = buildPayload();
//         if (!p) return false;

//         const fd2 = new FormData();
//         fd2.append("title", p.title);
//         fd2.append("category", p.category);
//         fd2.append("price", p.price);
//         fd2.append("is_active", p.is_active ? "true" : "false");
//         fd2.append("ingredients", JSON.stringify(p.ingredients));
//         fd2.append("image", imageFile);

//         await api.put(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, fd2, {
//           headers: { "Content-Type": "multipart/form-data" },
//         });

//         return true;
//       } catch (e2) {
//         console.error("Ошибка загрузки картинки:", e2);
//         return false;
//       }
//     }
//   };

//   const saveItem = async (e) => {
//     e.preventDefault();

//     const payload = buildPayload();
//     if (!payload) return;

//     try {
//       let saved = null;

//       if (editingId == null) {
//         const res = await api.post("/cafe/menu-items/", payload);
//         saved = res?.data || null;
//       } else {
//         const res = await api.put(
//           `/cafe/menu-items/${encodeURIComponent(String(editingId))}/`,
//           payload
//         );
//         saved = res?.data || null;
//       }

//       const savedId = saved?.id || editingId;

//       if (imageFile && savedId) {
//         const ok = await uploadImageIfNeeded(savedId);
//         if (!ok) console.error("Картинка не загрузилась, но блюдо сохранено.");
//       }

//       const full = savedId ? await fetchMenuDetail(savedId) : null;
//       const finalItem = full || saved;

//       if (finalItem?.id) {
//         setItems((prev) => {
//           const exists = prev.some((m) => String(m.id) === String(finalItem.id));
//           if (!exists) return [...prev, finalItem];
//           return prev.map((m) => (String(m.id) === String(finalItem.id) ? finalItem : m));
//         });
//       } else {
//         await fetchMenuList();
//       }

//       setModalOpen(false);

//       if (imagePreview && imagePreview.startsWith("blob:")) {
//         URL.revokeObjectURL(imagePreview);
//       }

//       setImageFile(null);
//       setImagePreview("");
//     } catch (err) {
//       console.error("Ошибка сохранения блюда:", err);
//     }
//   };

//   const openConfirmDeleteItem = (id) => {
//     setConfirmKind("item");
//     setConfirmId(id);
//     setConfirmTitle("Удалить позицию меню?");
//     setConfirmOpen(true);
//   };

//   const openConfirmDeleteCat = (id) => {
//     setConfirmKind("cat");
//     setConfirmId(id);
//     setConfirmTitle("Удалить категорию?");
//     setConfirmOpen(true);
//   };

//   const closeConfirm = () => {
//     setConfirmOpen(false);
//     setConfirmKind("");
//     setConfirmId(null);
//     setConfirmTitle("");
//   };

//   const confirmDelete = async () => {
//     const id = confirmId;
//     const kind = confirmKind;

//     closeConfirm();

//     if (!id || !kind) return;

//     try {
//       if (kind === "item") {
//         await api.delete(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
//         setItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
//         return;
//       }

//       if (kind === "cat") {
//         await api.delete(`/cafe/categories/${encodeURIComponent(String(id))}/`);
//         setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
//       }
//     } catch (err) {
//       console.error("Ошибка удаления:", err);
//     }
//   };

//   const addIngredientRow = () =>
//     setForm((f) => ({
//       ...f,
//       ingredients: [...(f.ingredients || []), { product: "", amount: "1" }],
//     }));

//   // ✅ КЛЮЧЕВОЙ FIX: amount хранится строкой, точка не ломается
//   const changeIngredientRow = (idx, field, value) => {
//     setForm((f) => {
//       const rows = [...(f.ingredients || [])];
//       const row = { ...(rows[idx] || {}) };

//       if (field === "product") row.product = value;

//       if (field === "amount") {
//         const normalized = normalizeDecimalInput(value);
//         if (normalized !== null) row.amount = normalized;
//       }

//       rows[idx] = row;
//       return { ...f, ingredients: rows };
//     });
//   };

//   const removeIngredientRow = (idx) =>
//     setForm((f) => ({
//       ...f,
//       ingredients: (f.ingredients || []).filter((_, i) => i !== idx),
//     }));

//   const openCreateCat = () => {
//     setCatEditId(null);
//     setCatTitle("");
//     setCatModalOpen(true);
//   };

//   const openEditCat = (row) => {
//     setCatEditId(row.id);
//     setCatTitle(row.title || "");
//     setCatModalOpen(true);
//   };

//   const saveCat = async (e) => {
//     e.preventDefault();
//     const payload = { title: (catTitle || "").trim() };
//     if (!payload.title) return;

//     try {
//       if (catEditId) {
//         const res = await api.put(
//           `/cafe/categories/${encodeURIComponent(String(catEditId))}/`,
//           payload
//         );
//         setCategories((prev) => prev.map((c) => (c.id === catEditId ? res.data : c)));
//       } else {
//         const res = await api.post("/cafe/categories/", payload);
//         setCategories((prev) => [...prev, res.data]);
//       }
//       setCatModalOpen(false);
//     } catch (e2) {
//       console.error("Ошибка сохранения категории:", e2);
//     }
//   };

//   return (
//     <section className="menu">
//       <div className="menu__topRow">
//         <div className="menu__topGrow">
//           <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />
//         </div>

//         {activeTab === "items" && (
//           <div className="menu__viewToggle" aria-label="Переключение вида">
//             <button
//               type="button"
//               className={`menu__viewBtn ${viewMode === "list" ? "menu__viewBtn--active" : ""}`}
//               onClick={() => setViewMode("list")}
//               title="Список"
//             >
//               <FaListUl />
//             </button>

//             <button
//               type="button"
//               className={`menu__viewBtn ${viewMode === "cards" ? "menu__viewBtn--active" : ""}`}
//               onClick={() => setViewMode("cards")}
//               title="Карточки"
//             >
//               <FaThLarge />
//             </button>
//           </div>
//         )}
//       </div>

//       {activeTab === "items" && (
//         <MenuItemsTab
//           loadingItems={loadingItems}
//           filteredItems={filteredItems}
//           queryItems={queryItems}
//           setQueryItems={setQueryItems}
//           onCreate={openCreate}
//           onEdit={openEdit}
//           onDelete={openConfirmDeleteItem} // ✅ вместо window.confirm
//           hasCategories={!!categories.length}
//           categoryTitle={categoryTitle}
//           fmtMoney={fmtMoney}
//           toNum={toNum}
//           productTitle={productTitle}
//           productUnit={productUnit}
//           viewMode={viewMode}
//         />
//       )}

//       {activeTab === "categories" && (
//         <MenuCategoriesTab
//           loadingCats={loadingCats}
//           filteredCats={filteredCats}
//           queryCats={queryCats}
//           setQueryCats={setQueryCats}
//           onCreateCat={openCreateCat}
//           onEditCat={openEditCat}
//           onDeleteCat={openConfirmDeleteCat} // ✅ вместо window.confirm
//         />
//       )}

//       <MenuItemModal
//         isOpen={modalOpen}
//         onClose={() => setModalOpen(false)}
//         editingId={editingId}
//         form={form}
//         setForm={setForm}
//         categories={categories}
//         warehouse={warehouse}
//         onSubmit={saveItem}
//         imageFile={imageFile}
//         imagePreview={imagePreview}
//         onPickImage={onPickImage}
//         addIngredientRow={addIngredientRow}
//         changeIngredientRow={changeIngredientRow}
//         removeIngredientRow={removeIngredientRow}
//       />

//       <MenuCategoryModal
//         isOpen={catModalOpen}
//         onClose={() => setCatModalOpen(false)}
//         catEditId={catEditId}
//         catTitle={catTitle}
//         setCatTitle={setCatTitle}
//         onSubmit={saveCat}
//       />

//       {confirmOpen && (
//         <div className="menu-modal__overlay" onMouseDown={closeConfirm}>
//           <div className="menu-modal__card" onMouseDown={(e) => e.stopPropagation()}>
//             <div className="menu-modal__header">
//               <div className="menu-modal__headLeft">
//                 <h3 className="menu-modal__title">{confirmTitle || "Подтверждение"}</h3>
//                 <div className="menu-modal__sub">Действие нельзя отменить.</div>
//               </div>

//               <button type="button" className="menu-modal__close" onClick={closeConfirm} aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             <div className="menu__form">
//               <div className="menu__formActions">
//                 <button type="button" className="menu__btn menu__btn--secondary" onClick={closeConfirm}>
//                   Отмена
//                 </button>

//                 <button type="button" className="menu__btn menu__btn--danger" onClick={confirmDelete}>
//                   <FaTrash /> Удалить
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// };

// export default Menu;



// src/Components/Sectors/cafe/Menu/Menu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaListUl, FaThLarge, FaTimes, FaTrash } from "react-icons/fa";
import api from "../../../../api";
import "./Menu.scss";

import MenuHeader from "./components/MenuHeader";
import MenuItemsTab from "./components/MenuItemsTab";
import MenuCategoriesTab from "./components/MenuCategoriesTab";
import MenuItemModal from "./components/MenuItemModal";
import MenuCategoryModal from "./components/MenuCategoryModal";

const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

const numStr = (n) => String(Number(n) || 0).replace(",", ".");

const normalizeDecimalInput = (value) => {
  const raw = String(value ?? "").replace(",", ".");
  // Разрешаем: "", "0", "0.", "0.2", "12.345"
  if (/^\d*\.?\d*$/.test(raw)) return raw;
  return null;
};

const Menu = () => {
  const [activeTab, setActiveTab] = useState("items");
  const [viewMode, setViewMode] = useState("cards");

  const [categories, setCategories] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [warehouse, setWarehouse] = useState([]);

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  const [queryItems, setQueryItems] = useState("");
  const [queryCats, setQueryCats] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    kitchen: "",
    price: "0",
    is_active: true,
    ingredients: [],
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [catTitle, setCatTitle] = useState("");

  // confirm modal (вместо window.confirm)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState(""); // "item" | "cat"
  const [confirmId, setConfirmId] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState("");

  const categoriesMap = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.id, c.title));
    return m;
  }, [categories]);

  const kitchensMap = useMemo(() => {
    const m = new Map();
    kitchens.forEach((k) => {
      const title = k.title || k.name || k.kitchen_title || "Кухня";
      const number = k.number ?? k.kitchen_number;
      const label = `${title}${number !== undefined && number !== null && number !== "" ? ` №${number}` : ""}`;
      m.set(k.id, label);
    });
    return m;
  }, [kitchens]);

  const warehouseMap = useMemo(() => {
    const m = new Map();
    warehouse.forEach((w) => m.set(w.id, w));
    return m;
  }, [warehouse]);

  const categoryTitle = (id) => categoriesMap.get(id) || "Без категории";
  const kitchenTitle = (id) => kitchensMap.get(id) || "";
  const productTitle = (id) => warehouseMap.get(id)?.title || id || "";
  const productUnit = (id) => warehouseMap.get(id)?.unit || "";

  const fetchCats = async () => {
    const cats = await api.get("/cafe/categories/");
    setCategories(listFrom(cats));
  };

  const fetchKitchens = async () => {
    // ВАЖНО: если у тебя endpoint называется иначе — замени здесь.
    // По swagger у menu-items есть поле kitchen, значит обычно есть список кухонь.
    const res = await api.get("/cafe/kitchens/");
    setKitchens(listFrom(res));
  };

  const fetchWarehouse = async () => {
    const wh = await api.get("/cafe/warehouse/");
    setWarehouse(listFrom(wh));
  };

  const fetchMenuList = async () => {
    const res = await api.get("/cafe/menu-items/");
    setItems(listFrom(res));
  };

  const fetchMenuDetail = async (id) => {
    if (!id) return null;
    try {
      const r = await api.get(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
      return r?.data || null;
    } catch (e) {
      console.error("Ошибка detail блюда:", e);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingCats(true);
        await fetchCats();
      } catch (e) {
        console.error("Ошибка категорий:", e);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchKitchens();
      } catch (e) {
        // Не валим страницу: кухня необязательна.
        console.error("Ошибка кухонь:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchWarehouse();
      } catch (e) {
        console.error("Ошибка склада:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingItems(true);
        await fetchMenuList();
      } catch (e) {
        console.error("Ошибка меню:", e);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const filteredItems = useMemo(() => {
    const q = queryItems.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const title = (m.title || "").toLowerCase();
      const cat = categoryTitle(m.category).toLowerCase();
      const kit = kitchenTitle(m.kitchen).toLowerCase();
      return title.includes(q) || cat.includes(q) || kit.includes(q);
    });
  }, [items, queryItems, categoriesMap, kitchensMap]);

  const filteredCats = useMemo(() => {
    const q = queryCats.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [categories, queryCats]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      category: categories[0]?.id || "",
      kitchen: "",
      price: "0",
      is_active: true,
      ingredients: [],
    });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  const openEdit = async (item) => {
    const baseId = item?.id;
    let full = item;

    if (!Array.isArray(item?.ingredients)) {
      const d = await fetchMenuDetail(baseId);
      if (d) full = d;
    }

    setEditingId(full.id);
    setForm({
      title: full.title || "",
      category: full.category || categories[0]?.id || "",
      kitchen: full.kitchen ? String(full.kitchen) : "",
      price: String(full.price ?? "0").replace(",", "."),
      is_active: !!full.is_active,
      ingredients: Array.isArray(full.ingredients)
        ? full.ingredients.map((ing) => ({
            product: ing.product,
            // строка, чтобы "0.2" работало без прыжков
            amount: String(ing.amount ?? "").replace(",", "."),
          }))
        : [],
    });

    setImageFile(null);
    setImagePreview(full.image_url || "");
    setModalOpen(true);
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const buildPayload = () => {
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      kitchen: form.kitchen ? form.kitchen : null, // ✅ "" => null
      price: numStr(Math.max(0, Number(String(form.price ?? "0").replace(",", ".")) || 0)),
      is_active: !!form.is_active,
      ingredients: (form.ingredients || [])
        .filter((r) => r && r.product && String(r.amount || "").trim() !== "")
        .map((r) => ({
          product: r.product,
          amount: numStr(Math.max(0, Number(String(r.amount).replace(",", ".")) || 0)),
        })),
    };

    if (!payload.title || !payload.category) return null;
    return payload;
  };

  const uploadImageIfNeeded = async (id) => {
    if (!id || !imageFile) return true;

    const fd = new FormData();
    fd.append("image", imageFile);

    try {
      await api.patch(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return true;
    } catch (e) {
      try {
        const p = buildPayload();
        if (!p) return false;

        const fd2 = new FormData();
        fd2.append("title", p.title);
        fd2.append("category", p.category);
        if (p.kitchen) fd2.append("kitchen", p.kitchen);
        fd2.append("price", p.price);
        fd2.append("is_active", p.is_active ? "true" : "false");
        fd2.append("ingredients", JSON.stringify(p.ingredients));
        fd2.append("image", imageFile);

        await api.put(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, fd2, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        return true;
      } catch (e2) {
        console.error("Ошибка загрузки картинки:", e2);
        return false;
      }
    }
  };

  const saveItem = async (e) => {
    e.preventDefault();

    const payload = buildPayload();
    if (!payload) return;

    try {
      let saved = null;

      if (editingId == null) {
        const res = await api.post("/cafe/menu-items/", payload);
        saved = res?.data || null;
      } else {
        const res = await api.put(`/cafe/menu-items/${encodeURIComponent(String(editingId))}/`, payload);
        saved = res?.data || null;
      }

      const savedId = saved?.id || editingId;

      if (imageFile && savedId) {
        const ok = await uploadImageIfNeeded(savedId);
        if (!ok) console.error("Картинка не загрузилась, но блюдо сохранено.");
      }

      const full = savedId ? await fetchMenuDetail(savedId) : null;
      const finalItem = full || saved;

      if (finalItem?.id) {
        setItems((prev) => {
          const exists = prev.some((m) => String(m.id) === String(finalItem.id));
          if (!exists) return [...prev, finalItem];
          return prev.map((m) => (String(m.id) === String(finalItem.id) ? finalItem : m));
        });
      } else {
        await fetchMenuList();
      }

      setModalOpen(false);

      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setImageFile(null);
      setImagePreview("");
    } catch (err) {
      console.error("Ошибка сохранения блюда:", err);
    }
  };

  const openConfirmDeleteItem = (id) => {
    setConfirmKind("item");
    setConfirmId(id);
    setConfirmTitle("Удалить позицию меню?");
    setConfirmOpen(true);
  };

  const openConfirmDeleteCat = (id) => {
    setConfirmKind("cat");
    setConfirmId(id);
    setConfirmTitle("Удалить категорию?");
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmKind("");
    setConfirmId(null);
    setConfirmTitle("");
  };

  const confirmDelete = async () => {
    const id = confirmId;
    const kind = confirmKind;

    closeConfirm();

    if (!id || !kind) return;

    try {
      if (kind === "item") {
        await api.delete(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
        setItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
        return;
      }

      if (kind === "cat") {
        await api.delete(`/cafe/categories/${encodeURIComponent(String(id))}/`);
        setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
      }
    } catch (err) {
      console.error("Ошибка удаления:", err);
    }
  };

  const addIngredientRow = () =>
    setForm((f) => ({
      ...f,
      ingredients: [...(f.ingredients || []), { product: "", amount: "1" }],
    }));

  // amount хранится строкой, точка не ломается
  const changeIngredientRow = (idx, field, value) => {
    setForm((f) => {
      const rows = [...(f.ingredients || [])];
      const row = { ...(rows[idx] || {}) };

      if (field === "product") row.product = value;

      if (field === "amount") {
        const normalized = normalizeDecimalInput(value);
        if (normalized !== null) row.amount = normalized;
      }

      rows[idx] = row;
      return { ...f, ingredients: rows };
    });
  };

  const removeIngredientRow = (idx) =>
    setForm((f) => ({
      ...f,
      ingredients: (f.ingredients || []).filter((_, i) => i !== idx),
    }));

  const openCreateCat = () => {
    setCatEditId(null);
    setCatTitle("");
    setCatModalOpen(true);
  };

  const openEditCat = (row) => {
    setCatEditId(row.id);
    setCatTitle(row.title || "");
    setCatModalOpen(true);
  };

  const saveCat = async (e) => {
    e.preventDefault();
    const payload = { title: (catTitle || "").trim() };
    if (!payload.title) return;

    try {
      if (catEditId) {
        const res = await api.put(`/cafe/categories/${encodeURIComponent(String(catEditId))}/`, payload);
        setCategories((prev) => prev.map((c) => (c.id === catEditId ? res.data : c)));
      } else {
        const res = await api.post("/cafe/categories/", payload);
        setCategories((prev) => [...prev, res.data]);
      }
      setCatModalOpen(false);
    } catch (e2) {
      console.error("Ошибка сохранения категории:", e2);
    }
  };

  return (
    <section className="menu">
      <div className="menu__topRow">
        <div className="menu__topGrow">
          <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {activeTab === "items" && (
          <div className="menu__viewToggle" aria-label="Переключение вида">
            <button
              type="button"
              className={`menu__viewBtn ${viewMode === "list" ? "menu__viewBtn--active" : ""}`}
              onClick={() => setViewMode("list")}
              title="Список"
            >
              <FaListUl />
            </button>

            <button
              type="button"
              className={`menu__viewBtn ${viewMode === "cards" ? "menu__viewBtn--active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Карточки"
            >
              <FaThLarge />
            </button>
          </div>
        )}
      </div>

      {activeTab === "items" && (
        <MenuItemsTab
          loadingItems={loadingItems}
          filteredItems={filteredItems}
          queryItems={queryItems}
          setQueryItems={setQueryItems}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={openConfirmDeleteItem}
          hasCategories={!!categories.length}
          categoryTitle={categoryTitle}
          fmtMoney={fmtMoney}
          toNum={toNum}
          productTitle={productTitle}
          productUnit={productUnit}
          viewMode={viewMode}
        />
      )}

      {activeTab === "categories" && (
        <MenuCategoriesTab
          loadingCats={loadingCats}
          filteredCats={filteredCats}
          queryCats={queryCats}
          setQueryCats={setQueryCats}
          onCreateCat={openCreateCat}
          onEditCat={openEditCat}
          onDeleteCat={openConfirmDeleteCat}
        />
      )}

      <MenuItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        form={form}
        setForm={setForm}
        categories={categories}
        kitchens={kitchens}
        warehouse={warehouse}
        onSubmit={saveItem}
        imageFile={imageFile}
        imagePreview={imagePreview}
        onPickImage={onPickImage}
        addIngredientRow={addIngredientRow}
        changeIngredientRow={changeIngredientRow}
        removeIngredientRow={removeIngredientRow}
      />

      <MenuCategoryModal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        catEditId={catEditId}
        catTitle={catTitle}
        setCatTitle={setCatTitle}
        onSubmit={saveCat}
      />

      {confirmOpen && (
        <div className="menu-modal__overlay" onMouseDown={closeConfirm}>
          <div className="menu-modal__card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="menu-modal__header">
              <div className="menu-modal__headLeft">
                <h3 className="menu-modal__title">{confirmTitle || "Подтверждение"}</h3>
                <div className="menu-modal__sub">Действие нельзя отменить.</div>
              </div>

              <button type="button" className="menu-modal__close" onClick={closeConfirm} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            <div className="menu__form">
              <div className="menu__formActions">
                <button type="button" className="menu__btn menu__btn--secondary" onClick={closeConfirm}>
                  Отмена
                </button>

                <button type="button" className="menu__btn menu__btn--danger" onClick={confirmDelete}>
                  <FaTrash /> Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Menu;
