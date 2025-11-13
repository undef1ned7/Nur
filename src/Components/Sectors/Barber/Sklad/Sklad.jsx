// import { Minus, MoreVertical, Plus, X } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import "./Sklad.scss";

// import {
//   createBrandAsync,
//   createProductAsync,
//   deleteProductAsync,
//   fetchBrandsAsync,
//   fetchCategoriesAsync,
//   fetchProductsAsync,
//   updateProductAsync,
// } from "../../../store/creators/productCreators";
// import barcodeImage from "./barcode (2).gif";

// import {
//   createClientAsync,
//   fetchClientsAsync,
// } from "../../../store/creators/clientCreators";
// import { createDeal } from "../../../store/creators/saleThunk";
// import {
//   addCashFlows,
//   getCashBoxes,
//   useCash,
// } from "../../../store/slices/cashSlice";
// import { useClient } from "../../../store/slices/ClientSlice";
// import { clearProducts, useProducts } from "../../../store/slices/productSlice";
// import { useUser } from "../../../store/slices/userSlice";
// import AddProductBarcode from "./AddProductBarcode";
// import { id } from "date-fns/locale";
// import MarriageModal from "./MarriageModal";
// import EditModal from "./EditModal/EditModal";

// /* ===================== ВСПОМОГАТЕЛЬНЫЕ МОДАЛКИ ===================== */

// const AddBrandModal = ({ onClose }) => {
//   const dispatch = useDispatch();
//   const [name, setName] = useState("");

//   const handleSave = async () => {
//     if (!name.trim()) return alert("Введите название бренда");
//     try {
//       await dispatch(createBrandAsync({ name })).unwrap();
//       onClose();
//     } catch (e) {
//       alert("Ошибка создания бренда: " + (e.detail || e));
//     }
//   };

//   return (
//     <div className="add-modal">
//       <div className="add-modal__overlay" onClick={onClose} />
//       <div className="add-modal__content">
//         <div className="add-modal__header">
//           <h3>Добавление бренда</h3>
//           <X className="add-modal__close-icon" size={20} onClick={onClose} />
//         </div>

//         <div className="add-modal__section">
//           <label>Название *</label>
//           <input
//             type="text"
//             placeholder="Например, Samsung"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//           />
//         </div>

//         <div className="add-modal__footer">
//           <button className="add-modal__cancel" onClick={onClose}>
//             Отмена
//           </button>
//           <button className="add-modal__save" onClick={handleSave}>
//             Сохранить
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// const FilterModal = ({
//   onClose,
//   currentFilters,
//   onApplyFilters,
//   onResetFilters,
// }) => {
//   const [filters, setFilters] = useState(() => {
//     return {
//       name: currentFilters.name || "",
//       category: currentFilters.category || "",
//       min_price: currentFilters.min_price || "",
//       max_price: currentFilters.max_price || "",
//       min_quantity: currentFilters.min_quantity || "",
//       max_quantity: currentFilters.max_quantity || "",
//     };
//   });

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFilters((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleApply = () => {
//     const cleanedFilters = {};
//     for (const key in filters) {
//       const value = filters[key];
//       if (value !== undefined && value !== null && value !== "") {
//         cleanedFilters[key] = value;
//       }
//     }
//     onApplyFilters(cleanedFilters);
//     onClose();
//   };

//   const handleReset = () => {
//     const resetValues = {
//       name: "",
//       category: "",
//       min_price: "",
//       max_price: "",
//       min_quantity: "",
//       max_quantity: "",
//     };
//     setFilters(resetValues);
//     onResetFilters();
//     onClose();
//   };

//   return (
//     <div className="filter-modal">
//       <div className="filter-modal__overlay" onClick={onClose} />
//       <div className="filter-modal__content">
//         <div className="filter-modal__header">
//           <h3>Фильтры товаров</h3>
//           <X className="filter-modal__close-icon" size={20} onClick={onClose} />
//         </div>

//         <div className="filter-modal__section">
//           <label>Название</label>
//           <input
//             type="text"
//             name="name"
//             placeholder="Название товара"
//             value={filters.name}
//             onChange={handleChange}
//           />
//         </div>

//         <div className="filter-modal__section">
//           <label>Категория</label>
//           <input
//             type="text"
//             name="category"
//             placeholder="Например, Электроника"
//             value={filters.category}
//             onChange={handleChange}
//           />
//         </div>

//         <div className="filter-modal__section">
//           <label>Минимальная цена</label>
//           <input
//             type="number"
//             name="min_price"
//             placeholder="0"
//             value={filters.min_price}
//             onChange={handleChange}
//             min="0"
//             step="0.01"
//           />
//         </div>

//         <div className="filter-modal__section">
//           <label>Максимальная цена</label>
//           <input
//             type="number"
//             name="max_price"
//             placeholder="1000"
//             value={filters.max_price}
//             onChange={handleChange}
//             min="0"
//             step="0.01"
//           />
//         </div>

//         <div className="filter-modal__section">
//           <label>Минимальное количество</label>
//           <input
//             type="number"
//             name="min_quantity"
//             placeholder="0"
//             value={filters.min_quantity}
//             onChange={handleChange}
//             min="0"
//           />
//         </div>

//         <div className="filter-modal__section">
//           <label>Максимальное количество</label>
//           <input
//             type="number"
//             name="max_quantity"
//             placeholder="100"
//             value={filters.max_quantity}
//             onChange={handleChange}
//             min="0"
//           />
//         </div>

//         <div className="filter-modal__footer">
//           <button className="filter-modal__reset" onClick={handleReset}>
//             Сбросить фильтры
//           </button>
//           <button className="filter-modal__apply" onClick={handleApply}>
//             Применить фильтры
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// /* ===================== НОВОЕ: Модалка «Принять товар» ===================== */

// const AcceptPendingModal = ({ onClose, onChanged }) => {
//   const dispatch = useDispatch();
//   const { list: products, loading } = useSelector((s) => s.product);
//   const { list: cashBoxes } = useCash();
//   const { company } = useUser();
//   const [selectedCashBox, setSelectedCashBox] = useState("");

//   useEffect(() => {
//     dispatch(getCashBoxes());
//   }, [dispatch]);

//   const pending = useMemo(
//     () =>
//       (products || []).filter(
//         (p) => String(p.status).toLowerCase() === "pending"
//       ),
//     [products]
//   );

//   const refresh = () => {
//     dispatch(fetchProductsAsync({})).finally(() => {
//       onChanged?.();
//     });
//   };

//   const calcExpenseAmount = (item) => {
//     const price = Number(item?.purchase_price ?? item?.price ?? 0);
//     const qty = Number(item?.quantity ?? 0);
//     const amt = price * qty;
//     // округлим до 2 знаков
//     return Math.round(amt * 100) / 100;
//   };

//   const acceptDisabled = !selectedCashBox;

//   const handleAccept = async (item) => {
//     if (!selectedCashBox) {
//       alert("Сначала выберите кассу вверху модалки.");
//       return;
//     }
//     try {
//       // 1) Принять товар (статус -> accepted)
//       await dispatch(
//         updateProductAsync({
//           productId: item.id,
//           updatedData: { status: "accepted" },
//         })
//       ).unwrap();

//       // 2) Движение денег в кассу как расход
//       const amount = calcExpenseAmount(item);
//       if (amount > 0) {
//         await dispatch(
//           addCashFlows({
//             cashbox: selectedCashBox,
//             type: "expense",
//             name: item.name,
//             amount,
//             status: company?.subscription_plan?.name === "Старт" ? true : false,
//           })
//         ).unwrap();
//       }
//       refresh();
//     } catch (e) {
//       console.error(e);
//       alert("Не удалось принять товар");
//     }
//   };

//   const handleReject = async (item) => {
//     try {
//       // Только смена статуса, без кассы
//       await dispatch(
//         updateProductAsync({
//           productId: item.id,
//           updatedData: { status: "rejected" },
//         })
//       ).unwrap();
//       refresh();
//     } catch (e) {
//       console.error(e);
//       alert("Не удалось отклонить товар");
//     }
//   };

//   return (
//     <div className="add-modal accept">
//       <div className="add-modal__overlay" onClick={onClose} />
//       <div className="add-modal__content" role="dialog" aria-modal="true">
//         <div className="add-modal__header">
//           <h3>Принятие товаров (статус: pending)</h3>
//           <X className="add-modal__close-icon" size={20} onClick={onClose} />
//         </div>

//         <div className="add-modal__section">
//           <label>Касса (обязательно для принятия)</label>
//           <select
//             className="add-modal__input"
//             value={selectedCashBox}
//             onChange={(e) => setSelectedCashBox(e.target.value)}
//           >
//             <option value="">-- выберите кассу --</option>
//             {cashBoxes?.map((cash) => (
//               <option key={cash.id} value={cash.id}>
//                 {cash.name ?? cash.department_name}
//               </option>
//             ))}
//           </select>
//           {!selectedCashBox && (
//             <div className="hint">
//               Для кнопки «Принять» нужно выбрать кассу. «Отказать» можно без
//               выбора кассы.
//             </div>
//           )}
//         </div>

//         {loading ? (
//           <div className="add-modal__section">Загрузка…</div>
//         ) : pending.length === 0 ? (
//           <div className="add-modal__section">
//             Нет товаров со статусом pending.
//           </div>
//         ) : (
//           <div
//             className="table-wrapper"
//             style={{ maxHeight: 400, overflow: "auto" }}
//           >
//             <table className="sklad__table">
//               <thead>
//                 <tr>
//                   <th>№</th>
//                   <th>Название</th>
//                   <th>Поставщик</th>
//                   <th>Кол-во</th>
//                   <th>Закуп. цена</th>
//                   <th>Итого (расход)</th>
//                   <th>Действия</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {pending.map((item, idx) => {
//                   const expense = calcExpenseAmount(item);
//                   return (
//                     <tr key={item.id}>
//                       <td>{idx + 1}</td>
//                       <td>{item.name}</td>
//                       <td>{item.client_name || "—"}</td>
//                       <td>{item.quantity}</td>
//                       <td>{item.purchase_price ?? "—"}</td>
//                       <td>{expense.toFixed(2)}</td>
//                       <td>
//                         <button
//                           className="add-modal__save"
//                           style={{ marginRight: 8 }}
//                           disabled={acceptDisabled}
//                           title={
//                             acceptDisabled
//                               ? "Выберите кассу выше"
//                               : "Принять товар"
//                           }
//                           onClick={() => handleAccept(item)}
//                         >
//                           Принять
//                         </button>
//                         <button
//                           className="add-modal__cancel"
//                           onClick={() => handleReject(item)}
//                         >
//                           Отказать
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}

//         <div className="add-modal__footer">
//           <button className="add-modal__cancel" onClick={onClose}>
//             Закрыть
//           </button>
//           <button
//             className="add-modal__save"
//             onClick={() => dispatch(fetchProductsAsync({}))}
//           >
//             Обновить список
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };
// const AcceptHistoryModal = ({ onClose, onChanged }) => {
//   const dispatch = useDispatch();
//   const { list: products, loading } = useSelector((s) => s.product);

//   // Товары, ожидающие отправки (при необходимости поправьте статус на "pending")
//   const pending = useMemo(
//     () =>
//       (products || []).filter(
//         (p) => String(p.status).toLowerCase() === "accepted"
//       ),
//     [products]
//   );

//   const refresh = () => {
//     dispatch(fetchProductsAsync({})).finally(() => {
//       onChanged?.();
//     });
//   };

//   const calcExpenseAmount = (item) => {
//     const price = Number(item?.purchase_price ?? item?.price ?? 0);
//     const qty = Number(item?.quantity ?? 0);
//     const amt = price * qty;
//     return Math.round(amt * 100) / 100;
//   };

//   const handleAccept = async (item) => {
//     try {
//       // Только смена статуса -> history, без кассы/движений денег
//       await dispatch(
//         updateProductAsync({
//           productId: item.id,
//           updatedData: { status: "history" },
//         })
//       ).unwrap();

//       refresh();
//     } catch (e) {
//       console.error(e);
//       alert("Не удалось отправить товар");
//     }
//   };

//   const handleReject = async (item) => {
//     try {
//       await dispatch(
//         updateProductAsync({
//           productId: item.id,
//           updatedData: { status: "rejected" },
//         })
//       ).unwrap();
//       refresh();
//     } catch (e) {
//       console.error(e);
//       alert("Не удалось отклонить товар");
//     }
//   };

//   return (
//     <div className="add-modal accept">
//       <div className="add-modal__overlay" onClick={onClose} />
//       <div className="add-modal__content" role="dialog" aria-modal="true">
//         <div className="add-modal__header">
//           <h3>Отправка товара</h3>
//           <X className="add-modal__close-icon" size={20} onClick={onClose} />
//         </div>

//         {loading ? (
//           <div className="add-modal__section">Загрузка…</div>
//         ) : pending.length === 0 ? (
//           <div className="add-modal__section">
//             Нет товаров со статусом pending.
//           </div>
//         ) : (
//           <div
//             className="table-wrapper"
//             style={{ maxHeight: 400, overflow: "auto" }}
//           >
//             <table className="sklad__table">
//               <thead>
//                 <tr>
//                   <th>№</th>
//                   <th>Название</th>
//                   <th>Поставщик</th>
//                   <th>Кол-во</th>
//                   <th>Закуп. цена</th>
//                   <th>Итого (расход)</th>
//                   <th>Действия</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {pending.map((item, idx) => {
//                   const expense = calcExpenseAmount(item);
//                   return (
//                     <tr key={item.id}>
//                       <td>{idx + 1}</td>
//                       <td>{item.name}</td>
//                       <td>{item.client_name || "—"}</td>
//                       <td>{item.quantity}</td>
//                       <td>{item.purchase_price ?? "—"}</td>
//                       <td>{expense.toFixed(2)}</td>
//                       <td>
//                         <button
//                           className="add-modal__save"
//                           style={{ marginRight: 8 }}
//                           title="Принять товар"
//                           onClick={() => handleAccept(item)}
//                         >
//                           Отправить
//                         </button>
//                         <button
//                           className="add-modal__cancel"
//                           onClick={() => handleReject(item)}
//                         >
//                           Отказать
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}

//         <div className="add-modal__footer">
//           <button className="add-modal__cancel" onClick={onClose}>
//             Закрыть
//           </button>
//           <button
//             className="add-modal__save"
//             onClick={() => dispatch(fetchProductsAsync({}))}
//           >
//             Обновить список
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// /* ======================= AddModal (добавление товара) ======================= */

// const AddModal = ({ onClose, onSaveSuccess, cashBoxes, selectCashBox }) => {
//   const { list } = useClient();

//   const dispatch = useDispatch();
//   const { creating, createError, brands, categories, barcodeError } =
//     useProducts();
//   const { company } = useUser();
//   const [activeTab, setActiveTab] = useState(null);
//   const [isTabSelected, setIsTabSelected] = useState(false);

//   const [newItemData, setNewItemData] = useState({
//     name: "",
//     barcode: "",
//     brand_name: "",
//     category_name: "",
//     price: "",
//     quantity: "",
//     client: "",
//     purchase_price: "",
//   });

//   const { 0: state, 1: setState } = useState({
//     full_name: "",
//     phone: "",
//     email: "",
//     date: new Date().toISOString().split("T")[0],
//     type: "suppliers",
//     llc: "",
//     inn: "",
//     okpo: "",
//     score: "",
//     bik: "",
//     address: "",
//   });

//   const [cashData, setCashData] = useState({
//     cashbox: "",
//     type: "expense",
//     name: "",
//     amount: "",
//     status: company?.subscription_plan?.name === "Старт" ? true : false,
//   });
//   const [showInputs, setShowInputs] = useState(false);
//   const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
//   const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";

//   const isBuildingCompany = sectorName === "строительная компания";
//   const isStartPlan = planName === "старт";

//   const onChange = (e) => {
//     const { name, value } = e.target;
//     setState((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleChange = (e) => {
//     const { name, value, type } = e.target;

//     setNewItemData((prevData) => ({
//       ...prevData,
//       [name]: type === "number" ? (value === "" ? "" : parseInt(value)) : value,
//     }));
//   };

//   const handleSubmit = async () => {
//     const {
//       name,
//       barcode,
//       brand_name,
//       category_name,
//       price,
//       quantity,
//       client,
//       purchase_price,
//     } = newItemData;

//     if (
//       !name ||
//       !barcode ||
//       price === "" ||
//       quantity === "" ||
//       brand_name === "" ||
//       category_name === "" ||
//       purchase_price === ""
//     ) {
//       alert("Пожалуйста, заполните все обязательные поля.");
//       return;
//     }

//     const payload = {
//       name,
//       barcode,
//       brand_name,
//       category_name,
//       price: price.toString(),
//       quantity: Number(quantity),
//       client,
//       purchase_price,
//     };

//     try {
//       const product = await dispatch(createProductAsync(payload)).unwrap();
//       await dispatch(
//         addCashFlows({
//           ...cashData,
//           amount: (product?.purchase_price * product?.quantity).toFixed(2),
//         })
//       ).unwrap();
//       if (client !== "") {
//         await dispatch(
//           createDeal({
//             clientId: newItemData?.client,
//             title: newItemData?.name,
//             statusRu: "Продажа",
//             amount: (product?.purchase_price * product?.quantity).toFixed(2),
//             // debtMonths: dealStatus === "Долги" ? Number(debtMonths) : undefined,
//           })
//         ).unwrap();
//       }
//       onClose();
//       onSaveSuccess();
//     } catch (err) {
//       console.error("Failed to create product:", err);
//       alert(
//         `Ошибка при добавлении товара: ${err.message || JSON.stringify(err)}`
//       );
//     }
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       await dispatch(createClientAsync(state)).unwrap();
//       dispatch(fetchClientsAsync());
//       setShowInputs(false);
//     } catch (e) {
//       console.log(e);
//     }
//   };
//   const filterClient = list.filter((item) => item.type === "suppliers");

//   const tabs = [
//     {
//       label: "Сканировать",
//       content: <AddProductBarcode />,
//       option: "scan",
//     },
//     {
//       label: "Вручную",
//       content: (
//         <>
//           <div className="add-modal__section">
//             <label>Название *</label>
//             <input
//               type="text"
//               name="name"
//               placeholder="Например, Монитор Dell"
//               className="add-modal__input"
//               value={newItemData.name}
//               onChange={handleChange}
//               required
//             />
//           </div>

//           <div className="add-modal__section">
//             <label>Штрих код *</label>
//             <input
//               type="text"
//               name="barcode"
//               placeholder="Штрих код"
//               className="add-modal__input"
//               value={newItemData.barcode}
//               onChange={handleChange}
//               required
//             />
//           </div>

//           <div className="add-modal__section">
//             <label>Бренд *</label>
//             <select
//               name="brand_name"
//               className="add-modal__input"
//               value={newItemData.brand_name}
//               onChange={handleChange}
//               required
//             >
//               <option value="">-- Выберите бренд --</option>
//               {brands.map((brand, idx) => (
//                 <option key={brand.id ?? idx} value={brand.name}>
//                   {brand.name}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="add-modal__section">
//             <label>Категория *</label>
//             <select
//               name="category_name"
//               className="add-modal__input"
//               value={newItemData.category_name}
//               onChange={handleChange}
//               required
//             >
//               <option value="">-- Выберите категорию --</option>
//               {categories.map((category, idx) => (
//                 <option key={category.id ?? idx} value={category.name}>
//                   {category.name}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div className="add-modal__section">
//             <label>Поставщик *</label>
//             <select
//               name="client"
//               className="add-modal__input"
//               value={newItemData.client}
//               onChange={handleChange}
//               required
//             >
//               <option value="">-- Выберите поставщика --</option>
//               {filterClient.map((client, idx) => (
//                 <option key={client.id ?? idx} value={client.id}>
//                   {client.full_name}
//                 </option>
//               ))}
//             </select>

//             <button
//               className="create-client"
//               onClick={() => setShowInputs(!showInputs)}
//             >
//               {showInputs ? "Отменить" : "Создать поставщика"}
//             </button>
//             {showInputs && (
//               <form
//                 style={{
//                   display: "flex",
//                   flexDirection: "column",
//                   rowGap: "10px",
//                 }}
//                 onSubmit={onSubmit}
//               >
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   placeholder="ФИО"
//                   name="full_name"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="llc"
//                   placeholder="ОсОО"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="inn"
//                   placeholder="ИНН"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="okpo"
//                   placeholder="ОКПО"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="score"
//                   placeholder="Р/СЧЁТ"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="bik"
//                   placeholder="БИК"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="address"
//                   placeholder="Адрес"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="text"
//                   name="phone"
//                   placeholder="Телефон"
//                 />
//                 <input
//                   className="add-modal__input"
//                   onChange={onChange}
//                   type="email"
//                   name="email"
//                   placeholder="Почта"
//                 />
//                 <div style={{ display: "flex", columnGap: "10px" }}>
//                   <button
//                     className="create-client"
//                     type="button"
//                     onClick={() => setShowInputs(false)}
//                   >
//                     Отмена
//                   </button>
//                   <button className="create-client">Создать</button>
//                 </div>
//               </form>
//             )}
//           </div>

//           <div className="add-modal__section">
//             <label>Розничная цена *</label>
//             <input
//               type="number"
//               name="price"
//               placeholder="999.99"
//               className="add-modal__input"
//               value={newItemData.price}
//               onChange={handleChange}
//               min="0"
//               step="0.01"
//               required
//             />
//           </div>

//           <div className="add-modal__section">
//             <label>Закупочная цена *</label>
//             <input
//               type="number"
//               name="purchase_price"
//               placeholder="999.99"
//               className="add-modal__input"
//               value={newItemData.purchase_price}
//               onChange={handleChange}
//               min="0"
//               step="0.01"
//               required
//             />
//           </div>

//           <div className="add-modal__section">
//             <label>Количество *</label>
//             <input
//               type="number"
//               name="quantity"
//               placeholder="100"
//               className="add-modal__input"
//               value={newItemData.quantity}
//               onChange={handleChange}
//               min="0"
//               required
//             />
//           </div>

//           <div className="add-modal__footer">
//             <button
//               className="add-modal__cancel"
//               onClick={onClose}
//               disabled={creating}
//             >
//               Отмена
//             </button>
//             <button
//               className="add-modal__save"
//               onClick={handleSubmit}
//               disabled={creating}
//             >
//               {creating ? "Добавление..." : "Добавить"}
//             </button>
//           </div>
//         </>
//       ),
//       option: "manually",
//     },
//   ];

//   const handleTabClick = (index) => {
//     setActiveTab(index);
//     setIsTabSelected(true);
//   };
//   useEffect(() => {
//     dispatch(fetchClientsAsync());
//   }, [dispatch]);

//   useEffect(() => {
//     if (barcodeError) {
//       setActiveTab(1);
//       setIsTabSelected(true);
//     }
//   }, [barcodeError]);

//   useEffect(() => {
//     setCashData((prev) => ({
//       ...prev,
//       cashbox: selectCashBox,
//       name: newItemData.name,
//       amount: newItemData.price,
//     }));
//   }, [newItemData, selectCashBox]);

//   return (
//     <div className="add-modal wareSklad">
//       <div className="add-modal__overlay" onClick={onClose} />
//       <div className="add-modal__content">
//         <div className="add-modal__header">
//           <h3>Добавление товара</h3>
//           <X className="add-modal__close-icon" size={20} onClick={onClose} />
//         </div>

//         {createError && (
//           <p className="add-modal__error-message">
//             Ошибка добавления:{" "}
//             {createError.message || JSON.stringify(createError)}
//           </p>
//         )}
//         {company?.sector?.name === "Магазин" ||
//         company?.subscription_plan?.name === "Старт" ? (
//           <>
//             {tabs.map((tab, index) => (
//               <button
//                 key={index}
//                 className={`add-modal__button ${
//                   activeTab === index && isTabSelected
//                     ? "add-modal__button-active"
//                     : ""
//                 }`}
//                 onClick={() => handleTabClick(index)}
//               >
//                 {tab.label}
//               </button>
//             ))}

//             {isTabSelected && activeTab !== null && (
//               <div className="vitrina__content">{tabs[activeTab].content}</div>
//             )}
//           </>
//         ) : (
//           <>{tabs[1].content}</>
//         )}
//       </div>
//     </div>
//   );
// };

// const SellModal = ({ onClose }) => {
//   const { creating, createError, brands, categories, barcodeError } =
//     useProducts();
//   const [activeTab, setActiveTab] = useState(0);
//   const [isTabSelected, setIsTabSelected] = useState(true);

//   const tabs = [
//     {
//       label: "Сканировать",
//       content: (
//         <div className="scan" onClick={() => setActiveTab(null)}>
//           <div className="scan__content">
//             <img src={barcodeImage} alt="" />
//           </div>
//         </div>
//       ),
//       option: "scan",
//     },
//     {
//       label: "Вручную",
//       content: (
//         <>
//           <form>
//             <input
//               type="text"
//               placeholder="штрих код"
//               className="add-modal__input"
//             />
//           </form>
//         </>
//       ),
//       option: "manually",
//     },
//   ];
//   const products = [
//     { id: 1, name: "Товар1", amount: 2, price: 75 },
//     { id: 2, name: "Товар2", amount: 2, price: 75 },
//     { id: 3, name: "Товар3", amount: 2, price: 75 },
//   ];

//   const handleTabClick = (index) => {
//     setActiveTab(index);
//     setIsTabSelected(true);
//   };
//   return (
//     <div className="add-modal">
//       <div className="add-modal__overlay" onClick={onClose} />
//       <div className="add-modal__content">
//         <div className="add-modal__header">
//           <h3>Продажа товара</h3>
//           <X className="add-modal__close-icon" size={20} onClick={onClose} />
//         </div>

//         {tabs.map((tab, index) => {
//           return (
//             <button
//               key={index}
//               className={`add-modal__button  ${
//                 activeTab === index && isTabSelected
//                   ? "add-modal__button-active"
//                   : ""
//               }`}
//               onClick={() => handleTabClick(index)}
//             >
//               {tab.label}
//             </button>
//           );
//         })}
//         {isTabSelected && activeTab !== null && (
//           <div className="add-modal__container">{tabs[activeTab].content}</div>
//         )}

//         {products.length !== 0 && (
//           <div className="receipt">
//             <h2 className="receipt__title">Приход</h2>
//             {products.map((product) => (
//               <div className="receipt__item" key={product.id}>
//                 <p className="receipt__item-name">
//                   {product.id}. {product.name}
//                 </p>
//                 <p className="receipt__item-price">
//                   {product.amount} x {product.price} ≡{" "}
//                   {product.amount * product.price}
//                 </p>
//               </div>
//             ))}
//             <div className="receipt__total">
//               <b>ИТОГО</b>
//               <b>
//                 ≡{" "}
//                 {products
//                   .reduce((acc, rec) => {
//                     return acc + rec.amount * rec.price;
//                   }, 0)
//                   .toFixed(2)}
//               </b>
//             </div>
//             <div className="receipt__row">
//               <button className="receipt__row-btn">Печать чека</button>
//               <button className="receipt__row-btn">Без чека</button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// /* ============================== ГЛАВНЫЙ СКЛАД ============================== */

// export default function () {
//   const dispatch = useDispatch();

//   const {
//     list: products,
//     loading,
//     brands,
//     categories,
//     error,
//     count,
//     next,
//     previous,
//     creating,
//     updating,
//     deleting,
//   } = useSelector((state) => state.product);
//   const { list: cashBoxes } = useCash();
//   const { company } = useUser();

//   const [showEditModal, setShowEditModal] = useState(false);
//   const [showFilterModal, setShowFilterModal] = useState(false);
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [showSellModal, setShowSellModal] = useState(false);
//   const [showReceiveModal, setShowReceiveModal] = useState(false); // ← НОВОЕ
//   const [selectedItem, setSelectedItem] = useState(null);
//   const [selectCashBox, setSelectCashBox] = useState("");
//   const [showHistoryModal, setShowHistoryModal] = useState(false);
//   const [showMarriageModal, setShowMarriageModal] = useState(false);
//   const [itemId, setItemId] = useState({});

//   const [searchTerm, setSearchTerm] = useState("");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [currentFilters, setCurrentFilters] = useState({});

//   const [showBrandModal, setShowBrandModal] = useState(false);
//   const [showCategoryModal, setShowCategoryModal] = useState(false);
//   const [barcode, setBarcode] = useState("");
//   const [scannerVisible, setScannerVisible] = useState(false);
//   const [selectValue, setSelectValue] = useState("all");
//   const [activeTab, setActiveTab] = useState(0);
//   const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
//   const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";

//   const isBuildingCompany = sectorName === "строительная компания";
//   const isStartPlan = planName === "старт";

//   // ★ Храним выбранные товары в Set, чтобы быстро добавлять/убирать
//   const [selectedIds, setSelectedIds] = useState(new Set());
//   // ★ Флаг массового удаления
//   const [bulkDeleting, setBulkDeleting] = useState(false);

//   useEffect(() => {
//     const params = {
//       page: currentPage,
//       search: searchTerm,
//       ...currentFilters,
//     };
//     dispatch(fetchProductsAsync(params));
//     dispatch(fetchBrandsAsync());
//     dispatch(fetchCategoriesAsync());

//     return () => {
//       dispatch(clearProducts());
//     };
//   }, [
//     dispatch,
//     currentPage,
//     searchTerm,
//     creating,
//     updating,
//     deleting,
//     currentFilters,
//   ]);

//   const handleEdit = (item) => {
//     setSelectedItem(item);
//     setShowEditModal(true);
//   };

//   const handleAdd = () => {
//     setShowAddModal(true);
//   };

//   const handleSaveSuccess = () => {
//     setShowEditModal(false);
//     setShowAddModal(false);
//     alert("Операция с товаром успешно завершена!");
//     dispatch(
//       fetchProductsAsync({
//         page: currentPage,
//         search: searchTerm,
//         ...currentFilters,
//       })
//     );
//   };

//   const handleDeleteConfirm = () => {
//     setShowEditModal(false);
//     // ★ Если удалили один товар из модалки — уберём его из выбранных
//     if (selectedItem?.id) {
//       setSelectedIds((prev) => {
//         const next = new Set(prev);
//         next.delete(selectedItem.id);
//         return next;
//       });
//     }
//     alert("Товар успешно удален!");
//     dispatch(
//       fetchProductsAsync({
//         page: currentPage,
//         search: searchTerm,
//         ...currentFilters,
//       })
//     );
//   };

//   const handleSearchChange = (e) => {
//     setSearchTerm(e.target.value);
//     setCurrentPage(1);
//   };

//   const handleResetAllFilters = () => {
//     setSearchTerm("");
//     setCurrentFilters({});
//     setCurrentPage(1);
//   };

//   const handleNextPage = () => {
//     if (next) {
//       setCurrentPage((prev) => prev + 1);
//     }
//   };

//   const handlePreviousPage = () => {
//     if (previous) {
//       setCurrentPage((prev) => prev - 1);
//     }
//   };

//   const handleApplyFilters = (filters) => {
//     setCurrentFilters(filters);
//     setCurrentPage(1);
//   };

//   const handleOpen = (id) => {
//     setShowMarriageModal(true);
//     setItemId(id);
//   };

//   const isFiltered = searchTerm || Object.keys(currentFilters).length > 0;

//   const totalPages =
//     count && products.length > 0 ? Math.ceil(count / products.length) : 1;

//   useEffect(() => {
//     const handleEsc = (event) => {
//       if (event.keyCode === 27) {
//         setShowAddModal(false);
//         setShowSellModal(false);
//         setShowEditModal(false);
//         setShowFilterModal(false);
//         setShowReceiveModal(false);
//       }
//     };

//     window.addEventListener("keydown", handleEsc);
//     return () => window.removeEventListener("keydown", handleEsc);
//   }, []);

//   useEffect(() => {
//     dispatch(getCashBoxes());
//   }, [dispatch]);

//   const filterProducts = products.filter((item) => item.status === "accepted");
//   const filteredHistory = products.filter((item) => item.status === "history");
//   const filterP =
//     company.sector?.name === "Строительная компания"
//       ? filterProducts
//       : products;
//   // ★ helpers выбора
//   const isSelected = (id) => selectedIds.has(id);
//   const toggleRow = (id) => {
//     setSelectedIds((prev) => {
//       const next = new Set(prev);
//       if (next.has(id)) next.delete(id);
//       else next.add(id);
//       return next;
//     });
//   };
//   const toggleSelectAllOnPage = (items) => {
//     setSelectedIds((prev) => {
//       const next = new Set(prev);
//       const allSelected =
//         items.length > 0 && items.every((i) => next.has(i.id));
//       items.forEach((i) => {
//         if (allSelected) next.delete(i.id);
//         else next.add(i.id);
//       });
//       return next;
//     });
//   };
//   const clearSelection = () => setSelectedIds(new Set());

//   // ★ массовое удаление
//   const handleBulkDelete = async () => {
//     if (selectedIds.size === 0) return;
//     if (
//       !window.confirm(
//         `Удалить выбранные ${selectedIds.size} товар(ов)? Это действие нельзя отменить.`
//       )
//     ) {
//       return;
//     }

//     try {
//       setBulkDeleting(true);
//       const res = await fetch(
//         "https://app.nurcrm.kg/api/main/products/bulk-delete/",
//         {
//           method: "DELETE",
//           headers: {
//             "Content-Type": "application/json",
//             Accept: "application/json",
//             Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
//           },
//           body: JSON.stringify({
//             ids: Array.from(selectedIds),
//             soft: true,
//             require_all: false,
//           }),
//           credentials: "include", // если у вас сессии/куки; можно убрать при необходимости
//         }
//       );

//       if (!res.ok) {
//         const text = await res.text();
//         throw new Error(text || `HTTP ${res.status}`);
//       }

//       clearSelection();
//       alert("Выбранные товары удалены");
//       dispatch(
//         fetchProductsAsync({
//           page: currentPage,
//           search: searchTerm,
//           ...currentFilters,
//         })
//       );
//     } catch (e) {
//       alert("Не удалось удалить товары: " + e.message);
//     } finally {
//       setBulkDeleting(false);
//     }
//   };

//   // ★ общий UI блок для кнопок «Удалить выбранные» + счётчик
//   const SelectionActions = ({ pageItems }) => {
//     const allOnPageChecked =
//       pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
//     return (
//       <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
//         {/* Кнопка выбор/снять всё на текущей странице */}
//         <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
//           <input
//             type="checkbox"
//             checked={allOnPageChecked}
//             onChange={() => toggleSelectAllOnPage(pageItems)}
//           />
//           <span>Все на странице</span>
//         </label>

//         {selectedIds.size > 0 && (
//           <>
//             <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span>
//             <button
//               className="sklad__add"
//               style={{ background: "#e53935" }}
//               onClick={handleBulkDelete}
//               disabled={bulkDeleting}
//               title="Массовое удаление выбранных товаров"
//             >
//               {bulkDeleting ? "Удаляем..." : "Удалить выбранные"}
//             </button>
//             <button
//               className="sklad__reset"
//               onClick={clearSelection}
//               style={{ cursor: "pointer" }}
//               title="Снять весь выбор"
//             >
//               Сбросить выбор
//             </button>
//           </>
//         )}
//       </div>
//     );
//   };

//   const tabs = [
//     {
//       label: "Склад",
//       content: (
//         <>
//           <div className="sklad__header">
//             <div className="sklad__left">
//               <input
//                 type="text"
//                 placeholder="Поиск по названию товара"
//                 className="sklad__search"
//                 value={searchTerm}
//                 onChange={handleSearchChange}
//               />
//               {/* <select className="employee__search-wrapper">
//                 {categories.map((category) => (
//                   <option key={category.id} value={category.id}>
//                     {category.name}
//                   </option>
//                 ))}
//               </select> */}
//               <div className="sklad__center">
//                 <span>Всего: {count !== null ? count : "-"}</span>
//                 <span>Найдено: {products.length}</span>
//                 {isFiltered && (
//                   <span
//                     className="sklad__reset"
//                     onClick={handleResetAllFilters}
//                     style={{ cursor: "pointer" }}
//                   >
//                     Сбросить
//                   </span>
//                 )}
//               </div>
//             </div>

//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: "20px",
//                 flexWrap: "wrap",
//               }}
//             >
//               {company.sector?.name === "Строительная компания" ? (
//                 <>
//                   <button
//                     className="sklad__add"
//                     onClick={() => setShowReceiveModal(true)}
//                   >
//                     <Plus size={16} style={{ marginRight: "4px" }} /> Принять
//                     товар
//                   </button>
//                   <button
//                     onClick={() => setShowHistoryModal(true)}
//                     className="sklad__add"
//                   >
//                     <Minus size={16} style={{ marginRight: "4px" }} /> Отправить
//                     товар
//                   </button>
//                 </>
//               ) : (
//                 <>
//                   <select
//                     value={selectCashBox}
//                     onChange={(e) => setSelectCashBox(e.target.value)}
//                     className="employee__search-wrapper"
//                   >
//                     <option value="" disabled>
//                       Выберите кассу
//                     </option>
//                     {cashBoxes?.map((cash) => (
//                       <option key={cash.id} value={cash.id}>
//                         {cash.name ?? cash.department_name}
//                       </option>
//                     ))}
//                   </select>

//                   <button
//                     className="sklad__add"
//                     onClick={handleAdd}
//                     disabled={!selectCashBox}
//                     title={
//                       !selectCashBox ? "Сначала выберите кассу" : undefined
//                     }
//                   >
//                     <Plus size={16} style={{ marginRight: "4px" }} /> Добавить
//                     товар
//                   </button>
//                 </>
//               )}
//               {/* ★ Действия с выбором (для этой вкладки показываем продукты текущей страницы) */}
//             </div>
//           </div>

//           {filterP.length !== 0 && <SelectionActions pageItems={filterP} />}

//           {loading ? (
//             <p className="sklad__loading-message">Загрузка товаров...</p>
//           ) : error ? (
//             <p className="sklad__error-message">Ошибка загрузки:</p>
//           ) : filterP.length === 0 ? (
//             <p className="sklad__no-products-message">Нет доступных товаров.</p>
//           ) : (
//             <div className="table-wrapper">
//               <table className="sklad__table">
//                 <thead>
//                   <tr>
//                     <th>
//                       {/* ★ checkbox выделения всех на этой странице */}
//                       <input
//                         type="checkbox"
//                         checked={
//                           filterP.length > 0 &&
//                           filterP.every((i) => selectedIds.has(i.id))
//                         }
//                         onChange={() => toggleSelectAllOnPage(filterP)}
//                       />
//                     </th>
//                     <th></th>
//                     <th>№</th>
//                     <th>Название</th>
//                     <th>Поставщик</th>
//                     <th>Цена</th>
//                     <th>Количество</th>
//                     <th>Категория</th>
//                     <th></th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filterP.map((item, index) => (
//                     <tr key={item.id}>
//                       <td>
//                         {/* ★ чекбокс строки */}
//                         <input
//                           type="checkbox"
//                           checked={isSelected(item.id)}
//                           onChange={() => toggleRow(item.id)}
//                         />
//                       </td>
//                       <td>
//                         <MoreVertical
//                           size={16}
//                           onClick={() => handleEdit(item)}
//                           style={{ cursor: "pointer" }}
//                         />
//                       </td>
//                       <td>{index + 1}</td>
//                       <td>
//                         <strong>{item.name}</strong>
//                       </td>
//                       <td>{item.client_name ? item.client_name : "-"}</td>
//                       <td>{item.price}</td>
//                       <td>
//                         {" "}
//                         {item.quantity === 0 ? (
//                           <span className="sell__badge--danger">
//                             Нет в наличии
//                           </span>
//                         ) : (
//                           item.quantity
//                         )}
//                       </td>
//                       <td>
//                         {item.category?.length < 30
//                           ? item.category
//                           : `${item.category?.slice(0, 30)}...`}
//                       </td>
//                       <td>
//                         <button
//                           className="btn edit-btn"
//                           onClick={() => handleOpen(item)}
//                         >
//                           В брак
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}

//           <div className="sklad__pagination">
//             <span>
//               {currentPage} из {totalPages}
//             </span>
//             <button
//               onClick={handlePreviousPage}
//               disabled={
//                 !previous || loading || creating || updating || deleting
//               }
//             >
//               ←
//             </button>
//             <button
//               onClick={handleNextPage}
//               disabled={!next || loading || creating || updating || deleting}
//             >
//               →
//             </button>
//           </div>
//         </>
//       ),
//       option: "scan",
//     },
//     {
//       label: "История",
//       content: (
//         <>
//           <div className="sklad__header">
//             <div className="sklad__left">
//               <input
//                 type="text"
//                 placeholder="Поиск по названию товара"
//                 className="sklad__search"
//                 value={searchTerm}
//                 onChange={handleSearchChange}
//               />
//               {/* <select className="employee__search-wrapper">
//                 {categories.map((category) => (
//                   <option key={category.id} value={category.id}>
//                     {category.name}
//                   </option>
//                 ))}
//               </select> */}
//               <div className="sklad__center">
//                 <span>Всего: {count !== null ? count : "-"}</span>
//                 <span>Найдено: {products.length}</span>
//                 {isFiltered && (
//                   <span
//                     className="sklad__reset"
//                     onClick={handleResetAllFilters}
//                     style={{ cursor: "pointer" }}
//                   >
//                     Сбросить
//                   </span>
//                 )}
//               </div>
//             </div>
//             {/* ★ Действия с выбором для фильтрованных */}
//           </div>

//           {filteredHistory.length !== 0 && (
//             <SelectionActions pageItems={products} />
//           )}

//           {loading ? (
//             <p className="sklad__loading-message">Загрузка товаров...</p>
//           ) : error ? (
//             <p className="sklad__error-message">Ошибка загрузки</p>
//           ) : filteredHistory.length === 0 ? (
//             <p className="sklad__no-products-message">Нет доступных товаров.</p>
//           ) : (
//             <div className="table-wrapper">
//               <table className="sklad__table">
//                 <thead>
//                   <tr>
//                     <th>
//                       {/* ★ селект всё для этой страницы (accepted) */}
//                       <input
//                         type="checkbox"
//                         checked={
//                           filteredHistory.length > 0 &&
//                           filteredHistory.every((i) => selectedIds.has(i.id))
//                         }
//                         onChange={() => toggleSelectAllOnPage(filteredHistory)}
//                       />
//                     </th>
//                     <th></th>
//                     <th>№</th>
//                     <th>Название</th>
//                     <th>Поставщик</th>
//                     <th>Цена</th>
//                     <th>Количество</th>
//                     <th>Категория</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filteredHistory.map((item, index) => (
//                     <tr key={item.id}>
//                       <td>
//                         <input
//                           type="checkbox"
//                           checked={isSelected(item.id)}
//                           onChange={() => toggleRow(item.id)}
//                         />
//                       </td>
//                       <td>
//                         <MoreVertical
//                           size={16}
//                           onClick={() => handleEdit(item)}
//                           style={{ cursor: "pointer" }}
//                         />
//                       </td>
//                       <td>{index + 1}</td>
//                       <td>
//                         <strong>{item.name}</strong>
//                       </td>
//                       <td>{item.client_name ? item.client_name : "-"}</td>
//                       <td>{item.price}</td>
//                       <td>{item.quantity}</td>
//                       <td>{item.category}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}

//           <div className="sklad__pagination">
//             <span>
//               {currentPage} из {totalPages}
//             </span>
//             <button
//               onClick={handlePreviousPage}
//               disabled={
//                 !previous || loading || creating || updating || deleting
//               }
//             >
//               ←
//             </button>
//             <button
//               onClick={handleNextPage}
//               disabled={!next || loading || creating || updating || deleting}
//             >
//               →
//             </button>
//           </div>
//         </>
//       ),
//       option: "manually",
//     },
//   ];

//   return (
//     <div className="sklad">
//       {isStartPlan ? (
//         // 🔹 Если тариф Старт → всегда этот вариант
//         <>{tabs[0].content}</>
//       ) : isBuildingCompany ? (
//         // 🔹 Если НЕ старт, но строительная компания
//         <>
//           <div className="vitrina__header" style={{ margin: "15px 0" }}>
//             <div className="vitrina__tabs">
//               {tabs.map((tab, index) => {
//                 return (
//                   <span
//                     key={index}
//                     className={`vitrina__tab ${
//                       index === activeTab && "vitrina__tab--active"
//                     }`}
//                     onClick={() => setActiveTab(index)}
//                   >
//                     {tab.label}
//                   </span>
//                 );
//               })}
//             </div>
//           </div>
//           {tabs[activeTab].content}
//         </>
//       ) : (
//         // 🔹 Все остальные (НЕ старт и НЕ строительная компания)
//         <>{tabs[0].content}</>
//       )}

//       {showEditModal && selectedItem && (
//         <EditModal
//           item={selectedItem}
//           onClose={() => setShowEditModal(false)}
//           onSaveSuccess={handleSaveSuccess}
//           onDeleteConfirm={handleDeleteConfirm}
//         />
//       )}

//       {showFilterModal && (
//         <FilterModal
//           onClose={() => setShowFilterModal(false)}
//           currentFilters={currentFilters}
//           onApplyFilters={handleApplyFilters}
//           onResetFilters={handleResetAllFilters}
//         />
//       )}

//       {showAddModal && (
//         <AddModal
//           onClose={() => setShowAddModal(false)}
//           onSaveSuccess={handleSaveSuccess}
//           cashBoxes={cashBoxes}
//           selectCashBox={selectCashBox}
//         />
//       )}
//       {showSellModal && <SellModal onClose={() => setShowSellModal(false)} />}

//       {showBrandModal && (
//         <AddBrandModal onClose={() => setShowBrandModal(false)} />
//       )}

//       {showReceiveModal && (
//         <AcceptPendingModal
//           onClose={() => setShowReceiveModal(false)}
//           onChanged={() =>
//             dispatch(
//               fetchProductsAsync({
//                 page: currentPage,
//                 search: searchTerm,
//                 ...currentFilters,
//               })
//             )
//           }
//         />
//       )}
//       {showHistoryModal && (
//         <AcceptHistoryModal
//           onClose={() => setShowHistoryModal(false)}
//           onChanged={() =>
//             dispatch(
//               fetchProductsAsync({
//                 page: currentPage,
//                 search: searchTerm,
//                 ...currentFilters,
//               })
//             )
//           }
//         />
//       )}
//       {showMarriageModal && (
//         <MarriageModal
//           onClose={() => setShowMarriageModal(false)}
//           onChanged={() =>
//             dispatch(
//               fetchProductsAsync({
//                 page: currentPage,
//                 search: searchTerm,
//                 ...currentFilters,
//               })
//             )
//           }
//           item={itemId}
//         />
//       )}
//     </div>
//   );
// }

import { Minus, MoreVertical, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import "./Sklad.scss";

import {
  createProductAsync,
  fetchProductsAsync,
  updateProductAsync,
} from "../../../../store/creators/productCreators";
import barcodeImage from "./barcode (2).gif";

// import {
//   createClientAsync,
//   fetchClientsAsync,
// } from "../../../../store/creators/clientCreators";
import { createDeal } from "../../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useClient } from "../../../../store/slices/ClientSlice";
import {
  clearProducts,
  useProducts,
} from "../../../../store/slices/productSlice";
import { useUser } from "../../../../store/slices/userSlice";
import AddProductBarcode from "./AddProductBarcode";
import EditModal from "./EditModal/EditModal";
import MarriageModal from "./MarriageModal";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";

/* ===================== ФИЛЬТРЫ (без категории) ===================== */

const FilterModal = ({
  onClose,
  currentFilters,
  onApplyFilters,
  onResetFilters,
}) => {
  const [filters, setFilters] = useState(() => {
    return {
      name: currentFilters.name || "",
      min_price: currentFilters.min_price || "",
      max_price: currentFilters.max_price || "",
      min_quantity: currentFilters.min_quantity || "",
      max_quantity: currentFilters.max_quantity || "",
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApply = () => {
    const cleanedFilters = {};
    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== "") {
        cleanedFilters[key] = value;
      }
    }
    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    const resetValues = {
      name: "",
      min_price: "",
      max_price: "",
      min_quantity: "",
      max_quantity: "",
    };
    setFilters(resetValues);
    onResetFilters();
    onClose();
  };

  return (
    <div className="filter-modal">
      <div className="filter-modal__overlay" onClick={onClose} />
      <div className="filter-modal__content">
        <div className="filter-modal__header">
          <h3>Фильтры товаров</h3>
          <X className="filter-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="filter-modal__section">
          <label>Название</label>
          <input
            type="text"
            name="name"
            placeholder="Название товара"
            value={filters.name}
            onChange={handleChange}
          />
        </div>

        <div className="filter-modal__section">
          <label>Минимальная цена</label>
          <input
            type="number"
            name="min_price"
            placeholder="0"
            value={filters.min_price}
            onChange={handleChange}
            min="0"
            step="0.01"
          />
        </div>

        <div className="filter-modal__section">
          <label>Максимальная цена</label>
          <input
            type="number"
            name="max_price"
            placeholder="1000"
            value={filters.max_price}
            onChange={handleChange}
            min="0"
            step="0.01"
          />
        </div>

        <div className="filter-modal__section">
          <label>Минимальное количество</label>
          <input
            type="number"
            name="min_quantity"
            placeholder="0"
            value={filters.min_quantity}
            onChange={handleChange}
            min="0"
          />
        </div>

        <div className="filter-modal__section">
          <label>Максимальное количество</label>
          <input
            type="number"
            name="max_quantity"
            placeholder="100"
            value={filters.max_quantity}
            onChange={handleChange}
            min="0"
          />
        </div>

        <div className="filter-modal__footer">
          <button className="filter-modal__reset" onClick={handleReset}>
            Сбросить фильтры
          </button>
          <button className="filter-modal__apply" onClick={handleApply}>
            Применить фильтры
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===================== Модалка «Принять товар» ===================== */

const AcceptPendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();
  const { list: products, loading } = useSelector((s) => s.product);
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const [selectedCashBox, setSelectedCashBox] = useState("");

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  const pending = useMemo(
    () =>
      (products || []).filter(
        (p) => String(p.status).toLowerCase() === "pending"
      ),
    [products]
  );

  const refresh = () => {
    dispatch(fetchProductsAsync({})).finally(() => {
      onChanged?.();
    });
  };

  const calcExpenseAmount = (item) => {
    const price = Number(item?.purchase_price ?? item?.price ?? 0);
    const qty = Number(item?.quantity ?? 0);
    const amt = price * qty;
    return Math.round(amt * 100) / 100;
  };

  const acceptDisabled = !selectedCashBox;

  const handleAccept = async (item) => {
    if (!selectedCashBox) {
      alert("Сначала выберите кассу вверху модалки.");
      return;
    }
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { status: "accepted" },
        })
      ).unwrap();

      const amount = calcExpenseAmount(item);
      if (amount > 0) {
        await dispatch(
          addCashFlows({
            cashbox: selectedCashBox,
            type: "expense",
            name: item.name,
            source_cashbox_flow_id: item.id,
            source_business_operation_id: "Склад",
            amount,
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          })
        ).unwrap();
      }
      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось принять товар");
    }
  };

  const handleReject = async (item) => {
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { status: "rejected" },
        })
      ).unwrap();
      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось отклонить товар");
    }
  };

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" role="dialog" aria-modal="true">
        <div className="add-modal__header">
          <h3>Принятие товаров (статус: pending)</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Касса (обязательно для принятия)</label>
          <select
            className="add-modal__input"
            value={selectedCashBox}
            onChange={(e) => setSelectedCashBox(e.target.value)}
          >
            <option value="">-- выберите кассу --</option>
            {cashBoxes?.map((cash) => (
              <option key={cash.id} value={cash.id}>
                {cash.name ?? cash.department_name}
              </option>
            ))}
          </select>
          {!selectedCashBox && (
            <div className="hint">
              Для кнопки «Принять» нужно выбрать кассу. «Отказать» можно без
              выбора кассы.
            </div>
          )}
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка…</div>
        ) : pending.length === 0 ? (
          <div className="add-modal__section">
            Нет товаров со статусом pending.
          </div>
        ) : (
          <div
            className="table-wrapper"
            style={{ maxHeight: 400, overflow: "auto" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Название</th>
                  <th>Поставщик</th>
                  <th>Кол-во</th>
                  <th>Закуп. цена</th>
                  <th>Итого (расход)</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item, idx) => {
                  const expense = calcExpenseAmount(item);
                  return (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.client_name || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{item.purchase_price ?? "—"}</td>
                      <td>{expense.toFixed(2)}</td>
                      <td>
                        <button
                          className="add-modal__save"
                          style={{ marginRight: 8 }}
                          disabled={acceptDisabled}
                          title={
                            acceptDisabled
                              ? "Выберите кассу выше"
                              : "Принять товар"
                          }
                          onClick={() => handleAccept(item)}
                        >
                          Принять
                        </button>
                        <button
                          className="add-modal__cancel"
                          onClick={() => handleReject(item)}
                        >
                          Отказать
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="add-modal__save"
            onClick={() => dispatch(fetchProductsAsync({}))}
          >
            Обновить список
          </button>
        </div>
      </div>
    </div>
  );
};

const AcceptHistoryModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();
  const { list: products, loading } = useSelector((s) => s.product);

  const pending = useMemo(
    () =>
      (products || []).filter(
        (p) => String(p.status).toLowerCase() === "accepted"
      ),
    [products]
  );

  const refresh = () => {
    dispatch(fetchProductsAsync({})).finally(() => {
      onChanged?.();
    });
  };

  const calcExpenseAmount = (item) => {
    const price = Number(item?.purchase_price ?? item?.price ?? 0);
    const qty = Number(item?.quantity ?? 0);
    const amt = price * qty;
    return Math.round(amt * 100) / 100;
  };

  const handleAccept = async (item) => {
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { status: "history" },
        })
      ).unwrap();

      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось отправить товар");
    }
  };

  const handleReject = async (item) => {
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { status: "rejected" },
        })
      ).unwrap();
      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось отклонить товар");
    }
  };

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" role="dialog" aria-modal="true">
        <div className="add-modal__header">
          <h3>Отправка товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка…</div>
        ) : pending.length === 0 ? (
          <div className="add-modal__section">Нет товаров для отправки.</div>
        ) : (
          <div
            className="table-wrapper"
            style={{ maxHeight: 400, overflow: "auto" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Название</th>
                  <th>Поставщик</th>
                  <th>Кол-во</th>
                  <th>Закуп. цена</th>
                  <th>Итого (расход)</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item, idx) => {
                  const expense = calcExpenseAmount(item);
                  return (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.client_name || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{item.purchase_price ?? "—"}</td>
                      <td>{expense.toFixed(2)}</td>
                      <td>
                        <button
                          className="add-modal__save"
                          style={{ marginRight: 8 }}
                          title="Отправить товар"
                          onClick={() => handleAccept(item)}
                        >
                          Отправить
                        </button>
                        <button
                          className="add-modal__cancel"
                          onClick={() => handleReject(item)}
                        >
                          Отказать
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="add-modal__save"
            onClick={() => dispatch(fetchProductsAsync({}))}
          >
            Обновить список
          </button>
        </div>
      </div>
    </div>
  );
};

/* ======================= AddModal (без бренда/категории) ======================= */

const AddModal = ({ onClose, onSaveSuccess, cashBoxes, selectCashBox }) => {
  const { list } = useClient();

  const dispatch = useDispatch();
  const { creating, createError, barcodeError } = useProducts();
  const { company } = useUser();
  const [activeTab, setActiveTab] = useState(null);
  const [isTabSelected, setIsTabSelected] = useState(false);

  const [newItemData, setNewItemData] = useState({
    name: "",
    barcode: "",
    price: "",
    quantity: "",
    client: "",
    purchase_price: "",
  });

  const { 0: state, 1: setState } = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "suppliers",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });

  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "expense",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Склад",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });
  const [showInputs, setShowInputs] = useState(false);
  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";

  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    setNewItemData((prevData) => ({
      ...prevData,
      [name]: type === "number" ? (value === "" ? "" : parseInt(value)) : value,
    }));
  };

  const handleSubmit = async () => {
    const { name, barcode, price, quantity, client, purchase_price } =
      newItemData;

    if (
      !name ||
      !barcode ||
      price === "" ||
      quantity === "" ||
      purchase_price === ""
    ) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    const payload = {
      name,
      barcode,
      price: price.toString(),
      quantity: Number(quantity),
      client,
      purchase_price,
    };

    try {
      const product = await dispatch(createProductAsync(payload)).unwrap();
      await dispatch(
        addCashFlows({
          ...cashData,
          amount: (product?.purchase_price * product?.quantity).toFixed(2),
          source_cashbox_flow_id: product.id,
        })
      ).unwrap();
      if (client !== "") {
        await dispatch(
          createDeal({
            clientId: newItemData?.client,
            title: newItemData?.name,
            statusRu: "Продажа",
            amount: (product?.purchase_price * product?.quantity).toFixed(2),
          })
        ).unwrap();
      }
      onClose();
      onSaveSuccess();
    } catch (err) {
      console.error("Failed to create product:", err);
      alert(
        `Ошибка при добавлении товара: ${err.message || JSON.stringify(err)}`
      );
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createClientAsync(state)).unwrap();
      dispatch(fetchClientsAsync());
      setShowInputs(false);
    } catch (e) {
      console.log(e);
    }
  };
  const filterClient = list.filter((item) => item.type === "suppliers");

  const tabs = [
    {
      label: "Сканировать",
      content: <AddProductBarcode />,
      option: "scan",
    },
    {
      label: "Вручную",
      content: (
        <>
          <div className="add-modal__section">
            <label>Название *</label>
            <input
              type="text"
              name="name"
              placeholder="Например, Монитор Dell"
              className="add-modal__input"
              value={newItemData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Штрих код *</label>
            <input
              type="text"
              name="barcode"
              placeholder="Штрих код"
              className="add-modal__input"
              value={newItemData.barcode}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Поставщик *</label>
            <select
              name="client"
              className="add-modal__input"
              value={newItemData.client}
              onChange={handleChange}
              required
            >
              <option value="">-- Выберите поставщика --</option>
              {filterClient.map((client, idx) => (
                <option key={client.id ?? idx} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>

            <button
              className="create-client"
              onClick={() => setShowInputs(!showInputs)}
            >
              {showInputs ? "Отменить" : "Создать поставщика"}
            </button>
            {showInputs && (
              <form
                style={{
                  display: "flex",
                  flexDirection: "column",
                  rowGap: "10px",
                }}
                onSubmit={onSubmit}
              >
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  placeholder="ФИО"
                  name="full_name"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="llc"
                  placeholder="ОсОО"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="inn"
                  placeholder="ИНН"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="okpo"
                  placeholder="ОКПО"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="score"
                  placeholder="Р/СЧЁТ"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="bik"
                  placeholder="БИК"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="address"
                  placeholder="Адрес"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="text"
                  name="phone"
                  placeholder="Телефон"
                />
                <input
                  className="add-modal__input"
                  onChange={onChange}
                  type="email"
                  name="email"
                  placeholder="Почта"
                />
                <div style={{ display: "flex", columnGap: "10px" }}>
                  <button
                    className="create-client"
                    type="button"
                    onClick={() => setShowInputs(false)}
                  >
                    Отмена
                  </button>
                  <button className="create-client">Создать</button>
                </div>
              </form>
            )}
          </div>

          <div className="add-modal__section">
            <label>Розничная цена *</label>
            <input
              type="number"
              name="price"
              placeholder="999.99"
              className="add-modal__input"
              value={newItemData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Закупочная цена *</label>
            <input
              type="number"
              name="purchase_price"
              placeholder="999.99"
              className="add-modal__input"
              value={newItemData.purchase_price}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="add-modal__section">
            <label>Количество *</label>
            <input
              type="number"
              name="quantity"
              placeholder="100"
              className="add-modal__input"
              value={newItemData.quantity}
              onChange={handleChange}
              min="0"
              required
            />
          </div>

          <div className="add-modal__footer">
            <button
              className="add-modal__cancel"
              onClick={onClose}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              className="add-modal__save"
              onClick={handleSubmit}
              disabled={creating}
            >
              {creating ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </>
      ),
      option: "manually",
    },
  ];

  const handleTabClick = (index) => {
    setActiveTab(index);
    setIsTabSelected(true);
  };
  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  useEffect(() => {
    if (barcodeError) {
      setActiveTab(1);
      setIsTabSelected(true);
    }
  }, [barcodeError]);

  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      cashbox: selectCashBox,
      name: newItemData.name,
      amount: newItemData.price,
    }));
  }, [newItemData, selectCashBox]);

  return (
    <div className="add-modal wareSklad">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {createError && (
          <p className="add-modal__error-message">
            Ошибка добавления:{" "}
            {createError.message || JSON.stringify(createError)}
          </p>
        )}
        {company?.sector?.name === "Магазин" ||
        company?.subscription_plan?.name === "Старт" ? (
          <>
            {tabs.map((tab, index) => (
              <button
                key={index}
                className={`add-modal__button ${
                  activeTab === index && isTabSelected
                    ? "add-modal__button-active"
                    : ""
                }`}
                onClick={() => handleTabClick(index)}
              >
                {tab.label}
              </button>
            ))}

            {isTabSelected && activeTab !== null && (
              <div className="vitrina__content">{tabs[activeTab].content}</div>
            )}
          </>
        ) : (
          <>{tabs[1].content}</>
        )}
      </div>
    </div>
  );
};

const SellModal = ({ onClose }) => {
  const { creating, createError, barcodeError } = useProducts();
  const [activeTab, setActiveTab] = useState(0);
  const [isTabSelected, setIsTabSelected] = useState(true);

  const tabs = [
    {
      label: "Сканировать",
      content: (
        <div className="scan" onClick={() => setActiveTab(null)}>
          <div className="scan__content">
            <img src={barcodeImage} alt="" />
          </div>
        </div>
      ),
      option: "scan",
    },
    {
      label: "Вручную",
      content: (
        <>
          <form>
            <input
              type="text"
              placeholder="штрих код"
              className="add-modal__input"
            />
          </form>
        </>
      ),
      option: "manually",
    },
  ];
  const products = [
    { id: 1, name: "Товар1", amount: 2, price: 75 },
    { id: 2, name: "Товар2", amount: 2, price: 75 },
    { id: 3, name: "Товар3", amount: 2, price: 75 },
  ];

  const handleTabClick = (index) => {
    setActiveTab(index);
    setIsTabSelected(true);
  };
  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {tabs.map((tab, index) => {
          return (
            <button
              key={index}
              className={`add-modal__button  ${
                activeTab === index && isTabSelected
                  ? "add-modal__button-active"
                  : ""
              }`}
              onClick={() => handleTabClick(index)}
            >
              {tab.label}
            </button>
          );
        })}
        {isTabSelected && activeTab !== null && (
          <div className="add-modal__container">{tabs[activeTab].content}</div>
        )}

        {products.length !== 0 && (
          <div className="receipt">
            <h2 className="receipt__title">Приход</h2>
            {products.map((product) => (
              <div className="receipt__item" key={product.id}>
                <p className="receipt__item-name">
                  {product.id}. {product.name}
                </p>
                <p className="receipt__item-price">
                  {product.amount} x {product.price} ≡{" "}
                  {product.amount * product.price}
                </p>
              </div>
            ))}
            <div className="receipt__total">
              <b>ИТОГО</b>
              <b>
                ≡{" "}
                {products
                  .reduce((acc, rec) => {
                    return acc + rec.amount * rec.price;
                  }, 0)
                  .toFixed(2)}
              </b>
            </div>
            <div className="receipt__row">
              <button className="receipt__row-btn">Печать чека</button>
              <button className="receipt__row-btn">Без чека</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================== ГЛАВНЫЙ СКЛАД ============================== */

export default function BarberSklad() {
  const dispatch = useDispatch();

  const {
    list: products,
    loading,
    error,
    count,
    next,
    previous,
    creating,
    updating,
    deleting,
  } = useSelector((state) => state.product);
  const { list: cashBoxes } = useCash();
  const { company } = useUser();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectCashBox, setSelectCashBox] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [itemId, setItemId] = useState({});

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState({});

  const [barcode, setBarcode] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectValue, setSelectValue] = useState("all");
  const [activeTab, setActiveTab] = useState(0);
  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";

  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  // выбор строк
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const params = {
      page: currentPage,
      search: searchTerm,
      ...currentFilters,
    };
    dispatch(fetchProductsAsync(params));

    return () => {
      dispatch(clearProducts());
    };
  }, [
    dispatch,
    currentPage,
    searchTerm,
    creating,
    updating,
    deleting,
    currentFilters,
  ]);

  const handleEdit = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleSaveSuccess = () => {
    setShowEditModal(false);
    setShowAddModal(false);
    alert("Операция с товаром успешно завершена!");
    dispatch(
      fetchProductsAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleDeleteConfirm = () => {
    setShowEditModal(false);
    if (selectedItem?.id) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedItem.id);
        return next;
      });
    }
    alert("Товар успешно удален!");
    dispatch(
      fetchProductsAsync({
        page: currentPage,
        search: searchTerm,
        ...currentFilters,
      })
    );
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleResetAllFilters = () => {
    setSearchTerm("");
    setCurrentFilters({});
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (next) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (previous) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    setCurrentPage(1);
  };

  const handleOpen = (id) => {
    setShowMarriageModal(true);
    setItemId(id);
  };

  const isFiltered = searchTerm || Object.keys(currentFilters).length > 0;

  const totalPages =
    count && products.length > 0 ? Math.ceil(count / products.length) : 1;

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        setShowAddModal(false);
        setShowSellModal(false);
        setShowEditModal(false);
        setShowFilterModal(false);
        setShowReceiveModal(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  const filterProducts = products.filter((item) => item.status === "accepted");
  const filteredHistory = products.filter((item) => item.status === "history");
  const filterP =
    company.sector?.name === "Строительная компания"
      ? filterProducts
      : products;

  const isSelected = (id) => selectedIds.has(id);
  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAllOnPage = (items) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected =
        items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => {
        if (allSelected) next.delete(i.id);
        else next.add(i.id);
      });
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Удалить выбранные ${selectedIds.size} товар(ов)? Это действие нельзя отменить.`
      )
    ) {
      return;
    }

    try {
      setBulkDeleting(true);
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/products/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            soft: true,
            require_all: false,
          }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      clearSelection();
      alert("Выбранные товары удалены");
      dispatch(
        fetchProductsAsync({
          page: currentPage,
          search: searchTerm,
          ...currentFilters,
        })
      );
    } catch (e) {
      alert("Не удалось удалить товары: " + e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const SelectionActions = ({ pageItems }) => {
    const allOnPageChecked =
      pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={allOnPageChecked}
            onChange={() => toggleSelectAllOnPage(pageItems)}
          />
          <span>Все на странице</span>
        </label>

        {selectedIds.size > 0 && (
          <>
            <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span>
            <button
              className="sklad__add"
              style={{ background: "#e53935" }}
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              title="Массовое удаление выбранных товаров"
            >
              {bulkDeleting ? "Удаляем..." : "Удалить выбранные"}
            </button>
            <button
              className="sklad__reset"
              onClick={clearSelection}
              style={{ cursor: "pointer" }}
              title="Снять весь выбор"
            >
              Сбросить выбор
            </button>
          </>
        )}
      </div>
    );
  };

  const tabs = [
    {
      label: "Склад",
      content: (
        <>
          <div className="sklad__header">
            <div className="sklad__left">
              <input
                type="text"
                placeholder="Поиск по названию товара"
                className="sklad__search"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <div className="sklad__center">
                <span>Всего: {count !== null ? count : "-"}</span>
                <span>Найдено: {products.length}</span>
                {isFiltered && (
                  <span
                    className="sklad__reset"
                    onClick={handleResetAllFilters}
                    style={{ cursor: "pointer" }}
                  >
                    Сбросить
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              {company.sector?.name === "Строительная компания" ? (
                <>
                  <button
                    className="sklad__add"
                    onClick={() => setShowReceiveModal(true)}
                  >
                    <Plus size={16} style={{ marginRight: "4px" }} /> Принять
                    товар
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="sklad__add"
                  >
                    <Minus size={16} style={{ marginRight: "4px" }} /> Отправить
                    товар
                  </button>
                </>
              ) : (
                <>
                  <select
                    value={selectCashBox}
                    onChange={(e) => setSelectCashBox(e.target.value)}
                    className="employee__search-wrapper"
                  >
                    <option value="" disabled>
                      Выберите кассу
                    </option>
                    {cashBoxes?.map((cash) => (
                      <option key={cash.id} value={cash.id}>
                        {cash.name ?? cash.department_name}
                      </option>
                    ))}
                  </select>

                  <button
                    className="sklad__add"
                    onClick={handleAdd}
                    disabled={!selectCashBox}
                    title={
                      !selectCashBox ? "Сначала выберите кассу" : undefined
                    }
                  >
                    <Plus size={16} style={{ marginRight: "4px" }} /> Добавить
                    товар
                  </button>
                </>
              )}
            </div>
          </div>

          {filterP.length !== 0 && <SelectionActions pageItems={filterP} />}

          {loading ? (
            <p className="sklad__loading-message">Загрузка товаров...</p>
          ) : error ? (
            <p className="sklad__error-message">Ошибка загрузки:</p>
          ) : filterP.length === 0 ? (
            <p className="sklad__no-products-message">Нет доступных товаров.</p>
          ) : (
            <div className="table-wrapper">
              <table className="sklad__table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          filterP.length > 0 &&
                          filterP.every((i) => selectedIds.has(i.id))
                        }
                        onChange={() => toggleSelectAllOnPage(filterP)}
                      />
                    </th>
                    <th></th>
                    <th>№</th>
                    <th>Название</th>
                    <th>Поставщик</th>
                    <th>Цена</th>
                    <th>Количество</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filterP.map((item, index) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected(item.id)}
                          onChange={() => toggleRow(item.id)}
                        />
                      </td>
                      <td>
                        <MoreVertical
                          size={16}
                          onClick={() => handleEdit(item)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{item.client_name ? item.client_name : "-"}</td>
                      <td>{item.price}</td>
                      <td>
                        {item.quantity === 0 ? (
                          <span className="sell__badge--danger">
                            Нет в наличии
                          </span>
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td>
                        <button
                          className="btn edit-btn"
                          onClick={() => handleOpen(item)}
                        >
                          В брак
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sklad__pagination">
            <span>
              {currentPage} из {totalPages}
            </span>
            <button
              onClick={handlePreviousPage}
              disabled={
                !previous || loading || creating || updating || deleting
              }
            >
              ←
            </button>
            <button
              onClick={handleNextPage}
              disabled={!next || loading || creating || updating || deleting}
            >
              →
            </button>
          </div>
        </>
      ),
      option: "scan",
    },
    {
      label: "История",
      content: (
        <>
          <div className="sklad__header">
            <div className="sklad__left">
              <input
                type="text"
                placeholder="Поиск по названию товара"
                className="sklad__search"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <div className="sklad__center">
                <span>Всего: {count !== null ? count : "-"}</span>
                <span>Найдено: {products.length}</span>
                {isFiltered && (
                  <span
                    className="sklad__reset"
                    onClick={handleResetAllFilters}
                    style={{ cursor: "pointer" }}
                  >
                    Сбросить
                  </span>
                )}
              </div>
            </div>
          </div>

          {filteredHistory.length !== 0 && (
            <SelectionActions pageItems={products} />
          )}

          {loading ? (
            <p className="sklad__loading-message">Загрузка товаров...</p>
          ) : error ? (
            <p className="sklad__error-message">Ошибка загрузки</p>
          ) : filteredHistory.length === 0 ? (
            <p className="sklad__no-products-message">Нет доступных товаров.</p>
          ) : (
            <div className="table-wrapper">
              <table className="sklad__table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          filteredHistory.length > 0 &&
                          filteredHistory.every((i) => selectedIds.has(i.id))
                        }
                        onChange={() => toggleSelectAllOnPage(filteredHistory)}
                      />
                    </th>
                    <th></th>
                    <th>№</th>
                    <th>Название</th>
                    <th>Поставщик</th>
                    <th>Цена</th>
                    <th>Количество</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, index) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected(item.id)}
                          onChange={() => toggleRow(item.id)}
                        />
                      </td>
                      <td>
                        <MoreVertical
                          size={16}
                          onClick={() => handleEdit(item)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{item.client_name ? item.client_name : "-"}</td>
                      <td>{item.price}</td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sklad__pagination">
            <span>
              {currentPage} из {totalPages}
            </span>
            <button
              onClick={handlePreviousPage}
              disabled={
                !previous || loading || creating || updating || deleting
              }
            >
              ←
            </button>
            <button
              onClick={handleNextPage}
              disabled={!next || loading || creating || updating || deleting}
            >
              →
            </button>
          </div>
        </>
      ),
      option: "manually",
    },
  ];

  return (
    <div className="sklad">
      {isStartPlan ? (
        <>{tabs[0].content}</>
      ) : isBuildingCompany ? (
        <>
          <div className="vitrina__header" style={{ margin: "15px 0" }}>
            <div className="vitrina__tabs">
              {tabs.map((tab, index) => {
                return (
                  <span
                    key={index}
                    className={`vitrina__tab ${
                      index === activeTab && "vitrina__tab--active"
                    }`}
                    onClick={() => setActiveTab(index)}
                  >
                    {tab.label}
                  </span>
                );
              })}
            </div>
          </div>
          {tabs[activeTab].content}
        </>
      ) : (
        <>{tabs[0].content}</>
      )}

      {showEditModal && selectedItem && (
        <EditModal
          item={selectedItem}
          onClose={() => setShowEditModal(false)}
          onSaveSuccess={handleSaveSuccess}
          onDeleteConfirm={handleDeleteConfirm}
        />
      )}

      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={currentFilters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetAllFilters}
        />
      )}

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onSaveSuccess={handleSaveSuccess}
          cashBoxes={cashBoxes}
          selectCashBox={selectCashBox}
        />
      )}
      {showSellModal && <SellModal onClose={() => setShowSellModal(false)} />}

      {showReceiveModal && (
        <AcceptPendingModal
          onClose={() => setShowReceiveModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            )
          }
        />
      )}
      {showHistoryModal && (
        <AcceptHistoryModal
          onClose={() => setShowHistoryModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            )
          }
        />
      )}
      {showMarriageModal && (
        <MarriageModal
          onClose={() => setShowMarriageModal(false)}
          onChanged={() =>
            dispatch(
              fetchProductsAsync({
                page: currentPage,
                search: searchTerm,
                ...currentFilters,
              })
            )
          }
          item={itemId}
        />
      )}
    </div>
  );
}
