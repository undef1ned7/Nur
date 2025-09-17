// import React, { useEffect, useMemo, useState } from "react";
// import api from "../../../../api";
// import "./Clients.scss";
// import { FaPlus, FaEdit, FaTimes, FaSearch, FaTrash } from "react-icons/fa";

// /* ===== Статусы ===== */
// const UI_TO_API_STATUS = { Активен: "active", Неактивен: "inactive", VIP: "vip", "В черном списке": "blacklist" };
// const API_TO_UI_STATUS = { active: "Активен", inactive: "Неактивен", vip: "VIP", blacklist: "В черном списке" };
// const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

// /* ===== Утилиты ===== */
// const pad = (n) => String(n).padStart(2, "0");
// const dateISO = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
// const timeISO = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// const getInitials = (fullName = "") => fullName.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||"").join("");
// const listFrom = (res) => res?.data?.results || res?.data || [];
// const todayStr = () => new Date().toISOString().slice(0,10);

// const normalizePhone = (p) => (p || "").replace(/[^\d]/g, "");
// const isValidPhone = (p) => normalizePhone(p).length >= 10;

// const normalizeName = (s) => String(s||"").trim().replace(/\s+/g," ").toLowerCase();

// /* ================================================================================== */

// const Clients = () => {
//   const [activeTab, setActiveTab] = useState("clients");

//   /* ===== Клиенты ===== */
//   const [clients, setClients] = useState([]);
//   const [appointments, setAppointments] = useState([]);
//   const [services, setServices] = useState([]);
//   const [search, setSearch] = useState("");
//   const [modalOpen, setModalOpen] = useState(false);
//   const [currentClient, setCurrentClient] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [deleting, setDeleting] = useState(false);

//   // верхний алерт внутри модалки клиента
//   const [clientAlerts, setClientAlerts] = useState([]); // массив строк
//   // подсветка полей рамкой (без текстов под полями)
//   const [formErrors, setFormErrors] = useState({});     // {fullName, phone, birthDate, status}

//   // ошибки экрана (вне модалок)
//   const [pageError, setPageError] = useState("");

//   /* ===== История ===== */
//   const [historyOpen, setHistoryOpen] = useState(false);
//   const [historyClient, setHistoryClient] = useState(null);

//   /* ===== Fetch ===== */
//   const fetchClients = async () => {
//     const { data } = await api.get("/barbershop/clients/");
//     const normalized = (data.results || []).map((c) => ({
//       id: c.id,
//       fullName: c.full_name || "",
//       phone: c.phone || "",
//       birthDate: c.birth_date || "",
//       status: API_TO_UI_STATUS[String(c.status || "").toLowerCase()] || "Активен",
//       notes: c.notes || "",
//     }));
//     setClients(normalized);
//   };

//   const fetchAllAppointments = async () => {
//     const acc = []; let next = "/barbershop/appointments/";
//     while (next) { const { data } = await api.get(next); acc.push(...(data.results || [])); next = data.next; }
//     setAppointments(acc);
//   };

//   const fetchAllServices = async () => {
//     const acc = []; let next = "/barbershop/services/";
//     while (next) { const { data } = await api.get(next); acc.push(...(data.results || [])); next = data.next; }
//     setServices(acc);
//   };

//   useEffect(() => {
//     (async () => {
//       try { setLoading(true); setPageError(""); await Promise.all([fetchClients(), fetchAllAppointments(), fetchAllServices()]); }
//       catch { setPageError("Не удалось загрузить данные"); }
//       finally { setLoading(false); }
//     })();
//   }, []);

//   /* ===== Карты ===== */
//   const apptsByClient = useMemo(() => {
//     const map = new Map();
//     appointments.forEach((a) => { if (!a.client) return; const arr = map.get(a.client) || []; arr.push(a); map.set(a.client, arr); });
//     return map;
//   }, [appointments]);

//   const servicesById = useMemo(() => {
//     const map = new Map(); services.forEach((s)=>map.set(s.id,s)); return map;
//   }, [services]);

//   /* ===== Фильтр ===== */
//   const filteredClients = useMemo(() => {
//     const q = search.trim().toLowerCase(); if (!q) return clients;
//     return clients.filter((c) => (c.fullName || "").toLowerCase().includes(q));
//   }, [clients, search]);

//   /* ===== CRUD: клиенты ===== */
//   const openModal = (client = null) => { setCurrentClient(client); setFormErrors({}); setClientAlerts([]); setModalOpen(true); };
//   const closeModal = () => { if (!saving && !deleting) { setModalOpen(false); setCurrentClient(null); setFormErrors({}); setClientAlerts([]); } };

//   const validateClient = (form) => {
//     const errs = {}; const alerts = [];
//     const nameNorm = normalizeName(form.fullName);
//     const phoneNorm = normalizePhone(form.phone);

//     if (!nameNorm) { errs.fullName = true; alerts.push("Укажите ФИО"); }
//     else {
//       const existsName = clients.some(
//         (c) => normalizeName(c.fullName) === nameNorm && (!currentClient?.id || c.id !== currentClient.id)
//       );
//       if (existsName) { errs.fullName = true; alerts.push("Клиент с таким ФИО уже существует"); }
//     }

//     if (!form.phone) { errs.phone = true; alerts.push("Укажите телефон"); }
//     else if (!isValidPhone(form.phone)) { errs.phone = true; alerts.push("Телефон: минимум 10 цифр"); }
//     else {
//       const existsPhone = clients.some(
//         (c) => normalizePhone(c.phone) === phoneNorm && (!currentClient?.id || c.id !== currentClient.id)
//       );
//       if (existsPhone) { errs.phone = true; alerts.push("Такой телефон уже существует"); }
//     }

//     if (form.birthDate) {
//       const d = new Date(form.birthDate); const now = new Date(todayStr());
//       if (Number.isNaN(d.getTime())) { errs.birthDate = true; alerts.push("Дата рождения некорректна"); }
//       else if (d > now) { errs.birthDate = true; alerts.push("Дата рождения в будущем недопустима"); }
//       else if (d.getFullYear() < 1900) { errs.birthDate = true; alerts.push("Слишком старая дата рождения"); }
//     }

//     if (!STATUS_OPTIONS_UI.includes(form.status)) { errs.status = true; alerts.push("Выберите статус из списка"); }

//     return { errs, alerts };
//   };

//   const focusFirstError = (errs) => {
//     const order = ["fullName", "phone", "birthDate", "status"];
//     const firstKey = order.find((k) => errs[k]);
//     if (firstKey) { const el = document.getElementById(firstKey); if (el?.focus) el.focus(); }
//   };

//   const saveClient = async (form) => {
//     setSaving(true);
//     try {
//       const payload = {
//         full_name: form.fullName,
//         phone: form.phone,
//         birth_date: form.birthDate || null,
//         status: UI_TO_API_STATUS[form.status] || "active",
//         notes: form.notes || null,
//         company: localStorage.getItem("company"),
//       };
//       if (currentClient?.id) await api.patch(`/barbershop/clients/${currentClient.id}/`, payload);
//       else await api.post("/barbershop/clients/", payload);

//       await fetchClients();
//       setModalOpen(false); setCurrentClient(null); setFormErrors({}); setClientAlerts([]);
//     } catch (e) {
//       const data = e?.response?.data; const alerts = [];
//       if (typeof data === "string") alerts.push(data);
//       else if (data && typeof data === "object") Object.values(data).forEach((v)=>alerts.push(String(Array.isArray(v)?v[0]:v)));
//       if (!alerts.length) alerts.push("Не удалось сохранить клиента");
//       setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
//     } finally { setSaving(false); }
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     const fd = new FormData(e.currentTarget);
//     const form = {
//       fullName: fd.get("fullName")?.toString().trim() || "",
//       phone: fd.get("phone")?.toString().trim() || "",
//       birthDate: fd.get("birthDate")?.toString().trim() || "",
//       status: fd.get("status")?.toString().trim() || "Активен",
//       notes: fd.get("notes")?.toString() || "",
//     };
//     const { errs, alerts } = validateClient(form);
//     if (alerts.length) { setFormErrors(errs); setClientAlerts(["Исправьте ошибки в форме", ...alerts]); focusFirstError(errs); return; }
//     setFormErrors({}); setClientAlerts([]); saveClient(form);
//   };

//   const deleteClient = async () => {
//     if (!currentClient?.id) return;
//     if (!window.confirm(`Удалить ${currentClient.fullName || "клиента"}? Действие необратимо.`)) return;
//     setDeleting(true);
//     try { await api.delete(`/barbershop/clients/${currentClient.id}/`); await fetchClients(); setModalOpen(false); }
//     finally { setDeleting(false); }
//   };

//   /* ===== История клиента ===== */
//   const openHistory = (client) => { setHistoryClient(client); setHistoryOpen(true); };
//   const closeHistory = () => { setHistoryOpen(false); setHistoryClient(null); };
//   const historyList = useMemo(() => {
//     if (!historyClient?.id) return [];
//     const list = (apptsByClient.get(historyClient.id) || []).slice();
//     return list.sort((a,b)=>new Date(b.start_at)-new Date(a.start_at));
//   }, [historyClient, apptsByClient]);

//   const fmtMoney = (v) => (v===null||v===undefined||v==="")?"—":`${Number(v).toLocaleString("ru-RU")} сом`;

//   /* ===== Поставщики (как было) ===== */
//   const [suppliers, setSuppliers] = useState([]);
//   const [supLoading, setSupLoading] = useState(false);
//   const [supError, setSupError] = useState("");
//   const [supSearch, setSupSearch] = useState("");
//   const [supDate, setSupDate] = useState(todayStr());

//   const [supAddOpen, setSupAddOpen] = useState(false);
//   const [supAddFullName, setSupAddFullName] = useState("");
//   const [supAddPhone, setSupAddPhone] = useState("");
//   const [supAddEmail, setSupAddEmail] = useState("");
//   const [supAddDate, setSupAddDate] = useState(todayStr());
//   const [supAddSaving, setSupAddSaving] = useState(false);
//   const [supAddErr, setSupAddErr] = useState("");
//   const [supAddErrors, setSupAddErrors] = useState({});

//   const [supEditOpen, setSupEditOpen] = useState(false);
//   const [supEditErr, setSupEditErr] = useState("");
//   const [supEditSaving, setSupEditSaving] = useState(false);
//   const [supDeleting, setSupDeleting] = useState(false);
//   const [supCurrent, setSupCurrent] = useState(null);
//   const [supEditFullName, setSupEditFullName] = useState("");
//   const [supEditPhone, setSupEditPhone] = useState("");
//   const [supEditEmail, setSupEditEmail] = useState("");
//   const [supEditDate, setSupEditDate] = useState(todayStr());
//   const [supEditErrors, setSupEditErrors] = useState({});

//   const canSaveSupAdd = String(supAddFullName).trim() && String(supAddPhone).trim() && !supAddSaving;
//   const canSaveSupEdit = String(supEditFullName).trim() && String(supEditPhone).trim() && !supEditSaving;

//   const resetSupAddForm = () => { setSupAddFullName(""); setSupAddPhone(""); setSupAddEmail(""); setSupAddDate(todayStr()); setSupAddErr(""); setSupAddErrors({}); };

//   const tabKeyFromType = (t) => { const v = String(t||"").toLowerCase(); if (v==="client") return "clients"; if (v==="suppliers") return "suppliers"; if (v==="implementers") return "resellers"; return null; };
//   const typeLabel = (t) => { const v = String(t||"").toLowerCase(); if (v==="client") return "Клиент"; if (v==="suppliers") return "Поставщик"; if (v==="implementers") return "Реализатор"; return "—"; };

//   const isInvalidChoiceError = (e) => {
//     const raw = e?.response?.data; const text = typeof raw==="string"?raw:raw?JSON.stringify(raw):""; const l = text.toLowerCase();
//     return l.includes("not a valid choice")||l.includes("invalid choice")||l.includes("недопустим")||l.includes("выберите корректное значение");
//   };

//   const loadSuppliers = async () => {
//     try {
//       setSupLoading(true); setSupError("");
//       try { const res = await api.get("/main/clients/", { params: { type: "suppliers" } }); setSuppliers(listFrom(res).filter(r=>tabKeyFromType(r?.type)==="suppliers"||!r?.type)); return; }
//       catch (e) { if (!isInvalidChoiceError(e)) throw e; }
//       const fallback = await api.get("/main/clients/"); const base = listFrom(fallback);
//       setSuppliers(base.filter((r)=>tabKeyFromType(r?.type)==="suppliers"));
//     } catch { setSuppliers([]); setSupError("Не удалось загрузить поставщиков"); }
//     finally { setSupLoading(false); }
//   };
//   useEffect(()=>{ if (activeTab==="suppliers") loadSuppliers(); },[activeTab]);

//   const filteredSuppliers = useMemo(()=>{
//     const base = Array.isArray(suppliers)?suppliers:[]; if (!supSearch) return base;
//     const s = supSearch.toLowerCase();
//     return base.filter(c=>String(c.full_name||c.fio||"").toLowerCase().includes(s)||String(c.phone||"").toLowerCase().includes(s));
//   },[suppliers,supSearch]);

//   const createSupplierApi = async ({ full_name, phone, email, date }) => {
//     try {
//       const payload = { type:"suppliers", full_name:String(full_name||"").trim(), phone:String(phone||"").trim(), ...(email?{email:String(email).trim()}:{}), ...(date?{date}:{}), };
//       const res = await api.post("/main/clients/", payload); const data = res?.data || payload; if (!data.type) data.type="suppliers"; return data;
//     } catch (e) {
//       if (!isInvalidChoiceError(e)) throw e;
//       const payload = { full_name:String(full_name||"").trim(), phone:String(phone||"").trim(), ...(email?{email:String(email).trim()}:{}), ...(date?{date}:{}), };
//       const res = await api.post("/main/clients/", payload); const data = res?.data || payload; return { ...data, type: data.type || "suppliers" };
//     }
//   };
//   const updateSupplierApi = async (id, obj) => {
//     try { await api.patch(`/main/clients/${id}/`, { type:"suppliers", full_name:obj.full_name, phone:obj.phone, ...(obj.email?{email:obj.email}:{email:null}), ...(obj.date?{date:obj.date}:{date:null}) }); }
//     catch (e) {
//       if (!isInvalidChoiceError(e)) throw e;
//       await api.patch(`/main/clients/${id}/`, { full_name:obj.full_name, phone:obj.phone, ...(obj.email?{email:obj.email}:{email:null}), ...(obj.date?{date:obj.date}:{date:null}) });
//     }
//   };
//   const deleteSupplierApi = async (id) => { await api.delete(`/main/clients/${id}/`); };

//   const validateSupplier = ({ full_name, phone, email, date }, isEdit=false, currentId=null) => {
//     const errs = {}; const name = String(full_name||"").trim(); const ph = String(phone||"").trim();
//     if (!name) errs.full_name = "Укажите ФИО";
//     if (!ph) errs.phone = "Укажите телефон"; else if (!isValidPhone(ph)) errs.phone = "Телефон должен содержать ≥10 цифр";
//     if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errs.email = "Некорректный email";
//     if (date) { const d = new Date(date); const now = new Date(todayStr()); if (Number.isNaN(d.getTime())) errs.date="Некорректная дата"; else if (d>now) errs.date="Дата в будущем недопустима"; }
//     return errs;
//   };

//   const handleSupAddSave = async () => {
//     if (!canSaveSupAdd) return;
//     const errs = validateSupplier({ full_name: supAddFullName, phone: supAddPhone, email: supAddEmail, date: supAddDate });
//     if (Object.keys(errs).length) { setSupAddErrors(errs); setSupAddErr("Исправьте ошибки в форме"); return; }
//     try {
//       setSupAddSaving(true); setSupAddErr(""); setSupAddErrors({});
//       const created = await createSupplierApi({ full_name:supAddFullName, phone:supAddPhone, email:supAddEmail, date:supAddDate });
//       setSuppliers((prev)=>[created,...(Array.isArray(prev)?prev:[])]); setSupAddOpen(false); resetSupAddForm();
//     } catch { setSupAddErr("Не удалось добавить поставщика"); }
//     finally { setSupAddSaving(false); }
//   };

//   const openSupEdit = (row) => { setSupCurrent(row||null); setSupEditFullName(row?.full_name||row?.fio||""); setSupEditPhone(row?.phone||""); setSupEditEmail(row?.email||""); setSupEditDate(row?.date||todayStr()); setSupEditErr(""); setSupEditErrors({}); setSupEditOpen(true); };

//   const handleSupEditSave = async () => {
//     if (!supCurrent?.id || !canSaveSupEdit) return;
//     const errs = validateSupplier({ full_name: supEditFullName, phone: supEditPhone, email: supEditEmail, date: supEditDate }, true, supCurrent.id);
//     if (Object.keys(errs).length) { setSupEditErrors(errs); setSupEditErr("Исправьте ошибки в форме"); return; }
//     try { setSupEditSaving(true); setSupEditErr(""); setSupEditErrors({}); await updateSupplierApi(supCurrent.id, { full_name:supEditFullName, phone:supEditPhone, email:supEditEmail, date:supEditDate }); await loadSuppliers(); setSupEditOpen(false); }
//     catch { setSupEditErr("Не удалось сохранить изменения"); }
//     finally { setSupEditSaving(false); }
//   };

//   const handleSupDelete = async (row) => {
//     if (!row?.id) return;
//     if (!window.confirm(`Удалить поставщика «${row.full_name || row.fio || "—"}»? Действие необратимо.`)) return;
//     try { setSupDeleting(true); await deleteSupplierApi(row.id); setSuppliers((prev)=> (Array.isArray(prev)?prev.filter(x=>x.id!==row.id):[])); }
//     finally { setSupDeleting(false); }
//   };

//   const supTitle = "Поставщики";

//   /* ===================== RENDER ===================== */
//   return (
//     <div className="barberclient">
//       {/* Табы */}
//       <nav className="barberclient__tabs" aria-label="Секции">
//         <button type="button" onClick={()=>setActiveTab("clients")} className={`barberclient__tab ${activeTab==="clients"?"barberclient__tab--active":""}`}>Клиенты</button>
//         <button type="button" onClick={()=>setActiveTab("suppliers")} className={`barberclient__tab ${activeTab==="suppliers"?"barberclient__tab--active":""}`}>Поставщики</button>
//       </nav>

//       {/* Header */}
//       {activeTab==="clients" ? (
//         <div className="barberclient__header">
//           <div>
//             <h2 className="barberclient__title">Клиенты</h2>
//             <span className="barberclient__subtitle">{loading ? "Загрузка..." : `${clients.length} записей`}</span>
//           </div>
//           <div className="barberclient__actions">
//             <div className="barberclient__search">
//               <FaSearch className="barberclient__search-icon" />
//               <input className="barberclient__search-input" type="text" placeholder="Поиск по ФИО" value={search} onChange={(e)=>setSearch(e.target.value)} />
//             </div>
//             <button className="barberclient__btn barberclient__btn--primary" onClick={()=>openModal()}><FaPlus /><span className="barberclient__btn-label">Добавить</span></button>
//           </div>
//         </div>
//       ) : (
//         <div className="barberclient__header">
//           <div>
//             <h2 className="barberclient__title">{supTitle}</h2>
//             <span className="barberclient__subtitle">{supLoading ? "Загрузка..." : `${filteredSuppliers.length}/${suppliers.length} шт.`}</span>
//           </div>
//           <div className="barberclient__actions">
//             <div className="barberclient__search">
//               <FaSearch className="barberclient__search-icon" />
//               <input className="barberclient__search-input" type="text" placeholder="Поиск по ФИО или телефону" value={supSearch} onChange={(e)=>setSupSearch(e.target.value)} />
//             </div>
//             <input type="date" className="barberclient__date-input" value={supDate} onChange={(e)=>setSupDate(e.target.value)} />
//             <button className="barberclient__btn barberclient__btn--secondary barberclient__btn--sm" onClick={loadSuppliers} disabled={supLoading}>Обновить</button>
//             <button className="barberclient__btn barberclient__btn--primary" onClick={()=>setSupAddOpen(true)}><FaPlus /><span className="barberclient__btn-label">Новый поставщик</span></button>
//           </div>
//         </div>
//       )}

//       {/* Ошибки экрана */}
//       {activeTab==="clients" && pageError && <div className="barberclient__alert">{pageError}</div>}
//       {activeTab==="suppliers" && supError && <div className="barberclient__alert">{supError}</div>}

//       {/* Контент */}
//       {activeTab==="clients" ? (
//         loading ? (
//           <div className="barberclient__skeleton-list">{[...Array(4)].map((_,i)=><div key={i} className="barberclient__skeleton-card" />)}</div>
//         ) : (
//           <div className="barberclient__list">
//             {filteredClients.map((client) => {
//               const appts = apptsByClient.get(client.id) || [];
//               return (
//                 <article key={client.id} className="barberclient__card">
//                   <div className="barberclient__card-left">
//                     <div className="barberclient__avatar">{getInitials(client.fullName)}</div>
//                     <div className="barberclient__info">
//                       <h4 className="barberclient__name">{client.fullName}</h4>
//                       <div className="barberclient__meta">
//                         <span className={`barberclient__badge barberclient__badge--${UI_TO_API_STATUS[client.status]||"active"}`}>{client.status}</span>
//                         <span>{client.phone || "—"}</span>
//                         <span>•</span>
//                         <span>Записей: {appts.length}</span>
//                       </div>
//                     </div>
//                   </div>
//                   <div className="barberclient__card-actions">
//                     <button className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon" onClick={()=>openHistory(client)} aria-label="История"><FaSearch /></button>
//                     <button className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon" onClick={()=>openModal(client)} aria-label="Редактировать"><FaEdit /></button>
//                   </div>
//                 </article>
//               );
//             })}
//           </div>
//         )
//       ) : (
//         <div className="barberclient__table-container">
//           <div className="barberclient__table">
//             <div className="barberclient__thead"><span>ФИО</span><span>Телефон</span><span>Тип</span><span>Дата</span><span>Действия</span></div>
//             <div className="barberclient__tbody">
//               {supLoading && <div className="barberclient__loading-row">Загрузка…</div>}
//               {!supLoading && filteredSuppliers.map((c)=>(
//                 <div className="barberclient__row" key={c.id}>
//                   <span className="barberclient__ellipsis" title={c.full_name||c.fio||"—"}>{c.full_name||c.fio||"—"}</span>
//                   <span>{c.phone || "—"}</span>
//                   <span>{typeLabel(c.type)}</span>
//                   <span>{c.date || "—"}</span>
//                   <span className="barberclient__row-actions">
//                     <button className="barberclient__btn barberclient__btn--secondary barberclient__btn--sm" onClick={()=>openSupEdit(c)} title="Редактировать"><FaEdit /><span className="barberclient__btn-label">Ред.</span></button>
//                     <button className="barberclient__btn barberclient__btn--danger barberclient__btn--sm" onClick={()=>handleSupDelete(c)} disabled={supDeleting} title="Удалить"><FaTrash /><span className="barberclient__btn-label">{supDeleting?"…":"Удалить"}</span></button>
//                   </span>
//                 </div>
//               ))}
//               {!supLoading && filteredSuppliers.length===0 && <div className="barberclient__empty">Ничего не найдено</div>}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Модалка клиента */}
//       {modalOpen && (
//         <div className="barberclient__modalOverlay" onClick={closeModal}>
//           <div className="barberclient__modal" onClick={(e)=>e.stopPropagation()}>
//             <div className="barberclient__modalHeader">
//               <h3 className="barberclient__modalTitle">{currentClient ? "Редактировать клиента" : "Новый клиент"}</h3>
//               <button className="barberclient__iconBtn" onClick={closeModal} aria-label="Закрыть"><FaTimes /></button>
//             </div>

//             {/* Красный алерт только сверху */}
//             {clientAlerts.length>0 && (
//               <div className="barberclient__alert">
//                 {clientAlerts.length===1 ? clientAlerts[0] : (
//                   <ul className="barberclient__alert-list">{clientAlerts.map((m,i)=><li key={i}>{m}</li>)}</ul>
//                 )}
//             </div>
//             )}

//             <form className="barberclient__form" onSubmit={handleSubmit} noValidate>
//               <div className="barberclient__formGrid">
//                 <div className={`barberclient__field ${formErrors.fullName?"barberclient__field--invalid":""}`}>
//                   <label htmlFor="fullName" className="barberclient__label">ФИО <span className="barberclient__req">*</span></label>
//                   <input id="fullName" name="fullName" className={`barberclient__input ${formErrors.fullName?"barberclient__input--invalid":""}`} defaultValue={currentClient?.fullName||""} placeholder="Фамилия Имя Отчество" />
//                 </div>

//                 <div className={`barberclient__field ${formErrors.phone?"barberclient__field--invalid":""}`}>
//                   <label htmlFor="phone" className="barberclient__label">Телефон <span className="barberclient__req">*</span></label>
//                   <input id="phone" name="phone" className={`barberclient__input ${formErrors.phone?"barberclient__input--invalid":""}`} defaultValue={currentClient?.phone||""} placeholder="+996 ..." inputMode="tel" />
//                 </div>

//                 <div className={`barberclient__field ${formErrors.birthDate?"barberclient__field--invalid":""}`}>
//                   <label htmlFor="birthDate" className="barberclient__label">Дата рождения</label>
//                   <input id="birthDate" name="birthDate" className={`barberclient__input ${formErrors.birthDate?"barberclient__input--invalid":""}`} defaultValue={currentClient?.birthDate||""} type="date" />
//                 </div>

//                 <div className={`barberclient__field ${formErrors.status?"barberclient__field--invalid":""}`}>
//                   <label htmlFor="status" className="barberclient__label">Статус</label>
//                   <select id="status" name="status" className={`barberclient__input ${formErrors.status?"barberclient__input--invalid":""}`} defaultValue={currentClient?.status||"Активен"}>
//                     {STATUS_OPTIONS_UI.map((s)=><option key={s} value={s}>{s}</option>)}
//                   </select>
//                 </div>

//                 <div className="barberclient__field barberclient__field--full">
//                   <label htmlFor="notes" className="barberclient__label">Заметки</label>
//                   <textarea id="notes" name="notes" className="barberclient__textarea" defaultValue={currentClient?.notes||""} placeholder="Комментарий, пожелания..." />
//                 </div>
//               </div>

//               <div className="barberclient__formActions">
//                 {currentClient?.id ? (
//                   <button type="button" className="barberclient__btn barberclient__btn--danger" onClick={deleteClient} disabled={saving||deleting} title="Удалить клиента">
//                     <FaTrash /><span className="barberclient__btn-label">{deleting?"Удаление...":"Удалить"}</span>
//                   </button>
//                 ) : (<span className="barberclient__actionsSpacer" />)}

//                 <div className="barberclient__actionsRight">
//                   <button type="button" className="barberclient__btn barberclient__btn--secondary" onClick={closeModal} disabled={saving||deleting}>Отмена</button>
//                   <button type="submit" disabled={saving||deleting} className="barberclient__btn barberclient__btn--primary">{saving?"Сохранение...":"Сохранить"}</button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* История клиента */}
//       {historyOpen && (
//         <div className="barberclient__modalOverlay" onClick={closeHistory}>
//           <div className="barberclient__modal" onClick={(e)=>e.stopPropagation()}>
//             <div className="barberclient__modalHeader">
//               <h3 className="barberclient__modalTitle">История — {historyClient?.fullName}</h3>
//               <button className="barberclient__iconBtn" onClick={closeHistory} aria-label="Закрыть"><FaTimes /></button>
//             </div>

//             <div className="barberclient__form" style={{marginTop:0}}>
//               {historyList.length===0 ? (
//                 <div className="barberclient__meta">Записей нет</div>
//               ) : (
//                 <div className="barberclient__history">
//                   {historyList.map((a)=> {
//                     const date = dateISO(a.start_at); const time = timeISO(a.start_at);
//                     const barber = a.barber_name || (a.barber ? `ID ${a.barber}` : "—");
//                     const svcObj = servicesById.get(a.service);
//                     const service = a.service_name || svcObj?.service_name || svcObj?.name || "—";
//                     const priceVal = a.service_price ?? a.price ?? svcObj?.price;
//                     return (
//                       <div key={a.id} className="barberclient__history-card">
//                         <div className="barberclient__history-top">
//                           <span className="barberclient__badge">{date} • {time}</span>
//                         </div>
//                         <div className="barberclient__meta" style={{gap:12}}>
//                           <span>Мастер: {barber}</span><span>•</span>
//                           <span>Услуга: {service}</span><span>•</span>
//                           <span>Цена: {fmtMoney(priceVal)}</span>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//               <div className="barberclient__formActions">
//                 <button type="button" className="barberclient__btn barberclient__btn--secondary" onClick={closeHistory}>Закрыть</button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Поставщики: добавление */}
//       {supAddOpen && (
//         <div className="barberclient__modalOverlay" onClick={()=>setSupAddOpen(false)}>
//           <div className="barberclient__modal" onClick={(e)=>e.stopPropagation()}>
//             <div className="barberclient__modalHeader">
//               <h3 className="barberclient__modalTitle">Новый поставщик</h3>
//               <button className="barberclient__iconBtn" onClick={()=>setSupAddOpen(false)} aria-label="Закрыть"><FaTimes /></button>
//             </div>

//             {supAddErr && <div className="barberclient__alert">{supAddErr}</div>}

//             <div className="barberclient__form">
//               <div className="barberclient__formGrid">
//                 <div className={`barberclient__field ${supAddErrors.full_name?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">ФИО <span className="barberclient__req">*</span></label>
//                   <input type="text" className={`barberclient__input ${supAddErrors.full_name?"barberclient__input--invalid":""}`} value={supAddFullName} onChange={(e)=>setSupAddFullName(e.target.value)} placeholder="Иванов Иван" autoFocus />
//                 </div>
//                 <div className={`barberclient__field ${supAddErrors.phone?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">Телефон <span className="barberclient__req">*</span></label>
//                   <input type="text" className={`barberclient__input ${supAddErrors.phone?"barberclient__input--invalid":""}`} value={supAddPhone} onChange={(e)=>setSupAddPhone(e.target.value)} placeholder="+996 700 00-00-00" />
//                 </div>
//                 <div className={`barberclient__field ${supAddErrors.email?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">Email</label>
//                   <input type="email" className={`barberclient__input ${supAddErrors.email?"barberclient__input--invalid":""}`} value={supAddEmail} onChange={(e)=>setSupAddEmail(e.target.value)} placeholder="user@mail.com" />
//                 </div>
//                 <div className={`barberclient__field ${supAddErrors.date?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">Дата</label>
//                   <input type="date" className={`barberclient__input ${supAddErrors.date?"barberclient__input--invalid":""}`} value={supAddDate} onChange={(e)=>setSupAddDate(e.target.value)} />
//                 </div>
//               </div>

//               <div className="barberclient__formActions">
//                 <span className="barberclient__actionsSpacer" />
//                 <div className="barberclient__actionsRight">
//                   <button className="barberclient__btn barberclient__btn--primary" onClick={handleSupAddSave} disabled={!canSaveSupAdd}>{supAddSaving?"Сохранение…":"Добавить"}</button>
//                   <button className="barberclient__btn barberclient__btn--secondary" onClick={()=>{ setSupAddOpen(false); resetSupAddForm(); }}>Отмена</button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Поставщики: редактирование */}
//       {supEditOpen && (
//         <div className="barberclient__modalOverlay" onClick={()=>setSupEditOpen(false)}>
//           <div className="barberclient__modal" onClick={(e)=>e.stopPropagation()}>
//             <div className="barberclient__modalHeader">
//               <h3 className="barberclient__modalTitle">Редактировать поставщика</h3>
//               <button className="barberclient__iconBtn" onClick={()=>setSupEditOpen(false)} aria-label="Закрыть"><FaTimes /></button>
//             </div>

//             {supEditErr && <div className="barberclient__alert">{supEditErr}</div>}

//             <div className="barberclient__form">
//               <div className="barberclient__formGrid">
//                 <div className={`barberclient__field ${supEditErrors.full_name?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">ФИО <span className="barberclient__req">*</span></label>
//                   <input type="text" className={`barberclient__input ${supEditErrors.full_name?"barberclient__input--invalid":""}`} value={supEditFullName} onChange={(e)=>setSupEditFullName(e.target.value)} placeholder="Иванов Иван" autoFocus />
//                 </div>
//                 <div className={`barberclient__field ${supEditErrors.phone?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">Телефон <span className="barberclient__req">*</span></label>
//                   <input type="text" className={`barberclient__input ${supEditErrors.phone?"barberclient__input--invalid":""}`} value={supEditPhone} onChange={(e)=>setSupEditPhone(e.target.value)} placeholder="+996 700 00-00-00" />
//                 </div>
//                 <div className={`barberclient__field ${supEditErrors.email?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">Email</label>
//                   <input type="email" className={`barberclient__input ${supEditErrors.email?"barberclient__input--invalid":""}`} value={supEditEmail} onChange={(e)=>setSupEditEmail(e.target.value)} placeholder="user@mail.com" />
//                 </div>
//                 <div className={`barberclient__field ${supEditErrors.date?"barberclient__field--invalid":""}`}>
//                   <label className="barberclient__label">Дата</label>
//                   <input type="date" className={`barberclient__input ${supEditErrors.date?"barberclient__input--invalid":""}`} value={supEditDate} onChange={(e)=>setSupEditDate(e.target.value)} />
//                 </div>
//               </div>

//               <div className="barberclient__formActions">
//                 <button className="barberclient__btn barberclient__btn--danger" onClick={()=>handleSupDelete(supCurrent)} disabled={supDeleting||supEditSaving} type="button"><FaTrash /><span className="barberclient__btn-label">{supDeleting?"Удаление...":"Удалить"}</span></button>
//                 <div className="barberclient__actionsRight">
//                   <button className="barberclient__btn barberclient__btn--secondary" onClick={()=>setSupEditOpen(false)} disabled={supEditSaving||supDeleting} type="button">Отмена</button>
//                   <button className="barberclient__btn barberclient__btn--primary" onClick={handleSupEditSave} disabled={!canSaveSupEdit||supDeleting} type="button">{supEditSaving?"Сохранение…":"Сохранить"}</button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Clients;



// import React, { useEffect, useMemo, useState } from "react";
// import api from "../../../../api";
// import "./Clients.scss";
// import { FaPlus, FaEdit, FaTimes, FaSearch, FaTrash } from "react-icons/fa";

// /* ===== Статусы ===== */
// const UI_TO_API_STATUS = {
//   Активен: "active",
//   Неактивен: "inactive",
//   VIP: "vip",
//   "В черном списке": "blacklist",
// };
// const API_TO_UI_STATUS = {
//   active: "Активен",
//   inactive: "Неактивен",
//   vip: "VIP",
//   blacklist: "В черном списке",
// };
// const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

// /* ===== Утилиты ===== */
// const pad = (n) => String(n).padStart(2, "0");
// const dateISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return "";
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// };
// const timeISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return "";
//   return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// };
// const listFrom = (res) => res?.data?.results || res?.data || [];
// const todayStr = () => new Date().toISOString().slice(0, 10);
// const normalizePhone = (p) => (p || "").replace(/[^\d]/g, "");
// const isValidPhone = (p) => normalizePhone(p).length >= 10;
// const normalizeName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
// const getInitials = (fullName = "") =>
//   fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");

// /* ========================================================================== */

// const Clients = () => {
//   /* ===== Клиенты / данные ===== */
//   const [clients, setClients] = useState([]);
//   const [appointments, setAppointments] = useState([]);
//   const [services, setServices] = useState([]);
//   const [search, setSearch] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [pageError, setPageError] = useState("");

//   /* ===== Модалка клиента ===== */
//   const [modalOpen, setModalOpen] = useState(false);
//   const [currentClient, setCurrentClient] = useState(null);
//   const [saving, setSaving] = useState(false);
//   const [deleting, setDeleting] = useState(false);
//   const [clientAlerts, setClientAlerts] = useState([]); // верхний красный алерт
//   const [formErrors, setFormErrors] = useState({}); // рамка у полей
//   const [confirmOpen, setConfirmOpen] = useState(false); // подтверждение удаления

//   /* ===== История ===== */
//   const [historyOpen, setHistoryOpen] = useState(false);
//   const [historyClient, setHistoryClient] = useState(null);

//   /* ===== Пагинация ===== */
//   const PAGE_SIZE = 15;
//   const [page, setPage] = useState(1);

//   /* ===== Fetch ===== */
//   const fetchClients = async () => {
//     const res = await api.get("/barbershop/clients/");
//     const data = res?.data;
//     const raw = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
//     const normalized = raw.map((c) => ({
//       id: c.id,
//       fullName: c.full_name || "",
//       phone: c.phone || "",
//       birthDate: c.birth_date || "",
//       status: API_TO_UI_STATUS[String(c.status || "").toLowerCase()] || "Активен",
//       notes: c.notes || "",
//     }));
//     setClients(normalized);
//   };

//   const fetchAllAppointments = async () => {
//     const acc = [];
//     let next = "/barbershop/appointments/";
//     while (next) {
//       const { data } = await api.get(next);
//       acc.push(...(data?.results || []));
//       next = data?.next;
//     }
//     setAppointments(acc);
//   };

//   const fetchAllServices = async () => {
//     const acc = [];
//     let next = "/barbershop/services/";
//     while (next) {
//       const { data } = await api.get(next);
//       acc.push(...(data?.results || []));
//       next = data?.next;
//     }
//     setServices(acc);
//   };

//   useEffect(() => {
//     (async () => {
//       try {
//         setLoading(true);
//         setPageError("");
//         await Promise.all([fetchClients(), fetchAllAppointments(), fetchAllServices()]);
//       } catch (e) {
//         console.error(e);
//         setPageError("Не удалось загрузить данные");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   /* ===== Карты ===== */
//   const apptsByClient = useMemo(() => {
//     const map = new Map();
//     appointments.forEach((a) => {
//       if (!a.client) return;
//       const arr = map.get(a.client) || [];
//       arr.push(a);
//       map.set(a.client, arr);
//     });
//     return map;
//   }, [appointments]);

//   const servicesById = useMemo(() => {
//     const map = new Map();
//     services.forEach((s) => map.set(s.id, s));
//     return map;
//   }, [services]);

//   /* ===== Фильтр + пагинация ===== */
//   const filteredClients = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return clients;
//     return clients.filter((c) => {
//       const name = (c.fullName || "").toLowerCase();
//       const phone = (c.phone || "").toLowerCase();
//       return name.includes(q) || phone.includes(q);
//     });
//   }, [clients, search]);

//   const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
//   const pageSafe = Math.min(Math.max(1, page), totalPages);
//   const pageSlice = useMemo(() => {
//     const from = (pageSafe - 1) * PAGE_SIZE;
//     return filteredClients.slice(from, from + PAGE_SIZE);
//   }, [filteredClients, pageSafe]);

//   useEffect(() => {
//     setPage(1);
//   }, [search, clients.length]);

//   /* ===== CRUD: клиенты ===== */
//   const openModal = (client = null) => {
//     setCurrentClient(client);
//     setFormErrors({});
//     setClientAlerts([]);
//     setModalOpen(true);
//   };

//   const closeModal = () => {
//     if (saving || deleting) return;
//     setModalOpen(false);
//     setCurrentClient(null);
//     setFormErrors({});
//     setClientAlerts([]);
//     setConfirmOpen(false);
//   };

//   const validateClient = (form) => {
//     const errs = {};
//     const alerts = [];
//     const nameNorm = normalizeName(form.fullName);
//     const phoneNorm = normalizePhone(form.phone);

//     // ФИО
//     if (!nameNorm) {
//       errs.fullName = true;
//       alerts.push("Укажите ФИО.");
//     } else {
//       const existsName = clients.some(
//         (c) => normalizeName(c.fullName) === nameNorm && (!currentClient?.id || c.id !== currentClient.id)
//       );
//       if (existsName) {
//         errs.fullName = true;
//         alerts.push("Клиент с таким ФИО уже существует.");
//       }
//     }

//     // Телефон
//     if (!form.phone) {
//       errs.phone = true;
//       alerts.push("Укажите телефон.");
//     } else if (!isValidPhone(form.phone)) {
//       errs.phone = true;
//       alerts.push("Телефон должен содержать минимум 10 цифр.");
//     } else {
//       const existsPhone = clients.some(
//         (c) => normalizePhone(c.phone) === phoneNorm && (!currentClient?.id || c.id !== currentClient.id)
//       );
//       if (existsPhone) {
//         errs.phone = true;
//         alerts.push("Клиент с таким телефоном уже существует.");
//       }
//     }

//     // Дата
//     if (form.birthDate) {
//       const d = new Date(form.birthDate);
//       const now = new Date(todayStr());
//       if (Number.isNaN(d.getTime())) {
//         errs.birthDate = true;
//         alerts.push("Дата рождения указана некорректно.");
//       } else if (d > now) {
//         errs.birthDate = true;
//         alerts.push("Дата рождения в будущем недопустима.");
//       } else if (d.getFullYear() < 1900) {
//         errs.birthDate = true;
//         alerts.push("Слишком ранняя дата рождения.");
//       }
//     }

//     // Статус
//     if (!STATUS_OPTIONS_UI.includes(form.status)) {
//       errs.status = true;
//       alerts.push("Выберите статус из списка.");
//     }

//     return { errs, alerts };
//   };

//   const focusFirstError = (errs) => {
//     const order = ["fullName", "phone", "birthDate", "status"];
//     const firstKey = order.find((k) => errs[k]);
//     if (!firstKey) return;
//     const el = document.getElementById(firstKey);
//     if (el?.focus) el.focus();
//   };

//   // Доп. шаг: создать запись и в Market (/main/clients) — молча, без UI
//   const ensureMarketClient = async (form) => {
//     try {
//       const payload = {
//         type: "client",
//         full_name: form.fullName,
//         phone: form.phone,
//         ...(form.birthDate ? { date: form.birthDate } : {}),
//       };
//       await api.post("/main/clients/", payload);
//     } catch (e) {
//       // допустимо писать только ошибки
//       console.error(e);
//     }
//   };

//   const saveClient = async (form) => {
//     setSaving(true);
//     try {
//       const payload = {
//         full_name: form.fullName,
//         phone: form.phone,
//         birth_date: form.birthDate || null,
//         status: UI_TO_API_STATUS[form.status] || "active",
//         notes: form.notes || null,
//         company: localStorage.getItem("company"),
//       };

//       if (currentClient?.id) {
//         await api.patch(`/barbershop/clients/${currentClient.id}/`, payload);
//       } else {
//         await api.post("/barbershop/clients/", payload);
//       }

//       // синхронно подтягиваем список
//       await fetchClients();

//       // пробуем продублировать запись в Market
//       await ensureMarketClient(form);

//       // закрываем модалку
//       setModalOpen(false);
//       setCurrentClient(null);
//       setFormErrors({});
//       setClientAlerts([]);
//     } catch (e) {
//       const data = e?.response?.data;
//       const alerts = [];
//       if (typeof data === "string") alerts.push(data);
//       else if (data && typeof data === "object") {
//         try {
//           Object.values(data).forEach((v) => alerts.push(String(Array.isArray(v) ? v[0] : v)));
//         } catch {
//           alerts.push("Не удалось сохранить клиента.");
//         }
//       }
//       if (!alerts.length) alerts.push("Не удалось сохранить клиента.");
//       setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
//       console.error(e);
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     const fd = new FormData(e.currentTarget);
//     const form = {
//       fullName: fd.get("fullName")?.toString().trim() || "",
//       phone: fd.get("phone")?.toString().trim() || "",
//       birthDate: fd.get("birthDate")?.toString().trim() || "",
//       status: fd.get("status")?.toString().trim() || "Активен",
//       notes: fd.get("notes")?.toString() || "",
//     };
//     const { errs, alerts } = validateClient(form);
//     if (alerts.length) {
//       setFormErrors(errs);
//       setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
//       focusFirstError(errs);
//       return;
//     }
//     setFormErrors({});
//     setClientAlerts([]);
//     saveClient(form);
//   };

//   const askDeleteClient = () => setConfirmOpen(true);

//   const confirmDeleteClient = async () => {
//     if (!currentClient?.id) return;
//     setDeleting(true);
//     try {
//       await api.delete(`/barbershop/clients/${currentClient.id}/`);
//       await fetchClients();
//       closeModal();
//     } catch (e) {
//       console.error(e);
//       setClientAlerts(["Не удалось удалить клиента."]);
//     } finally {
//       setDeleting(false);
//       setConfirmOpen(false);
//     }
//   };

//   /* ===== История клиента ===== */
//   const openHistory = (client) => {
//     setHistoryClient(client);
//     setHistoryOpen(true);
//   };
//   const closeHistory = () => {
//     setHistoryOpen(false);
//     setHistoryClient(null);
//   };
//   const historyList = useMemo(() => {
//     if (!historyClient?.id) return [];
//     const list = (apptsByClient.get(historyClient.id) || []).slice();
//     return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
//   }, [historyClient, apptsByClient]);

//   const fmtMoney = (v) =>
//     v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ru-RU")} сом`;

//   /* ===================== RENDER ===================== */
//   return (
//     <div className="barberclient">
//       <header className="barberclient__header">
//         <div>
//           <h2 className="barberclient__title">Клиенты</h2>
//           <span className="barberclient__subtitle">
//             {loading ? "Загрузка…" : `${clients.length} записей`}
//           </span>
//         </div>
//         <div className="barberclient__actions">
//           <div className="barberclient__search">
//             <FaSearch className="barberclient__search-icon" />
//             <input
//               className="barberclient__search-input"
//               type="text"
//               placeholder="Поиск по ФИО или телефону"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//           <button
//             className="barberclient__btn barberclient__btn--primary"
//             onClick={() => openModal()}
//           >
//             <FaPlus />
//             <span className="barberclient__btn-label">Добавить</span>
//           </button>
//         </div>
//       </header>

//       {pageError && <div className="barberclient__alert">{pageError}</div>}

//       {loading ? (
//         <div className="barberclient__skeleton-list">
//           {[...Array(4)].map((_, i) => (
//             <div key={i} className="barberclient__skeleton-card" />
//           ))}
//         </div>
//       ) : (
//         <>
//           <div className="barberclient__list">
//             {pageSlice.map((client) => {
//               const appts = apptsByClient.get(client.id) || [];
//               return (
//                 <article key={client.id} className="barberclient__card">
//                   <div className="barberclient__card-left">
//                     <div className="barberclient__avatar">{getInitials(client.fullName)}</div>
//                     <div className="barberclient__info">
//                       <h4 className="barberclient__name">{client.fullName}</h4>
//                       <div className="barberclient__meta">
//                         <span
//                           className={`barberclient__badge barberclient__badge--${
//                             UI_TO_API_STATUS[client.status] || "active"
//                           }`}
//                         >
//                           {client.status}
//                         </span>
//                         <span>{client.phone || "—"}</span>
//                         <span>•</span>
//                         <span>Записей: {appts.length}</span>
//                       </div>
//                     </div>
//                   </div>
//                   <div className="barberclient__card-actions">
//                     <button
//                       className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
//                       onClick={() => openHistory(client)}
//                       aria-label="История"
//                     >
//                       <FaSearch />
//                     </button>
//                     <button
//                       className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
//                       onClick={() => openModal(client)}
//                       aria-label="Редактировать"
//                     >
//                       <FaEdit />
//                     </button>
//                   </div>
//                 </article>
//               );
//             })}
//             {!pageSlice.length && (
//               <div className="barberclient__loading" style={{ textAlign: "center" }}>
//                 Ничего не найдено
//               </div>
//             )}
//           </div>

//           {/* пагинация после 15 */}
//           {filteredClients.length > PAGE_SIZE && (
//             <nav className="barberclient__pager" aria-label="Пагинация">
//               <button
//                 type="button"
//                 className="barberclient__pager-btn"
//                 disabled={pageSafe <= 1}
//                 onClick={() => setPage((p) => Math.max(1, p - 1))}
//               >
//                 Назад
//               </button>
//               <span className="barberclient__pager-info">
//                 Страница {pageSafe} из {totalPages}
//               </span>
//               <button
//                 type="button"
//                 className="barberclient__pager-btn"
//                 disabled={pageSafe >= totalPages}
//                 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//               >
//                 Вперёд
//               </button>
//             </nav>
//           )}
//         </>
//       )}

//       {/* ===== Модалка клиента ===== */}
//       {modalOpen && (
//         <div className="barberclient__modalOverlay" onClick={closeModal}>
//           <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barberclient__modalHeader">
//               <h3 className="barberclient__modalTitle">
//                 {currentClient ? "Редактировать клиента" : "Новый клиент"}
//               </h3>
//               <button
//                 className="barberclient__iconBtn"
//                 onClick={closeModal}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {clientAlerts.length > 0 && (
//               <div className="barberclient__alert">
//                 {clientAlerts.length === 1 ? (
//                   clientAlerts[0]
//                 ) : (
//                   <ul className="barberclient__alert-list">
//                     {clientAlerts.map((m, i) => (
//                       <li key={i}>{m}</li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form className="barberclient__form" onSubmit={handleSubmit} noValidate>
//               <div className="barberclient__formGrid">
//                 <div
//                   className={`barberclient__field ${
//                     formErrors.fullName ? "barberclient__field--invalid" : ""
//                   }`}
//                 >
//                   <label htmlFor="fullName" className="barberclient__label">
//                     ФИО <span className="barberclient__req">*</span>
//                   </label>
//                   <input
//                     id="fullName"
//                     name="fullName"
//                     className={`barberclient__input ${
//                       formErrors.fullName ? "barberclient__input--invalid" : ""
//                     }`}
//                     defaultValue={currentClient?.fullName || ""}
//                     placeholder="Фамилия Имя Отчество"
//                     autoFocus
//                   />
//                 </div>

//                 <div
//                   className={`barberclient__field ${
//                     formErrors.phone ? "barberclient__field--invalid" : ""
//                   }`}
//                 >
//                   <label htmlFor="phone" className="barberclient__label">
//                     Телефон <span className="barberclient__req">*</span>
//                   </label>
//                   <input
//                     id="phone"
//                     name="phone"
//                     className={`barberclient__input ${
//                       formErrors.phone ? "barberclient__input--invalid" : ""
//                     }`}
//                     defaultValue={currentClient?.phone || ""}
//                     placeholder="+996 ..."
//                     inputMode="tel"
//                   />
//                 </div>

//                 <div
//                   className={`barberclient__field ${
//                     formErrors.birthDate ? "barberclient__field--invalid" : ""
//                   }`}
//                 >
//                   <label htmlFor="birthDate" className="barberclient__label">
//                     Дата рождения
//                   </label>
//                   <input
//                     id="birthDate"
//                     name="birthDate"
//                     className={`barberclient__input ${
//                       formErrors.birthDate ? "barberclient__input--invalid" : ""
//                     }`}
//                     defaultValue={currentClient?.birthDate || ""}
//                     type="date"
//                   />
//                 </div>

//                 <div
//                   className={`barberclient__field ${
//                     formErrors.status ? "barberclient__field--invalid" : ""
//                   }`}
//                 >
//                   <label htmlFor="status" className="barberclient__label">
//                     Статус
//                   </label>
//                   <select
//                     id="status"
//                     name="status"
//                     className={`barberclient__input ${
//                       formErrors.status ? "barberclient__input--invalid" : ""
//                     }`}
//                     defaultValue={currentClient?.status || "Активен"}
//                   >
//                     {STATUS_OPTIONS_UI.map((s) => (
//                       <option key={s} value={s}>
//                         {s}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="barberclient__field barberclient__field--full">
//                   <label htmlFor="notes" className="barberclient__label">
//                     Заметки
//                   </label>
//                   <textarea
//                     id="notes"
//                     name="notes"
//                     className="barberclient__textarea"
//                     defaultValue={currentClient?.notes || ""}
//                     placeholder="Комментарий, пожелания…"
//                   />
//                 </div>
//               </div>

//               <div className="barberclient__formActions">
//                 {currentClient?.id ? (
//                   <button
//                     type="button"
//                     className="barberclient__btn barberclient__btn--danger"
//                     onClick={askDeleteClient}
//                     disabled={saving || deleting}
//                     title="Удалить клиента"
//                   >
//                     <FaTrash />
//                     <span className="barberclient__btn-label">
//                       {deleting ? "Удаление…" : "Удалить"}
//                     </span>
//                   </button>
//                 ) : (
//                   <span className="barberclient__actionsSpacer" />
//                 )}

//                 <div className="barberclient__actionsRight">
//                   <button
//                     type="button"
//                     className="barberclient__btn barberclient__btn--secondary"
//                     onClick={closeModal}
//                     disabled={saving || deleting}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={saving || deleting}
//                     className="barberclient__btn barberclient__btn--primary"
//                   >
//                     {saving ? "Сохранение…" : "Сохранить"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* Подтверждение удаления (без window.confirm) */}
//       {confirmOpen && (
//         <div className="barberclient__confirmOverlay" onClick={() => setConfirmOpen(false)}>
//           <div className="barberclient__confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
//             <div className="barberclient__confirm-title">Удалить клиента?</div>
//             <div className="barberclient__confirm-text">
//               Действие необратимо. Клиент «{currentClient?.fullName || "—"}» будет удалён.
//             </div>
//             <div className="barberclient__confirm-actions">
//               <button
//                 className="barberclient__btn barberclient__btn--danger"
//                 onClick={confirmDeleteClient}
//                 disabled={deleting}
//               >
//                 {deleting ? "Удаление…" : "Удалить"}
//               </button>
//               <button
//                 className="barberclient__btn barberclient__btn--secondary"
//                 onClick={() => setConfirmOpen(false)}
//                 disabled={deleting}
//               >
//                 Отмена
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* История клиента */}
//       {historyOpen && (
//         <div className="barberclient__modalOverlay" onClick={closeHistory}>
//           <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barberclient__modalHeader">
//               <h3 className="barberclient__modalTitle">История — {historyClient?.fullName}</h3>
//               <button className="barberclient__iconBtn" onClick={closeHistory} aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             <div className="barberclient__form" style={{ marginTop: 0 }}>
//               {historyList.length === 0 ? (
//                 <div className="barberclient__meta">Записей нет</div>
//               ) : (
//                 <div className="barberclient__history">
//                   {historyList.map((a) => {
//                     const date = dateISO(a.start_at);
//                     const time = timeISO(a.start_at);
//                     const barber = a.barber_name || (a.barber ? `ID ${a.barber}` : "—");
//                     const svcObj = servicesById.get(a.service);
//                     const service = a.service_name || svcObj?.service_name || svcObj?.name || "—";
//                     const priceVal = a.service_price ?? a.price ?? svcObj?.price;
//                     return (
//                       <div key={a.id} className="barberclient__history-card">
//                         <div className="barberclient__history-top">
//                           <span className="barberclient__badge">{date} • {time}</span>
//                         </div>
//                         <div className="barberclient__meta" style={{ gap: 12 }}>
//                           <span>Мастер: {barber}</span>
//                           <span>•</span>
//                           <span>Услуга: {service}</span>
//                           <span>•</span>
//                           <span>Цена: {fmtMoney(priceVal)}</span>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//               <div className="barberclient__formActions">
//                 <button
//                   type="button"
//                   className="barberclient__btn barberclient__btn--secondary"
//                   onClick={closeHistory}
//                 >
//                   Закрыть
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Clients;



import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import api from "../../../../api";
import "./Clients.scss";
import { FaPlus, FaEdit, FaTimes, FaSearch, FaTrash } from "react-icons/fa";

/* ===== Статусы ===== */
const UI_TO_API_STATUS = {
  Активен: "active",
  Неактивен: "inactive",
  VIP: "vip",
  "В черном списке": "blacklist",
};
const API_TO_UI_STATUS = {
  active: "Активен",
  inactive: "Неактивен",
  vip: "VIP",
  blacklist: "В черном списке",
};
const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

/* ===== Утилиты ===== */
const pad = (n) => String(n).padStart(2, "0");
const dateISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const normalizePhone = (p) => (p || "").replace(/[^\d]/g, "");
const isValidPhone = (p) => normalizePhone(p).length >= 10;
const normalizeName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const getInitials = (fullName = "") =>
  fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");

/* ===== Ленивый импорт CRM-списка (замените путь, если другой) ===== */
const MarketClients = lazy(() => import("../../Market/Clients/Clients"));

/* ========================================================================== */

const Clients = () => {
  /* ===== Tabs ===== */
  const [activeTab, setActiveTab] = useState("barber"); // 'barber' | 'market'

  /* ===== Клиенты / данные (барбершоп) ===== */
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  /* ===== Модалка клиента ===== */
  const [modalOpen, setModalOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clientAlerts, setClientAlerts] = useState([]); // верхний красный алерт
  const [formErrors, setFormErrors] = useState({}); // рамка у полей
  const [confirmOpen, setConfirmOpen] = useState(false); // подтверждение удаления

  /* ===== История ===== */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);

  /* ===== Пагинация ===== */
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);

  /* ===== Fetch ===== */
  const fetchClients = async () => {
    const res = await api.get("/barbershop/clients/");
    const data = res?.data;
    const raw = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const normalized = raw.map((c) => ({
      id: c.id,
      fullName: c.full_name || "",
      phone: c.phone || "",
      birthDate: c.birth_date || "",
      status: API_TO_UI_STATUS[String(c.status || "").toLowerCase()] || "Активен",
      notes: c.notes || "",
    }));
    setClients(normalized);
  };

  const fetchAllAppointments = async () => {
    const acc = [];
    let next = "/barbershop/appointments/";
    while (next) {
      const { data } = await api.get(next);
      acc.push(...(data?.results || []));
      next = data?.next;
    }
    setAppointments(acc);
  };

  const fetchAllServices = async () => {
    const acc = [];
    let next = "/barbershop/services/";
    while (next) {
      const { data } = await api.get(next);
      acc.push(...(data?.results || []));
      next = data?.next;
    }
    setServices(acc);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setPageError("");
        await Promise.all([fetchClients(), fetchAllAppointments(), fetchAllServices()]);
      } catch (e) {
        console.error(e);
        setPageError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ===== Карты ===== */
  const apptsByClient = useMemo(() => {
    const map = new Map();
    appointments.forEach((a) => {
      if (!a.client) return;
      const arr = map.get(a.client) || [];
      arr.push(a);
      map.set(a.client, arr);
    });
    return map;
  }, [appointments]);

  const servicesById = useMemo(() => {
    const map = new Map();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  /* ===== Фильтр + пагинация ===== */
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = (c.fullName || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [clients, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageSlice = useMemo(() => {
    const from = (pageSafe - 1) * PAGE_SIZE;
    return filteredClients.slice(from, from + PAGE_SIZE);
  }, [filteredClients, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, clients.length]);

  /* ===== CRUD: клиенты ===== */
  const openModal = (client = null) => {
    setCurrentClient(client);
    setFormErrors({});
    setClientAlerts([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || deleting) return;
    setModalOpen(false);
    setCurrentClient(null);
    setFormErrors({});
    setClientAlerts([]);
    setConfirmOpen(false);
  };

  const validateClient = (form) => {
    const errs = {};
    const alerts = [];
    const nameNorm = normalizeName(form.fullName);
    const phoneNorm = normalizePhone(form.phone);

    // ФИО
    if (!nameNorm) {
      errs.fullName = true;
      alerts.push("Укажите ФИО.");
    } else {
      const existsName = clients.some(
        (c) => normalizeName(c.fullName) === nameNorm && (!currentClient?.id || c.id !== currentClient.id)
      );
      if (existsName) {
        errs.fullName = true;
        alerts.push("Клиент с таким ФИО уже существует.");
      }
    }

    // Телефон
    if (!form.phone) {
      errs.phone = true;
      alerts.push("Укажите телефон.");
    } else if (!isValidPhone(form.phone)) {
      errs.phone = true;
      alerts.push("Телефон должен содержать минимум 10 цифр.");
    } else {
      const existsPhone = clients.some(
        (c) => normalizePhone(c.phone) === phoneNorm && (!currentClient?.id || c.id !== currentClient.id)
      );
      if (existsPhone) {
        errs.phone = true;
        alerts.push("Клиент с таким телефоном уже существует.");
      }
    }

    // Дата рождения
    if (form.birthDate) {
      const d = new Date(form.birthDate);
      const now = new Date(todayStr());
      if (Number.isNaN(d.getTime())) {
        errs.birthDate = true;
        alerts.push("Дата рождения указана некорректно.");
      } else if (d > now) {
        errs.birthDate = true;
        alerts.push("Дата рождения в будущем недопустима.");
      } else if (d.getFullYear() < 1900) {
        errs.birthDate = true;
        alerts.push("Слишком ранняя дата рождения.");
      }
    }

    // Статус
    if (!STATUS_OPTIONS_UI.includes(form.status)) {
      errs.status = true;
      alerts.push("Выберите статус из списка.");
    }

    return { errs, alerts };
  };

  const focusFirstError = (errs) => {
    const order = ["fullName", "phone", "birthDate", "status"];
    const firstKey = order.find((k) => errs[k]);
    if (!firstKey) return;
    const el = document.getElementById(firstKey);
    if (el?.focus) el.focus();
  };

  // Создаём дубликат в Market (/main/clients) — тихо, без UI
  const ensureMarketClient = async (form) => {
    try {
      const payload = {
        type: "client",
        full_name: form.fullName,
        phone: form.phone,
        ...(form.birthDate ? { date: form.birthDate } : {}),
      };
      await api.post("/main/clients/", payload);
    } catch (e) {
      console.error(e);
    }
  };

  const saveClient = async (form) => {
    setSaving(true);
    try {
      const payload = {
        full_name: form.fullName,
        phone: form.phone,
        birth_date: form.birthDate || null,
        status: UI_TO_API_STATUS[form.status] || "active",
        notes: form.notes || null,
        company: localStorage.getItem("company"),
      };

      if (currentClient?.id) {
        await api.patch(`/barbershop/clients/${currentClient.id}/`, payload);
      } else {
        await api.post("/barbershop/clients/", payload);
      }

      await fetchClients();           // обновим список барбершопа
      await ensureMarketClient(form); // дублируем в CRM

      setModalOpen(false);
      setCurrentClient(null);
      setFormErrors({});
      setClientAlerts([]);
    } catch (e) {
      const data = e?.response?.data;
      const alerts = [];
      if (typeof data === "string") alerts.push(data);
      else if (data && typeof data === "object") {
        try {
          Object.values(data).forEach((v) => alerts.push(String(Array.isArray(v) ? v[0] : v)));
        } catch {
          alerts.push("Не удалось сохранить клиента.");
        }
      }
      if (!alerts.length) alerts.push("Не удалось сохранить клиента.");
      setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = {
      fullName: fd.get("fullName")?.toString().trim() || "",
      phone: fd.get("phone")?.toString().trim() || "",
      birthDate: fd.get("birthDate")?.toString().trim() || "",
      status: fd.get("status")?.toString().trim() || "Активен",
      notes: fd.get("notes")?.toString() || "",
    };
    const { errs, alerts } = validateClient(form);
    if (alerts.length) {
      setFormErrors(errs);
      setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
      focusFirstError(errs);
      return;
    }
    setFormErrors({});
    setClientAlerts([]);
    saveClient(form);
  };

  const askDeleteClient = () => setConfirmOpen(true);

  const confirmDeleteClient = async () => {
    if (!currentClient?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/barbershop/clients/${currentClient.id}/`);
      await fetchClients();
      closeModal();
    } catch (e) {
      console.error(e);
      setClientAlerts(["Не удалось удалить клиента."]);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  /* ===== История клиента ===== */
  const openHistory = (client) => {
    setHistoryClient(client);
    setHistoryOpen(true);
  };
  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryClient(null);
  };
  const historyList = useMemo(() => {
    if (!historyClient?.id) return [];
    const list = (apptsByClient.get(historyClient.id) || []).slice();
    return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [historyClient, apptsByClient]);

  const fmtMoney = (v) =>
    v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ru-RU")} сом`;

  /* ===================== RENDER ===================== */
  return (
    <div className="barberclient">
      {/* Tabs */}
      <nav className="barberclient__tabs" aria-label="Секции">
        <button
          type="button"
          onClick={() => setActiveTab("barber")}
          className={`barberclient__tab ${activeTab === "barber" ? "barberclient__tab--active" : ""}`}
        >
          Клиенты барбершоп
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("market")}
          className={`barberclient__tab ${activeTab === "market" ? "barberclient__tab--active" : ""}`}
        >
          Клиенты Продаж
        </button>
      </nav>

      {/* BARBER TAB */}
      {activeTab === "barber" ? (
        <>
          <header className="barberclient__header">
            <div>
              <h2 className="barberclient__title">Клиенты</h2>
              <span className="barberclient__subtitle">
                {loading ? "Загрузка…" : `${clients.length} записей`}
              </span>
            </div>
            <div className="barberclient__actions">
              <div className="barberclient__search">
                <FaSearch className="barberclient__search-icon" />
                <input
                  className="barberclient__search-input"
                  type="text"
                  placeholder="Поиск по ФИО или телефону"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="barberclient__btn barberclient__btn--primary"
                onClick={() => openModal()}
              >
                <FaPlus />
                <span className="barberclient__btn-label">Добавить</span>
              </button>
            </div>
          </header>

          {pageError && <div className="barberclient__alert">{pageError}</div>}

          {loading ? (
            <div className="barberclient__skeleton-list">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="barberclient__skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              <div className="barberclient__list">
                {pageSlice.map((client) => {
                  const appts = apptsByClient.get(client.id) || [];
                  return (
                    <article key={client.id} className="barberclient__card">
                      <div className="barberclient__card-left">
                        <div className="barberclient__avatar">{getInitials(client.fullName)}</div>
                        <div className="barberclient__info">
                          <h4 className="barberclient__name">{client.fullName}</h4>
                          <div className="barberclient__meta">
                            <span
                              className={`barberclient__badge barberclient__badge--${
                                UI_TO_API_STATUS[client.status] || "active"
                              }`}
                            >
                              {client.status}
                            </span>
                            <span>{client.phone || "—"}</span>
                            <span>•</span>
                            <span>Записей: {appts.length}</span>
                          </div>
                        </div>
                      </div>
                      <div className="barberclient__card-actions">
                        <button
                          className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
                          onClick={() => openHistory(client)}
                          aria-label="История"
                        >
                          <FaSearch />
                        </button>
                        <button
                          className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
                          onClick={() => openModal(client)}
                          aria-label="Редактировать"
                        >
                          <FaEdit />
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!pageSlice.length && (
                  <div className="barberclient__loading" style={{ textAlign: "center" }}>
                    Ничего не найдено
                  </div>
                )}
              </div>

              {/* пагинация после 15 */}
              {filteredClients.length > PAGE_SIZE && (
                <nav className="barberclient__pager" aria-label="Пагинация">
                  <button
                    type="button"
                    className="barberclient__pager-btn"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span className="barberclient__pager-info">
                    Страница {pageSafe} из {totalPages}
                  </span>
                  <button
                    type="button"
                    className="barberclient__pager-btn"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Вперёд
                  </button>
                </nav>
              )}
            </>
          )}

          {/* Модалка клиента */}
          {modalOpen && (
            <div className="barberclient__modalOverlay" onClick={closeModal}>
              <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
                <div className="barberclient__modalHeader">
                  <h3 className="barberclient__modalTitle">
                    {currentClient ? "Редактировать клиента" : "Новый клиент"}
                  </h3>
                  <button
                    className="barberclient__iconBtn"
                    onClick={closeModal}
                    aria-label="Закрыть"
                  >
                    <FaTimes />
                  </button>
                </div>

                {clientAlerts.length > 0 && (
                  <div className="barberclient__alert">
                    {clientAlerts.length === 1 ? (
                      clientAlerts[0]
                    ) : (
                      <ul className="barberclient__alert-list">
                        {clientAlerts.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <form className="barberclient__form" onSubmit={handleSubmit} noValidate>
                  <div className="barberclient__formGrid">
                    <div
                      className={`barberclient__field ${
                        formErrors.fullName ? "barberclient__field--invalid" : ""
                      }`}
                    >
                      <label htmlFor="fullName" className="barberclient__label">
                        ФИО <span className="barberclient__req">*</span>
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        className={`barberclient__input ${
                          formErrors.fullName ? "barberclient__input--invalid" : ""
                        }`}
                        defaultValue={currentClient?.fullName || ""}
                        placeholder="Фамилия Имя Отчество"
                        autoFocus
                      />
                    </div>

                    <div
                      className={`barberclient__field ${
                        formErrors.phone ? "barberclient__field--invalid" : ""
                      }`}
                    >
                      <label htmlFor="phone" className="barberclient__label">
                        Телефон <span className="barberclient__req">*</span>
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        className={`barberclient__input ${
                          formErrors.phone ? "barberclient__input--invalid" : ""
                        }`}
                        defaultValue={currentClient?.phone || ""}
                        placeholder="+996 ..."
                        inputMode="tel"
                      />
                    </div>

                    <div
                      className={`barberclient__field ${
                        formErrors.birthDate ? "barberclient__field--invalid" : ""
                      }`}
                    >
                      <label htmlFor="birthDate" className="barberclient__label">
                        Дата рождения
                      </label>
                      <input
                        id="birthDate"
                        name="birthDate"
                        className={`barberclient__input ${
                          formErrors.birthDate ? "barberclient__input--invalid" : ""
                        }`}
                        defaultValue={currentClient?.birthDate || ""}
                        type="date"
                      />
                    </div>

                    <div
                      className={`barberclient__field ${
                        formErrors.status ? "barberclient__field--invalid" : ""
                      }`}
                    >
                      <label htmlFor="status" className="barberclient__label">
                        Статус
                      </label>
                      <select
                        id="status"
                        name="status"
                        className={`barberclient__input ${
                          formErrors.status ? "barberclient__input--invalid" : ""
                        }`}
                        defaultValue={currentClient?.status || "Активен"}
                      >
                        {STATUS_OPTIONS_UI.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="barberclient__field barberclient__field--full">
                      <label htmlFor="notes" className="barberclient__label">
                        Заметки
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        className="barberclient__textarea"
                        defaultValue={currentClient?.notes || ""}
                        placeholder="Комментарий, пожелания…"
                      />
                    </div>
                  </div>

                  <div className="barberclient__formActions">
                    {currentClient?.id ? (
                      <button
                        type="button"
                        className="barberclient__btn barberclient__btn--danger"
                        onClick={askDeleteClient}
                        disabled={saving || deleting}
                        title="Удалить клиента"
                      >
                        <FaTrash />
                        <span className="barberclient__btn-label">
                          {deleting ? "Удаление…" : "Удалить"}
                        </span>
                      </button>
                    ) : (
                      <span className="barberclient__actionsSpacer" />
                    )}

                    <div className="barberclient__actionsRight">
                      <button
                        type="button"
                        className="barberclient__btn barberclient__btn--secondary"
                        onClick={closeModal}
                        disabled={saving || deleting}
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={saving || deleting}
                        className="barberclient__btn barberclient__btn--primary"
                      >
                        {saving ? "Сохранение…" : "Сохранить"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Подтверждение удаления */}
          {confirmOpen && (
            <div className="barberclient__confirmOverlay" onClick={() => setConfirmOpen(false)}>
              <div
                className="barberclient__confirm"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="barberclient__confirm-title">Удалить клиента?</div>
                <div className="barberclient__confirm-text">
                  Действие необратимо. Клиент «{currentClient?.fullName || "—"}» будет удалён.
                </div>
                <div className="barberclient__confirm-actions">
                  <button
                    className="barberclient__btn barberclient__btn--danger"
                    onClick={confirmDeleteClient}
                    disabled={deleting}
                  >
                    {deleting ? "Удаление…" : "Удалить"}
                  </button>
                  <button
                    className="barberclient__btn barberclient__btn--secondary"
                    onClick={() => setConfirmOpen(false)}
                    disabled={deleting}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* История клиента */}
          {historyOpen && (
            <div className="barberclient__modalOverlay" onClick={closeHistory}>
              <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
                <div className="barberclient__modalHeader">
                  <h3 className="barberclient__modalTitle">История — {historyClient?.fullName}</h3>
                  <button className="barberclient__iconBtn" onClick={closeHistory} aria-label="Закрыть">
                    <FaTimes />
                  </button>
                </div>

                <div className="barberclient__form" style={{ marginTop: 0 }}>
                  {historyList.length === 0 ? (
                    <div className="barberclient__meta">Записей нет</div>
                  ) : (
                    <div className="barberclient__history">
                      {historyList.map((a) => {
                        const date = dateISO(a.start_at);
                        const time = timeISO(a.start_at);
                        const barber = a.barber_name || (a.barber ? `ID ${a.barber}` : "—");
                        const svcObj = servicesById.get(a.service);
                        const service = a.service_name || svcObj?.service_name || svcObj?.name || "—";
                        const priceVal = a.service_price ?? a.price ?? svcObj?.price;
                        return (
                          <div key={a.id} className="barberclient__history-card">
                            <div className="barberclient__history-top">
                              <span className="barberclient__badge">{date} • {time}</span>
                            </div>
                            <div className="barberclient__meta" style={{ gap: 12 }}>
                              <span>Мастер: {barber}</span>
                              <span>•</span>
                              <span>Услуга: {service}</span>
                              <span>•</span>
                              <span>Цена: {fmtMoney(priceVal)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="barberclient__formActions">
                    <button
                      type="button"
                      className="barberclient__btn barberclient__btn--secondary"
                      onClick={closeHistory}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // MARKET TAB — просто «призываем» целый список
        <Suspense fallback={<div className="barberclient__loading">Загрузка…</div>}>
          <MarketClients />
        </Suspense>
      )}
    </div>
  );
};

export default Clients;
