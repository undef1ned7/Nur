// import { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FaCheck,
//   FaCopy,
//   FaEdit,
//   FaPlus,
//   FaSearch,
//   FaTimes,
//   FaTrash,
// } from "react-icons/fa";
// import api from "../../../../api";
// import { useUser } from "../../../../store/slices/userSlice";
// import "./Masters.scss";

// /* API */
// const EMPLOYEES_LIST_URL = "/users/employees/";
// const EMPLOYEES_CREATE_URL = "/users/employees/create/";
// const EMPLOYEE_ITEM_URL = (id) => `/users/employees/${id}/`;
// const ROLES_LIST_URL = "/users/roles/";
// const ROLE_CREATE_URL = "/users/roles/custom/";
// const ROLE_ITEM_URL = (id) => `/users/roles/custom/${id}/`;

// /* CONSTS */
// const SYSTEM_ROLES = ["owner", "admin"];

// /* UTILS */
// const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
// const normalizeEmployee = (e = {}) => ({
//   id: e.id,
//   email: e.email ?? "",
//   first_name: e.first_name ?? "",
//   last_name: e.last_name ?? "",
//   role: e.role ?? null,
//   custom_role: e.custom_role ?? null,
//   role_display: e.role_display ?? "",
// });
// const fullName = (e) =>
//   [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();
// const ruLabelSys = (c) =>
//   c === "owner" ? "Владелец" : c === "admin" ? "Администратор" : c || "";
// const sysCodeFromName = (n) => {
//   const l = String(n || "").trim().toLowerCase();
//   if (["admin", "administrator", "админ", "администратор"].includes(l)) return "admin";
//   if (["owner", "владелец"].includes(l)) return "owner";
//   return null;
// };
// const normalizeRoleName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
// const normalizeEmail = (s) => String(s || "").trim().toLowerCase();
// const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// const pickApiError = (e, fb) => {
//   const d = e?.response?.data;
//   if (!d) return fb;
//   if (typeof d === "string") return d;
//   if (typeof d === "object") {
//     try {
//       const k = Object.keys(d)[0];
//       const v = Array.isArray(d[k]) ? d[k][0] : d[k];
//       return String(v || fb);
//     } catch { return fb; }
//   }
//   return fb;
// };

// const Masters = () => {
//   const { company } = useUser();
//   const isMaster = company?.sector?.name === "Барбершоп";

//   /* tabs */
//   const [tab, setTab] = useState("masters"); // 'masters' | 'roles'

//   /* data */
//   const [employees, setEmployees] = useState([]);
//   const [roles, setRoles] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   /* search */
//   const [q, setQ] = useState("");

//   /* roles state */
//   const [roleCreateOpen, setRoleCreateOpen] = useState(false);
//   const [roleCreateName, setRoleCreateName] = useState("");
//   const [roleCreateSaving, setRoleCreateSaving] = useState(false);
//   const [roleCreateErr, setRoleCreateErr] = useState("");
//   const [roleEditOpen, setRoleEditOpen] = useState(false);
//   const [roleEditId, setRoleEditId] = useState(null);
//   const [roleEditName, setRoleEditName] = useState("");
//   const [roleEditSaving, setRoleEditSaving] = useState(false);
//   const [roleDeletingIds, setRoleDeletingIds] = useState(new Set());

//   /* employees state */
//   const [empCreateOpen, setEmpCreateOpen] = useState(false);
//   const [empEditOpen, setEmpEditOpen] = useState(false);
//   const [empSaving, setEmpSaving] = useState(false);
//   const [empAlerts, setEmpAlerts] = useState([]); // верхний алерт в модалках сотрудников
//   const [empFieldErrors, setEmpFieldErrors] = useState({}); // {email, first_name, last_name, roleChoice}
//   const [empDeletingIds, setEmpDeletingIds] = useState(new Set());
//   const emptyEmp = { email: "", first_name: "", last_name: "", roleChoice: "" };
//   const [empForm, setEmpForm] = useState(emptyEmp);
//   const [editingEmpId, setEditingEmpId] = useState(null);

//   /* приглашение */
//   const [openLogin, setOpenLogin] = useState(false);
//   const [employData, setEmployData] = useState(null);
//   const [copied, setCopied] = useState(null); // 'email' | 'password' | null

//   const copyToClipboard = async (text, key) => {
//     if (!text) return;
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopied(key);
//       setTimeout(() => setCopied(null), 1500);
//     } catch (e) {
//       console.error("Clipboard error:", e);
//     }
//   };

//   /* fetch */
//   const fetchEmployees = useCallback(async () => {
//     const res = await api.get(EMPLOYEES_LIST_URL);
//     setEmployees(asArray(res.data).map(normalizeEmployee));
//   }, []);
//   const fetchRoles = useCallback(async () => {
//     const res = await api.get(ROLES_LIST_URL);
//     setRoles(asArray(res.data).map((r) => ({ id: r.id, name: r.name || "" })));
//   }, []);
//   useEffect(() => {
//     (async () => {
//       try {
//         setLoading(true);
//         setError("");
//         await Promise.all([fetchEmployees(), fetchRoles()]);
//       } catch {
//         setError("Не удалось загрузить данные.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [fetchEmployees, fetchRoles]);

//   /* maps & options */
//   const roleById = useMemo(() => {
//     const m = new Map();
//     roles.forEach((r) => m.set(r.id, r));
//     return m;
//   }, [roles]);

//   const roleOptions = useMemo(() => {
//     const sys = SYSTEM_ROLES.map((code) => ({ key: `sys:${code}`, label: ruLabelSys(code) }));
//     const cus = roles
//       .filter((r) => !sysCodeFromName(r.name))
//       .map((r) => ({ key: `cus:${r.id}`, label: String(r.name || "").trim() }));
//     const seen = new Set();
//     const out = [];
//     for (const o of [...sys, ...cus]) {
//       const k = o.label.trim().toLowerCase();
//       if (!seen.has(k)) { seen.add(k); out.push(o); }
//     }
//     return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
//   }, [roles]);

//   /* filters */
//   const filteredEmployees = useMemo(() => {
//     const t = q.trim().toLowerCase();
//     if (!t) return employees;
//     return employees.filter((e) =>
//       [fullName(e), e.email, e.role_display, ruLabelSys(e.role)]
//         .filter(Boolean)
//         .some((v) => String(v).toLowerCase().includes(t))
//     );
//   }, [employees, q]);

//   const rolesForList = useMemo(() => {
//     const sys = SYSTEM_ROLES.map((code) => ({ id: `sys:${code}`, name: ruLabelSys(code), _sys: true }));
//     const seen = new Set();
//     const dedup = [];
//     for (const r of roles) {
//       if (sysCodeFromName(r.name)) continue;
//       const k = String(r.name || "").trim().toLowerCase();
//       if (!seen.has(k)) { seen.add(k); dedup.push({ id: r.id, name: r.name || "", _sys: false }); }
//     }
//     return [...sys, ...dedup].sort((a, b) => a.name.localeCompare(b.name, "ru"));
//   }, [roles]);

//   /* ==== validation helpers ==== */
//   const focusFirstInvalid = (errs) => {
//     const order = ["email", "first_name", "last_name", "roleChoice"];
//     const key = order.find((k) => errs[k]);
//     if (key) {
//       const el = document.querySelector(`.barbermasters__form [name="${key}"]`);
//       if (el?.focus) el.focus();
//     }
//   };

//   const validateEmployee = (form, isEdit = false, editId = null) => {
//     const alerts = [];
//     const errs = {};
//     const email = normalizeEmail(form.email);
//     if (!email) { errs.email = true; alerts.push("Укажите Email"); }
//     else if (!emailRx.test(email)) { errs.email = true; alerts.push("Email указан неверно"); }
//     else {
//       const exists = employees.some(
//         (u) => normalizeEmail(u.email) === email && (!isEdit || u.id !== editId)
//       );
//       if (exists) { errs.email = true; alerts.push("Сотрудник с таким Email уже существует"); }
//     }

//     const first = String(form.first_name || "").trim();
//     const last = String(form.last_name || "").trim();
//     if (!first) { errs.first_name = true; alerts.push("Укажите имя"); }
//     else if (first.length < 2) { errs.first_name = true; alerts.push("Имя: минимум 2 символа"); }
//     if (!last) { errs.last_name = true; alerts.push("Укажите фамилию"); }
//     else if (last.length < 2) { errs.last_name = true; alerts.push("Фамилия: минимум 2 символа"); }

//     if (!form.roleChoice) { errs.roleChoice = true; alerts.push("Выберите роль"); }

//     return { errs, alerts };
//   };

//   /* roles CRUD (с валидацией) */
//   const submitRoleCreate = async (e) => {
//     e.preventDefault();
//     const name = roleCreateName.trim();
//     if (!name) return setRoleCreateErr("Укажите название роли");
//     if (sysCodeFromName(name)) return setRoleCreateErr("Это имя занято системной ролью");
//     const dup = roles.some((r) => normalizeRoleName(r.name) === normalizeRoleName(name));
//     if (dup) return setRoleCreateErr("Роль с таким названием уже существует");

//     setRoleCreateSaving(true);
//     setRoleCreateErr("");
//     try {
//       await api.post(ROLE_CREATE_URL, { name });
//       await fetchRoles();
//       setRoleCreateOpen(false);
//       setRoleCreateName("");
//     } catch (err) {
//       setRoleCreateErr(pickApiError(err, "Не удалось создать роль"));
//     } finally {
//       setRoleCreateSaving(false);
//     }
//   };

//   const openRoleEdit = (r) => {
//     if (r._sys) return;
//     setRoleEditId(r.id);
//     setRoleEditName(r.name || "");
//     setRoleEditOpen(true);
//   };

//   const submitRoleEdit = async (e) => {
//     e.preventDefault();
//     if (!roleEditId) return;
//     const name = roleEditName.trim();
//     if (!name) return setRoleCreateErr("Укажите название роли");
//     if (sysCodeFromName(name)) return alert("Это имя зарезервировано системной ролью.");
//     const dup = roles.some((r) => r.id !== roleEditId && normalizeRoleName(r.name) === normalizeRoleName(name));
//     if (dup) return alert("Роль с таким названием уже существует");

//     setRoleEditSaving(true);
//     try {
//       await api.put(ROLE_ITEM_URL(roleEditId), { name });
//       await fetchRoles();
//       setRoleEditOpen(false);
//       setRoleEditId(null);
//       setRoleEditName("");
//     } catch (err) {
//       alert(pickApiError(err, "Не удалось обновить роль"));
//     } finally {
//       setRoleEditSaving(false);
//     }
//   };

//   const removeRole = async (r) => {
//     if (r._sys) return;
//     if (!window.confirm(`Удалить роль «${r.name || "—"}»? Действие необратимо.`)) return;
//     setRoleDeletingIds((p) => new Set(p).add(r.id));
//     try {
//       await api.delete(ROLE_ITEM_URL(r.id));
//       await fetchRoles();
//     } catch (err) {
//       alert(pickApiError(err, "Не удалось удалить роль"));
//     } finally {
//       setRoleDeletingIds((p) => { const n = new Set(p); n.delete(r.id); return n; });
//     }
//   };

//   /* employees CRUD (с валидацией) */
//   const openEmpCreate = () => {
//     setEmpAlerts([]); setEmpFieldErrors({});
//     setEmpForm(emptyEmp);
//     setEmpCreateOpen(true);
//   };

//   const submitEmployeeCreate = async (e) => {
//     e.preventDefault();
//     const { errs, alerts } = validateEmployee(empForm, false, null);
//     if (alerts.length) {
//       setEmpFieldErrors(errs);
//       setEmpAlerts(["Исправьте ошибки в форме", ...alerts]);
//       focusFirstInvalid(errs);
//       return;
//     }

//     const email = normalizeEmail(empForm.email);
//     const payload = { email, first_name: empForm.first_name.trim(), last_name: empForm.last_name.trim() };
//     if (empForm.roleChoice.startsWith("sys:")) payload.role = empForm.roleChoice.slice(4);
//     else if (empForm.roleChoice.startsWith("cus:")) payload.custom_role = empForm.roleChoice.slice(4);

//     setEmpSaving(true);
//     setEmpAlerts([]);
//     try {
//       const { data } = await api.post(EMPLOYEES_CREATE_URL, payload);
//       await fetchEmployees();
//       setEmployData(data);
//       setOpenLogin(true);
//       setEmpCreateOpen(false);
//       setEmpForm(emptyEmp);
//     } catch (err) {
//       const msg = pickApiError(err, "Не удалось создать сотрудника");
//       setEmpAlerts([msg]);
//     } finally { setEmpSaving(false); }
//   };

//   const openEmpEdit = (u) => {
//     const roleChoice = u.role ? `sys:${u.role}` : u.custom_role ? `cus:${u.custom_role}` : "";
//     setEditingEmpId(u.id);
//     setEmpForm({
//       email: u.email || "",
//       first_name: u.first_name || "",
//       last_name: u.last_name || "",
//       roleChoice,
//     });
//     setEmpAlerts([]); setEmpFieldErrors({});
//     setEmpEditOpen(true);
//   };

//   const submitEmployeeEdit = async (e) => {
//     e.preventDefault();
//     if (!editingEmpId) return;

//     const { errs, alerts } = validateEmployee(empForm, true, editingEmpId);
//     if (alerts.length) {
//       setEmpFieldErrors(errs);
//       setEmpAlerts(["Исправьте ошибки в форме", ...alerts]);
//       focusFirstInvalid(errs);
//       return;
//     }

//     const payload = {
//       email: normalizeEmail(empForm.email),
//       first_name: empForm.first_name.trim(),
//       last_name: empForm.last_name.trim(),
//       role: null,
//       custom_role: null,
//     };
//     if (empForm.roleChoice.startsWith("sys:")) payload.role = empForm.roleChoice.slice(4);
//     else if (empForm.roleChoice.startsWith("cus:")) payload.custom_role = empForm.roleChoice.slice(4);

//     setEmpSaving(true);
//     setEmpAlerts([]);
//     try {
//       await api.put(EMPLOYEE_ITEM_URL(editingEmpId), payload);
//       await fetchEmployees();
//       setEmpEditOpen(false);
//       setEditingEmpId(null);
//       setEmpForm(emptyEmp);
//     } catch (err) {
//       const msg = pickApiError(err, "Не удалось обновить сотрудника");
//       setEmpAlerts([msg]);
//     } finally { setEmpSaving(false); }
//   };

//   const removeEmployee = async (u) => {
//     if (!window.confirm(`Удалить мастера «${fullName(u) || u.email || "—"}»?`)) return;
//     setEmpDeletingIds((p) => new Set(p).add(u.id));
//     try {
//       await api.delete(EMPLOYEE_ITEM_URL(u.id));
//       await fetchEmployees();
//     } catch (err) {
//       alert(pickApiError(err, "Не удалось удалить мастера"));
//     } finally {
//       setEmpDeletingIds((p) => { const n = new Set(p); n.delete(u.id); return n; });
//     }
//   };

//   return (
//     <div className="barbermasters">
//       <div className="barbermasters__header">
//         <div className="barbermasters__titleWrap">
//           <h2 className="barbermasters__title">{isMaster ? "Мастера" : "Сотрудники"}</h2>
//           <span className="barbermasters__subtitle">
//             {loading ? "Загрузка…" : tab === "roles" ? `${rolesForList.length} ролей` : `${employees.length} записей`}
//           </span>
//         </div>

//         <div className="barbermasters__actions">
//           <div className="barbermasters__tabs">
//             <button type="button" className={`barbermasters__btn barbermasters__btn--secondary ${tab === "roles" ? "is-active" : ""}`} onClick={() => setTab("roles")}>Роли</button>
//             <button type="button" className={`barbermasters__btn barbermasters__btn--secondary ${tab === "masters" ? "is-active" : ""}`} onClick={() => setTab("masters")}>Сотрудники</button>
//           </div>

//           <div className="barbermasters__search">
//             <FaSearch className="barbermasters__searchIcon" />
//             <input className="barbermasters__searchInput" placeholder={tab === "roles" ? "Поиск ролей…" : "Поиск по сотрудникам"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" />
//           </div>

//           {tab === "roles" ? (
//             <button type="button" className="barbermasters__btn barbermasters__btn--primary" onClick={() => setRoleCreateOpen(true)}>
//               <FaPlus /> <span className="barbermasters__btnText">Создать роль</span>
//             </button>
//           ) : (
//             <button type="button" className="barbermasters__btn barbermasters__btn--primary" onClick={openEmpCreate}>
//               <FaPlus /> <span className="barbermasters__btnText">Добавить сотрудника</span>
//             </button>
//           )}
//         </div>
//       </div>

//       {!!error && <div className="barbermasters__alert">{error}</div>}
//       {loading && <div className="barbermasters__alert">Загрузка…</div>}

//       {!loading && tab === "roles" && (
//         <div className="barbermasters__list">
//           {rolesForList.map((r) => (
//             <article key={r.id} className="barbermasters__card">
//               <div className="barbermasters__cardLeft">
//                 <div className="barbermasters__avatar">{(r.name || "•").trim().charAt(0).toUpperCase()}</div>
//                 <div>
//                   <div className="barbermasters__nameRow">
//                     <h4 className="barbermasters__name">{r.name || "Без названия"}</h4>
//                   </div>
//                   {r._sys && <div className="barbermasters__meta"><span className="bm-item">Системная роль</span></div>}
//                 </div>
//               </div>

//               <div className="barbermasters__cardActions">
//                 <button className="barbermasters__btn barbermasters__btn--secondary" onClick={() => openRoleEdit(r)} disabled={r._sys} title={r._sys ? "Системные роли нельзя изменять" : "Редактировать"}>
//                   <FaEdit /> <span className="barbermasters__btnText">Редактировать</span>
//                 </button>
//                 <button className="barbermasters__btn barbermasters__btn--danger" onClick={() => removeRole(r)} disabled={r._sys || roleDeletingIds.has(r.id)} title={r._sys ? "Системные роли нельзя удалять" : "Удалить"}>
//                   <FaTrash /> <span className="barbermasters__btnText">{roleDeletingIds.has(r.id) ? "Удаление…" : "Удалить"}</span>
//                 </button>
//               </div>
//             </article>
//           ))}
//           {rolesForList.length === 0 && <div className="barbermasters__alert">Пока нет ролей.</div>}
//         </div>
//       )}

//       {!loading && tab === "masters" && (
//         <div className="barbermasters__list">
//           {filteredEmployees.map((u) => {
//             const initial = (fullName(u) || u.email || "•").trim().charAt(0).toUpperCase() || "•";
//             const roleLabel = u.role ? ruLabelSys(u.role) : roles.length ? roleById.get(u.custom_role)?.name || u.role_display || "—" : u.role_display || "—";
//             return (
//               <article key={u.id} className="barbermasters__card">
//                 <div className="barbermasters__cardLeft">
//                   <div className="barbermasters__avatar">{initial}</div>
//                   <div>
//                     <div className="barbermasters__nameRow"><h4 className="barbermasters__name">{fullName(u) || "Без имени"}</h4></div>
//                     <div className="barbermasters__meta"><span className="bm-item">{u.email || "—"}</span><span className="bm-item">{roleLabel}</span></div>
//                   </div>
//                 </div>

//                 <div className="barbermasters__cardActions">
//                   <button className="barbermasters__btn barbermasters__btn--secondary" onClick={() => openEmpEdit(u)} title={`Редактировать ${isMaster ? "мастера" : "сотрудника"}`}>
//                     <FaEdit /> <span className="barbermasters__btnText">Редактировать</span>
//                   </button>
//                   <button className="barbermasters__btn barbermasters__btn--danger" onClick={() => removeEmployee(u)} disabled={empDeletingIds.has(u.id)} title={`Удалить ${isMaster ? "мастера" : "сотрудника"}`}>
//                     <FaTrash /> <span className="barbermasters__btnText">{empDeletingIds.has(u.id) ? "Удаление…" : "Удалить"}</span>
//                   </button>
//                 </div>
//               </article>
//             );
//           })}
//           {filteredEmployees.length === 0 && employees.length > 0 && <div className="barbermasters__alert">Ничего не найдено.</div>}
//           {!loading && employees.length === 0 && <div className="barbermasters__alert">Пока нет сотрудников.</div>}
//         </div>
//       )}

//       {/* MODALS */}
//       {roleCreateOpen && (
//         <div className="barbermasters__overlay" onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}>
//           <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Новая роль</h3>
//               <button className="barbermasters__iconBtn" onClick={() => !roleCreateSaving && setRoleCreateOpen(false)} aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             <form className="barbermasters__form" onSubmit={submitRoleCreate} noValidate>
//               <div className="barbermasters__grid">
//                 <label className="barbermasters__field barbermasters__field--full">
//                   <span className="barbermasters__label">Название роли <b className="barbermasters__req">*</b></span>
//                   <input className="barbermasters__input" placeholder="Например: Контент-менеджер" value={roleCreateName} onChange={(e) => setRoleCreateName(e.target.value)} required />
//                 </label>
//               </div>

//               {!!roleCreateErr && <div className="barbermasters__alert barbermasters__alert--inModal">{roleCreateErr}</div>}

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button type="button" className="barbermasters__btn barbermasters__btn--secondary" onClick={() => setRoleCreateOpen(false)} disabled={roleCreateSaving}>Отмена</button>
//                   <button type="submit" className="barbermasters__btn barbermasters__btn--primary" disabled={roleCreateSaving}>{roleCreateSaving ? "Сохранение…" : "Создать роль"}</button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {roleEditOpen && (
//         <div className="barbermasters__overlay" onClick={() => !roleEditSaving && setRoleEditOpen(false)}>
//           <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Изменить роль</h3>
//               <button className="barbermasters__iconBtn" onClick={() => !roleEditSaving && setRoleEditOpen(false)} aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             <form className="barbermasters__form" onSubmit={submitRoleEdit} noValidate>
//               <div className="barbermasters__grid">
//                 <label className="barbermasters__field barbermasters__field--full">
//                   <span className="barbermasters__label">Название роли <b className="barbermasters__req">*</b></span>
//                   <input className="barbermasters__input" placeholder="Название роли" value={roleEditName} onChange={(e) => setRoleEditName(e.target.value)} required />
//                 </label>
//               </div>

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button type="button" className="barbermasters__btn barbermasters__btn--secondary" onClick={() => setRoleEditOpen(false)} disabled={roleEditSaving}>Отмена</button>
//                   <button type="submit" className="barbermasters__btn barbermasters__btn--primary" disabled={roleEditSaving}>{roleEditSaving ? "Сохранение…" : "Сохранить изменения"}</button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {empCreateOpen && (
//         <div className="barbermasters__overlay" onClick={() => !empSaving && setEmpCreateOpen(false)}>
//           <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Новый сотрудник</h3>
//               <button className="barbermasters__iconBtn" onClick={() => !empSaving && setEmpCreateOpen(false)} aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             {/* верхний алерт */}
//             {empAlerts.length > 0 && (
//               <div className="barbermasters__alert barbermasters__alert--inModal">
//                 {empAlerts.length === 1 ? empAlerts[0] : (
//                   <ul style={{ margin: 0, paddingLeft: 18 }}>
//                     {empAlerts.map((m, i) => <li key={i}>{m}</li>)}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form className="barbermasters__form" onSubmit={submitEmployeeCreate} noValidate>
//               <div className="barbermasters__grid">
//                 <label className={`barbermasters__field ${empFieldErrors.email ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Email <b className="barbermasters__req">*</b></span>
//                   <input
//                     name="email"
//                     type="email"
//                     className={`barbermasters__input ${empFieldErrors.email ? "barbermasters__input--invalid" : ""}`}
//                     placeholder="user@mail.com"
//                     value={empForm.email}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
//                     required
//                   />
//                 </label>

//                 <label className={`barbermasters__field ${empFieldErrors.first_name ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Имя <b className="barbermasters__req">*</b></span>
//                   <input
//                     name="first_name"
//                     className={`barbermasters__input ${empFieldErrors.first_name ? "barbermasters__input--invalid" : ""}`}
//                     placeholder="Имя"
//                     value={empForm.first_name}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
//                     required
//                   />
//                 </label>

//                 <label className={`barbermasters__field ${empFieldErrors.last_name ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Фамилия <b className="barbermasters__req">*</b></span>
//                   <input
//                     name="last_name"
//                     className={`barbermasters__input ${empFieldErrors.last_name ? "barbermasters__input--invalid" : ""}`}
//                     placeholder="Фамилия"
//                     value={empForm.last_name}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
//                     required
//                   />
//                 </label>

//                 <label className={`barbermasters__field barbermasters__field--full ${empFieldErrors.roleChoice ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Роль <b className="barbermasters__req">*</b></span>
//                   <select
//                     name="roleChoice"
//                     className={`barbermasters__input ${empFieldErrors.roleChoice ? "barbermasters__input--invalid" : ""}`}
//                     value={empForm.roleChoice}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, roleChoice: e.target.value }))}
//                     required
//                   >
//                     <option value="">Выберите роль</option>
//                     {roleOptions.map((o) => (
//                       <option key={o.key} value={o.key}>{o.label}</option>
//                     ))}
//                   </select>
//                 </label>
//               </div>

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button type="button" className="barbermasters__btn barbermasters__btn--secondary" onClick={() => setEmpCreateOpen(false)} disabled={empSaving}>Отмена</button>
//                   <button type="submit" className="barbermasters__btn barbermasters__btn--primary" disabled={empSaving}>
//                     {empSaving ? "Сохранение…" : "Создать сотрудника"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {empEditOpen && (
//         <div className="barbermasters__overlay" onClick={() => !empSaving && setEmpEditOpen(false)}>
//           <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Редактировать сотрудника</h3>
//               <button className="barbermasters__iconBtn" onClick={() => !empSaving && setEmpEditOpen(false)} aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             {empAlerts.length > 0 && (
//               <div className="barbermasters__alert barbermasters__alert--inModal">
//                 {empAlerts.length === 1 ? empAlerts[0] : (
//                   <ul style={{ margin: 0, paddingLeft: 18 }}>
//                     {empAlerts.map((m, i) => <li key={i}>{m}</li>)}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form className="barbermasters__form" onSubmit={submitEmployeeEdit} noValidate>
//               <div className="barbermasters__grid">
//                 <label className={`barbermasters__field ${empFieldErrors.email ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Email <b className="barbermasters__req">*</b></span>
//                   <input
//                     name="email"
//                     type="email"
//                     className={`barbermasters__input ${empFieldErrors.email ? "barbermasters__input--invalid" : ""}`}
//                     placeholder="user@mail.com"
//                     value={empForm.email}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
//                     required
//                   />
//                 </label>

//                 <label className={`barbermasters__field ${empFieldErrors.first_name ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Имя <b className="barbermasters__req">*</b></span>
//                   <input
//                     name="first_name"
//                     className={`barbermasters__input ${empFieldErrors.first_name ? "barbermasters__input--invalid" : ""}`}
//                     placeholder="Имя"
//                     value={empForm.first_name}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
//                     required
//                   />
//                 </label>

//                 <label className={`barbermasters__field ${empFieldErrors.last_name ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Фамилия <b className="barbermasters__req">*</b></span>
//                   <input
//                     name="last_name"
//                     className={`barbermasters__input ${empFieldErrors.last_name ? "barbermasters__input--invalid" : ""}`}
//                     placeholder="Фамилия"
//                     value={empForm.last_name}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
//                     required
//                   />
//                 </label>

//                 <label className={`barbermasters__field barbermasters__field--full ${empFieldErrors.roleChoice ? "barbermasters__field--invalid" : ""}`}>
//                   <span className="barbermasters__label">Роль <b className="barbermasters__req">*</b></span>
//                   <select
//                     name="roleChoice"
//                     className={`barbermasters__input ${empFieldErrors.roleChoice ? "barbermasters__input--invalid" : ""}`}
//                     value={empForm.roleChoice}
//                     onChange={(e) => setEmpForm((p) => ({ ...p, roleChoice: e.target.value }))}
//                     required
//                   >
//                     <option value="">Выберите роль</option>
//                     {roleOptions.map((o) => (
//                       <option key={o.key} value={o.key}>{o.label}</option>
//                     ))}
//                   </select>
//                 </label>
//               </div>

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button type="button" className="barbermasters__btn barbermasters__btn--secondary" onClick={() => setEmpEditOpen(false)} disabled={empSaving}>Отмена</button>
//                   <button type="submit" className="barbermasters__btn barbermasters__btn--primary" disabled={empSaving}>
//                     {empSaving ? "Сохранение…" : "Сохранить изменения"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {openLogin && (
//         <div className="barbermasters__overlay" onClick={() => setOpenLogin(false)}>
//           <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Логин сотрудника</h3>
//               <button className="barbermasters__iconBtn" onClick={() => setOpenLogin(false)} aria-label="Закрыть"><FaTimes /></button>
//             </div>
//             <div className="barbermasters__content">
//               <p className="barbermasters__label">
//                 Логин: <b>{employData?.email}</b>
//                 <button className="barbermasters__iconBtn barbermasters__copyBtn" onClick={() => copyToClipboard(employData?.email || "", "email")} aria-label="Скопировать логин" title={copied === "email" ? "Скопировано!" : "Скопировать"}>
//                   {copied === "email" ? <FaCheck /> : <FaCopy />}
//                 </button>
//               </p>

//               <p className="barbermasters__label">
//                 Пароль: <b>{employData?.generated_password}</b>
//                 <button className="barbermasters__iconBtn barbermasters__copyBtn" onClick={() => copyToClipboard(employData?.generated_password || "", "password")} aria-label="Скопировать пароль" title={copied === "password" ? "Скопировано!" : "Скопировать"}>
//                   {copied === "password" ? <FaCheck /> : <FaCopy />}
//                 </button>
//               </p>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Masters;




import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCheck, FaCopy, FaEdit, FaPlus, FaSearch, FaTimes, FaTrash } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import "./Masters.scss";

/* API */
const EMPLOYEES_LIST_URL = "/users/employees/";
const EMPLOYEES_CREATE_URL = "/users/employees/create/";
const EMPLOYEE_ITEM_URL = (id) => `/users/employees/${id}/`;
const ROLES_LIST_URL = "/users/roles/";
const ROLE_CREATE_URL = "/users/roles/custom/";
const ROLE_ITEM_URL = (id) => `/users/roles/custom/${id}/`;

/* CONSTS */
const SYSTEM_ROLES = ["owner", "admin"];
const PAGE_SIZE = 15;

/* UTILS */
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
const normalizeEmployee = (e = {}) => ({
  id: e.id,
  email: e.email ?? "",
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  role: e.role ?? null,
  custom_role: e.custom_role ?? null,
  role_display: e.role_display ?? "",
});
const fullName = (e) => [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();
const ruLabelSys = (c) => (c === "owner" ? "Владелец" : c === "admin" ? "Администратор" : c || "");
const sysCodeFromName = (n) => {
  const l = String(n || "").trim().toLowerCase();
  if (["admin", "administrator", "админ", "администратор"].includes(l)) return "admin";
  if (["owner", "владелец"].includes(l)) return "owner";
  return null;
};
const normalizeRoleName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const normalizeEmail = (s) => String(s || "").trim().toLowerCase();
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pickApiError = (e, fb) => {
  const d = e?.response?.data;
  if (!d) return fb;
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    try {
      const k = Object.keys(d)[0];
      const v = Array.isArray(d[k]) ? d[k][0] : d[k];
      return String(v || fb);
    } catch {
      return fb;
    }
  }
  return fb;
};

const Masters = () => {
  const { company } = useUser();
  const isMaster = company?.sector?.name === "Барбершоп";

  /* tabs */
  const [tab, setTab] = useState("masters"); // 'masters' | 'roles'

  /* data */
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* search */
  const [q, setQ] = useState("");

  /* roles state */
  const [roleCreateOpen, setRoleCreateOpen] = useState(false);
  const [roleCreateName, setRoleCreateName] = useState("");
  const [roleCreateSaving, setRoleCreateSaving] = useState(false);
  const [roleCreateErr, setRoleCreateErr] = useState("");
  const [roleEditOpen, setRoleEditOpen] = useState(false);
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleEditName, setRoleEditName] = useState("");
  const [roleEditSaving, setRoleEditSaving] = useState(false);
  const [roleEditErr, setRoleEditErr] = useState("");
  const [roleDeletingIds, setRoleDeletingIds] = useState(new Set());
  const [roleToDelete, setRoleToDelete] = useState(null);

  /* employees state */
  const [empCreateOpen, setEmpCreateOpen] = useState(false);
  const [empEditOpen, setEmpEditOpen] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [empAlerts, setEmpAlerts] = useState([]); // верхний алерт в модалках сотрудников
  const [empFieldErrors, setEmpFieldErrors] = useState({}); // {email, first_name, last_name, roleChoice}
  const [empDeletingIds, setEmpDeletingIds] = useState(new Set());
  const [empToDelete, setEmpToDelete] = useState(null);
  const emptyEmp = { email: "", first_name: "", last_name: "", roleChoice: "" };
  const [empForm, setEmpForm] = useState(emptyEmp);
  const [editingEmpId, setEditingEmpId] = useState(null);

  /* приглашение */
  const [openLogin, setOpenLogin] = useState(false);
  const [employData, setEmployData] = useState(null);
  const [copied, setCopied] = useState(null); // 'email' | 'password' | null

  /* page alerts for list actions */
  const [pageNotice, setPageNotice] = useState("");

  /* pagination */
  const [pageEmp, setPageEmp] = useState(1);
  const [pageRole, setPageRole] = useState(1);

  const copyToClipboard = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch (e) {
      console.error("Clipboard error:", e);
    }
  };

  /* fetch */
  const fetchEmployees = useCallback(async () => {
    const res = await api.get(EMPLOYEES_LIST_URL);
    setEmployees(asArray(res.data).map(normalizeEmployee));
  }, []);
  const fetchRoles = useCallback(async () => {
    const res = await api.get(ROLES_LIST_URL);
    setRoles(asArray(res.data).map((r) => ({ id: r.id, name: r.name || "" })));
  }, []);
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([fetchEmployees(), fetchRoles()]);
      } catch {
        setError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchEmployees, fetchRoles]);

  /* maps & options */
  const roleById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  const roleOptions = useMemo(() => {
    const sys = SYSTEM_ROLES.map((code) => ({ key: `sys:${code}`, label: ruLabelSys(code) }));
    const cus = roles
      .filter((r) => !sysCodeFromName(r.name))
      .map((r) => ({ key: `cus:${r.id}`, label: String(r.name || "").trim() }));
    const seen = new Set();
    const out = [];
    for (const o of [...sys, ...cus]) {
      const k = o.label.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(o);
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [roles]);

  /* filters */
  const filteredEmployees = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return employees;
    return employees.filter((e) =>
      [fullName(e), e.email, e.role_display, ruLabelSys(e.role)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    );
  }, [employees, q]);

  // роли для списка (с учётом системных + удаление дублей) + поиск
  const rolesForList = useMemo(() => {
    const sys = SYSTEM_ROLES.map((code) => ({ id: `sys:${code}`, name: ruLabelSys(code), _sys: true }));
    const seen = new Set();
    const dedup = [];
    for (const r of roles) {
      if (sysCodeFromName(r.name)) continue;
      const k = String(r.name || "").trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        dedup.push({ id: r.id, name: r.name || "", _sys: false });
      }
    }
    const base = [...sys, ...dedup].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const t = q.trim().toLowerCase();
    if (!t) return base;
    return base.filter((r) => (r.name || "").toLowerCase().includes(t));
  }, [roles, q]);

  /* reset page on search/tab change */
  useEffect(() => {
    setPageEmp(1);
    setPageRole(1);
  }, [q, tab, filteredEmployees.length, rolesForList.length]);

  /* ==== validation helpers ==== */
  const focusFirstInvalid = (errs) => {
    const order = ["email", "first_name", "last_name", "roleChoice"];
    const key = order.find((k) => errs[k]);
    if (key) {
      const el = document.querySelector(`.barbermasters__form [name="${key}"]`);
      if (el?.focus) el.focus();
    }
  };

  const validateEmployee = (form, isEdit = false, editId = null) => {
    const alerts = [];
    const errs = {};
    const email = normalizeEmail(form.email);
    if (!email) {
      errs.email = true;
      alerts.push("Укажите Email.");
    } else if (!emailRx.test(email)) {
      errs.email = true;
      alerts.push("Email указан неверно.");
    } else {
      const exists = employees.some(
        (u) => normalizeEmail(u.email) === email && (!isEdit || u.id !== editId)
      );
      if (exists) {
        errs.email = true;
        alerts.push("Сотрудник с таким Email уже существует.");
      }
    }

    const first = String(form.first_name || "").trim();
    const last = String(form.last_name || "").trim();
    if (!first) {
      errs.first_name = true;
      alerts.push("Укажите имя.");
    } else if (first.length < 2) {
      errs.first_name = true;
      alerts.push("Имя: минимум 2 символа.");
    }
    if (!last) {
      errs.last_name = true;
      alerts.push("Укажите фамилию.");
    } else if (last.length < 2) {
      errs.last_name = true;
      alerts.push("Фамилия: минимум 2 символа.");
    }

    if (!form.roleChoice) {
      errs.roleChoice = true;
      alerts.push("Выберите роль.");
    }

    return { errs, alerts };
  };

  /* roles CRUD (с валидацией) */
  const submitRoleCreate = async (e) => {
    e.preventDefault();
    const name = roleCreateName.trim();
    if (!name) return setRoleCreateErr("Укажите название роли.");
    if (sysCodeFromName(name)) return setRoleCreateErr("Это имя занято системной ролью.");
    const dup = roles.some((r) => normalizeRoleName(r.name) === normalizeRoleName(name));
    if (dup) return setRoleCreateErr("Роль с таким названием уже существует.");

    setRoleCreateSaving(true);
    setRoleCreateErr("");
    try {
      await api.post(ROLE_CREATE_URL, { name });
      await fetchRoles();
      setRoleCreateOpen(false);
      setRoleCreateName("");
    } catch (err) {
      setRoleCreateErr(pickApiError(err, "Не удалось создать роль."));
    } finally {
      setRoleCreateSaving(false);
    }
  };

  const openRoleEdit = (r) => {
    if (r._sys) return;
    setRoleEditId(r.id);
    setRoleEditName(r.name || "");
    setRoleEditErr("");
    setRoleEditOpen(true);
  };

  const submitRoleEdit = async (e) => {
    e.preventDefault();
    if (!roleEditId) return;
    const name = roleEditName.trim();
    if (!name) return setRoleEditErr("Укажите название роли.");
    if (sysCodeFromName(name)) return setRoleEditErr("Это имя зарезервировано системной ролью.");
    const dup = roles.some(
      (r) => r.id !== roleEditId && normalizeRoleName(r.name) === normalizeRoleName(name)
    );
    if (dup) return setRoleEditErr("Роль с таким названием уже существует.");

    setRoleEditSaving(true);
    setRoleEditErr("");
    try {
      await api.put(ROLE_ITEM_URL(roleEditId), { name });
      await fetchRoles();
      setRoleEditOpen(false);
      setRoleEditId(null);
      setRoleEditName("");
    } catch (err) {
      setRoleEditErr(pickApiError(err, "Не удалось обновить роль."));
    } finally {
      setRoleEditSaving(false);
    }
  };

  const doRemoveRole = async () => {
    const r = roleToDelete;
    if (!r || r._sys) return;
    setRoleDeletingIds((p) => new Set(p).add(r.id));
    setPageNotice("");
    try {
      await api.delete(ROLE_ITEM_URL(r.id));
      await fetchRoles();
    } catch (err) {
      setPageNotice(pickApiError(err, "Не удалось удалить роль."));
    } finally {
      setRoleDeletingIds((p) => {
        const n = new Set(p);
        n.delete(r.id);
        return n;
      });
      setRoleToDelete(null);
    }
  };

  /* employees CRUD (с валидацией) */
  const openEmpCreate = () => {
    setEmpAlerts([]);
    setEmpFieldErrors({});
    setEmpForm(emptyEmp);
    setEmpCreateOpen(true);
  };

  const submitEmployeeCreate = async (e) => {
    e.preventDefault();
    const { errs, alerts } = validateEmployee(empForm, false, null);
    if (alerts.length) {
      setEmpFieldErrors(errs);
      setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstInvalid(errs);
      return;
    }

    const email = normalizeEmail(empForm.email);
    const payload = { email, first_name: empForm.first_name.trim(), last_name: empForm.last_name.trim() };
    if (empForm.roleChoice.startsWith("sys:")) payload.role = empForm.roleChoice.slice(4);
    else if (empForm.roleChoice.startsWith("cus:")) payload.custom_role = empForm.roleChoice.slice(4);

    setEmpSaving(true);
    setEmpAlerts([]);
    try {
      const { data } = await api.post(EMPLOYEES_CREATE_URL, payload);
      await fetchEmployees();
      setEmployData(data);
      setOpenLogin(true);
      setEmpCreateOpen(false);
      setEmpForm(emptyEmp);
    } catch (err) {
      const msg = pickApiError(err, "Не удалось создать сотрудника.");
      setEmpAlerts([msg]);
    } finally {
      setEmpSaving(false);
    }
  };

  const openEmpEdit = (u) => {
    const roleChoice = u.role ? `sys:${u.role}` : u.custom_role ? `cus:${u.custom_role}` : "";
    setEditingEmpId(u.id);
    setEmpForm({
      email: u.email || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      roleChoice,
    });
    setEmpAlerts([]);
    setEmpFieldErrors({});
    setEmpEditOpen(true);
  };

  const submitEmployeeEdit = async (e) => {
    e.preventDefault();
    if (!editingEmpId) return;

    const { errs, alerts } = validateEmployee(empForm, true, editingEmpId);
    if (alerts.length) {
      setEmpFieldErrors(errs);
      setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstInvalid(errs);
      return;
    }

    const payload = {
      email: normalizeEmail(empForm.email),
      first_name: empForm.first_name.trim(),
      last_name: empForm.last_name.trim(),
      role: null,
      custom_role: null,
    };
    if (empForm.roleChoice.startsWith("sys:")) payload.role = empForm.roleChoice.slice(4);
    else if (empForm.roleChoice.startsWith("cus:")) payload.custom_role = empForm.roleChoice.slice(4);

    setEmpSaving(true);
    setEmpAlerts([]);
    try {
      await api.put(EMPLOYEE_ITEM_URL(editingEmpId), payload);
      await fetchEmployees();
      setEmpEditOpen(false);
      setEditingEmpId(null);
      setEmpForm(emptyEmp);
    } catch (err) {
      const msg = pickApiError(err, "Не удалось обновить сотрудника.");
      setEmpAlerts([msg]);
    } finally {
      setEmpSaving(false);
    }
  };

  const doRemoveEmployee = async () => {
    const u = empToDelete;
    if (!u) return;
    setEmpDeletingIds((p) => new Set(p).add(u.id));
    setPageNotice("");
    try {
      await api.delete(EMPLOYEE_ITEM_URL(u.id));
      await fetchEmployees();
    } catch (err) {
      setPageNotice(pickApiError(err, "Не удалось удалить сотрудника."));
    } finally {
      setEmpDeletingIds((p) => {
        const n = new Set(p);
        n.delete(u.id);
        return n;
      });
      setEmpToDelete(null);
    }
  };

  /* pagination derived */
  const totalPagesEmp = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const totalPagesRole = Math.max(1, Math.ceil(rolesForList.length / PAGE_SIZE));
  const pageSafeEmp = Math.min(pageEmp, totalPagesEmp);
  const pageSafeRole = Math.min(pageRole, totalPagesRole);
  const empRows = filteredEmployees.slice((pageSafeEmp - 1) * PAGE_SIZE, pageSafeEmp * PAGE_SIZE);
  const roleRows = rolesForList.slice((pageSafeRole - 1) * PAGE_SIZE, pageSafeRole * PAGE_SIZE);

  const Pager = ({ page, total, onChange }) => {
    if (total <= 1) return null;
    const onPrev = () => onChange(Math.max(1, page - 1));
    const onNext = () => onChange(Math.min(total, page + 1));
    const pages = new Set([1, page - 1, page, page + 1, total]);
    const list = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    return (
      <nav className="barbermasters__pager" aria-label="Пагинация">
        <button className="barbermasters__pageBtn" onClick={onPrev} disabled={page === 1}>Назад</button>
        <ul className="barbermasters__pageList">
          {list.map((n, i) => {
            const prev = list[i - 1];
            const gap = prev && n - prev > 1;
            return (
              <div key={n} className="barbermasters__pageItemWrap">
                {gap && <li className="barbermasters__dots">…</li>}
                <li>
                  <button
                    className={`barbermasters__pageBtn ${n === page ? "is-active" : ""}`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => onChange(n)}
                  >
                    {n}
                  </button>
                </li>
              </div>
            );
          })}
        </ul>
        <button className="barbermasters__pageBtn" onClick={onNext} disabled={page === total}>Далее</button>
      </nav>
    );
  };

  return (
    <div className="barbermasters">
      <div className="barbermasters__header">
        <div className="barbermasters__titleWrap">
          <h2 className="barbermasters__title">{isMaster ? "Мастера" : "Сотрудники"}</h2>
          <span className="barbermasters__subtitle">
            {loading
              ? "Загрузка…"
              : tab === "roles"
                ? `${rolesForList.length} ролей${rolesForList.length > PAGE_SIZE ? ` · стр. ${pageSafeRole}/${totalPagesRole}` : ""}`
                : `${filteredEmployees.length} записей${filteredEmployees.length > PAGE_SIZE ? ` · стр. ${pageSafeEmp}/${totalPagesEmp}` : ""}`
            }
          </span>
        </div>

        <div className="barbermasters__actions">
          <div className="barbermasters__tabs">
            <button
              type="button"
              className={`barbermasters__btn barbermasters__btn--secondary ${tab === "roles" ? "is-active" : ""}`}
              onClick={() => setTab("roles")}
            >
              Роли
            </button>
            <button
              type="button"
              className={`barbermasters__btn barbermasters__btn--secondary ${tab === "masters" ? "is-active" : ""}`}
              onClick={() => setTab("masters")}
            >
              Сотрудники
            </button>
          </div>

          <div className="barbermasters__search">
            <FaSearch className="barbermasters__searchIcon" />
            <input
              className="barbermasters__searchInput"
              placeholder={tab === "roles" ? "Поиск ролей…" : "Поиск по сотрудникам"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          {tab === "roles" ? (
            <button
              type="button"
              className="barbermasters__btn barbermasters__btn--primary"
              onClick={() => setRoleCreateOpen(true)}
            >
              <FaPlus /> <span className="barbermasters__btnText">Создать роль</span>
            </button>
          ) : (
            <button
              type="button"
              className="barbermasters__btn barbermasters__btn--primary"
              onClick={openEmpCreate}
            >
              <FaPlus /> <span className="barbermasters__btnText">Добавить сотрудника</span>
            </button>
          )}
        </div>
      </div>

      {!!error && <div className="barbermasters__alert">{error}</div>}
      {!!pageNotice && <div className="barbermasters__alert">{pageNotice}</div>}
      {loading && <div className="barbermasters__alert">Загрузка…</div>}

      {!loading && tab === "roles" && (
        <>
          <div className="barbermasters__list">
            {roleRows.map((r) => (
              <article key={r.id} className="barbermasters__card">
                <div className="barbermasters__cardLeft">
                  <div className="barbermasters__avatar">
                    {(r.name || "•").trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="barbermasters__nameRow">
                      <h4 className="barbermasters__name">{r.name || "Без названия"}</h4>
                    </div>
                    {r._sys && (
                      <div className="barbermasters__meta">
                        <span className="bm-item">Системная роль</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="barbermasters__cardActions">
                  <button
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => openRoleEdit(r)}
                    disabled={r._sys}
                    title={r._sys ? "Системные роли нельзя изменять" : "Редактировать"}
                  >
                    <FaEdit /> <span className="barbermasters__btnText">Редактировать</span>
                  </button>
                  <button
                    className="barbermasters__btn barbermasters__btn--danger"
                    onClick={() => setRoleToDelete(r)}
                    disabled={r._sys || roleDeletingIds.has(r.id)}
                    title={r._sys ? "Системные роли нельзя удалять" : "Удалить"}
                  >
                    <FaTrash />{" "}
                    <span className="barbermasters__btnText">
                      {roleDeletingIds.has(r.id) ? "Удаление…" : "Удалить"}
                    </span>
                  </button>
                </div>
              </article>
            ))}
            {rolesForList.length === 0 && <div className="barbermasters__alert">Пока нет ролей.</div>}
          </div>

          {rolesForList.length > PAGE_SIZE && (
            <Pager page={pageSafeRole} total={totalPagesRole} onChange={setPageRole} />
          )}
        </>
      )}

      {!loading && tab === "masters" && (
        <>
          <div className="barbermasters__list">
            {empRows.map((u) => {
              const initial = (fullName(u) || u.email || "•").trim().charAt(0).toUpperCase() || "•";
              const roleLabel = u.role
                ? ruLabelSys(u.role)
                : roles.length
                ? roleById.get(u.custom_role)?.name || u.role_display || "—"
                : u.role_display || "—";
              return (
                <article key={u.id} className="barbermasters__card">
                  <div className="barbermasters__cardLeft">
                    <div className="barbermasters__avatar">{initial}</div>
                    <div>
                      <div className="barbermasters__nameRow">
                        <h4 className="barbermasters__name">{fullName(u) || "Без имени"}</h4>
                      </div>
                      <div className="barbermasters__meta">
                        <span className="bm-item">{u.email || "—"}</span>
                        <span className="bm-item">{roleLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="barbermasters__cardActions">
                    <button
                      className="barbermasters__btn barbermasters__btn--secondary"
                      onClick={() => openEmpEdit(u)}
                      title={`Редактировать ${isMaster ? "мастера" : "сотрудника"}`}
                    >
                      <FaEdit /> <span className="barbermasters__btnText">Редактировать</span>
                    </button>
                    <button
                      className="barbermasters__btn barbermasters__btn--danger"
                      onClick={() => setEmpToDelete(u)}
                      disabled={empDeletingIds.has(u.id)}
                      title={`Удалить ${isMaster ? "мастера" : "сотрудника"}`}
                    >
                      <FaTrash />{" "}
                      <span className="barbermasters__btnText">
                        {empDeletingIds.has(u.id) ? "Удаление…" : "Удалить"}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredEmployees.length === 0 && employees.length > 0 && (
              <div className="barbermasters__alert">Ничего не найдено.</div>
            )}
            {!loading && employees.length === 0 && (
              <div className="barbermasters__alert">Пока нет сотрудников.</div>
            )}
          </div>

          {filteredEmployees.length > PAGE_SIZE && (
            <Pager page={pageSafeEmp} total={totalPagesEmp} onChange={setPageEmp} />
          )}
        </>
      )}

      {/* MODALS: Roles create/edit */}
      {roleCreateOpen && (
        <div className="barbermasters__overlay" onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Новая роль</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="barbermasters__form" onSubmit={submitRoleCreate} noValidate>
              <div className="barbermasters__grid">
                <label className="barbermasters__field barbermasters__field--full">
                  <span className="barbermasters__label">
                    Название роли <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    className="barbermasters__input"
                    placeholder="Например: Контент-менеджер"
                    value={roleCreateName}
                    onChange={(e) => setRoleCreateName(e.target.value)}
                    required
                  />
                </label>
              </div>

              {!!roleCreateErr && (
                <div className="barbermasters__alert barbermasters__alert--inModal">{roleCreateErr}</div>
              )}

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setRoleCreateOpen(false)}
                    disabled={roleCreateSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={roleCreateSaving}
                  >
                    {roleCreateSaving ? "Сохранение…" : "Создать роль"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {roleEditOpen && (
        <div className="barbermasters__overlay" onClick={() => !roleEditSaving && setRoleEditOpen(false)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Изменить роль</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !roleEditSaving && setRoleEditOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!roleEditErr && (
              <div className="barbermasters__alert barbermasters__alert--inModal">{roleEditErr}</div>
            )}

            <form className="barbermasters__form" onSubmit={submitRoleEdit} noValidate>
              <div className="barbermasters__grid">
                <label className="barbermasters__field barbermasters__field--full">
                  <span className="barbermasters__label">
                    Название роли <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    className="barbermasters__input"
                    placeholder="Название роли"
                    value={roleEditName}
                    onChange={(e) => setRoleEditName(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setRoleEditOpen(false)}
                    disabled={roleEditSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={roleEditSaving}
                  >
                    {roleEditSaving ? "Сохранение…" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALS: Employees create/edit */}
      {empCreateOpen && (
        <div className="barbermasters__overlay" onClick={() => !empSaving && setEmpCreateOpen(false)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Новый сотрудник</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !empSaving && setEmpCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {empAlerts.length > 0 && (
              <div className="barbermasters__alert barbermasters__alert--inModal">
                {empAlerts.length === 1 ? (
                  empAlerts[0]
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {empAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form className="barbermasters__form" onSubmit={submitEmployeeCreate} noValidate>
              <div className="barbermasters__grid">
                <label className={`barbermasters__field ${empFieldErrors.email ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Email <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="email"
                    type="email"
                    className={`barbermasters__input ${empFieldErrors.email ? "barbermasters__input--invalid" : ""}`}
                    placeholder="user@mail.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </label>

                <label className={`barbermasters__field ${empFieldErrors.first_name ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Имя <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="first_name"
                    className={`barbermasters__input ${empFieldErrors.first_name ? "barbermasters__input--invalid" : ""}`}
                    placeholder="Имя"
                    value={empForm.first_name}
                    onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
                    required
                  />
                </label>

                <label className={`barbermasters__field ${empFieldErrors.last_name ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Фамилия <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="last_name"
                    className={`barbermasters__input ${empFieldErrors.last_name ? "barbermasters__input--invalid" : ""}`}
                    placeholder="Фамилия"
                    value={empForm.last_name}
                    onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
                    required
                  />
                </label>

                <label className={`barbermasters__field barbermasters__field--full ${empFieldErrors.roleChoice ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Роль <b className="barbermasters__req">*</b>
                  </span>
                  <select
                    name="roleChoice"
                    className={`barbermasters__input ${empFieldErrors.roleChoice ? "barbermasters__input--invalid" : ""}`}
                    value={empForm.roleChoice}
                    onChange={(e) => setEmpForm((p) => ({ ...p, roleChoice: e.target.value }))}
                    required
                  >
                    <option value="">Выберите роль</option>
                    {roleOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setEmpCreateOpen(false)}
                    disabled={empSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={empSaving}
                  >
                    {empSaving ? "Сохранение…" : "Создать сотрудника"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {empEditOpen && (
        <div className="barbermasters__overlay" onClick={() => !empSaving && setEmpEditOpen(false)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Редактировать сотрудника</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !empSaving && setEmpEditOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {empAlerts.length > 0 && (
              <div className="barbermasters__alert barbermasters__alert--inModal">
                {empAlerts.length === 1 ? (
                  empAlerts[0]
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {empAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form className="barbermasters__form" onSubmit={submitEmployeeEdit} noValidate>
              <div className="barbermasters__grid">
                <label className={`barbermasters__field ${empFieldErrors.email ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Email <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="email"
                    type="email"
                    className={`barbermasters__input ${empFieldErrors.email ? "barbermasters__input--invalid" : ""}`}
                    placeholder="user@mail.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </label>

                <label className={`barbermasters__field ${empFieldErrors.first_name ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Имя <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="first_name"
                    className={`barbermasters__input ${empFieldErrors.first_name ? "barbermasters__input--invalid" : ""}`}
                    placeholder="Имя"
                    value={empForm.first_name}
                    onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
                    required
                  />
                </label>

                <label className={`barbermasters__field ${empFieldErrors.last_name ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Фамилия <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="last_name"
                    className={`barbermasters__input ${empFieldErrors.last_name ? "barbermasters__input--invalid" : ""}`}
                    placeholder="Фамилия"
                    value={empForm.last_name}
                    onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
                    required
                  />
                </label>

                <label className={`barbermasters__field barbermasters__field--full ${empFieldErrors.roleChoice ? "barbermasters__field--invalid" : ""}`}>
                  <span className="barbermasters__label">
                    Роль <b className="barbermasters__req">*</b>
                  </span>
                  <select
                    name="roleChoice"
                    className={`barbermasters__input ${empFieldErrors.roleChoice ? "barbermasters__input--invalid" : ""}`}
                    value={empForm.roleChoice}
                    onChange={(e) => setEmpForm((p) => ({ ...p, roleChoice: e.target.value }))}
                    required
                  >
                    <option value="">Выберите роль</option>
                    {roleOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setEmpEditOpen(false)}
                    disabled={empSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={empSaving}
                  >
                    {empSaving ? "Сохранение…" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Credentials */}
      {openLogin && (
        <div className="barbermasters__overlay" onClick={() => setOpenLogin(false)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Логин сотрудника</h3>
              <button className="barbermasters__iconBtn" onClick={() => setOpenLogin(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>
            <div className="barbermasters__content">
              <p className="barbermasters__label">
                Логин: <b>{employData?.email}</b>
                <button
                  className="barbermasters__iconBtn barbermasters__copyBtn"
                  onClick={() => copyToClipboard(employData?.email || "", "email")}
                  aria-label="Скопировать логин"
                  title={copied === "email" ? "Скопировано!" : "Скопировать"}
                >
                  {copied === "email" ? <FaCheck /> : <FaCopy />}
                </button>
              </p>

              <p className="barbermasters__label">
                Пароль: <b>{employData?.generated_password}</b>
                <button
                  className="barbermasters__iconBtn barbermasters__copyBtn"
                  onClick={() => copyToClipboard(employData?.generated_password || "", "password")}
                  aria-label="Скопировать пароль"
                  title={copied === "password" ? "Скопировано!" : "Скопировать"}
                >
                  {copied === "password" ? <FaCheck /> : <FaCopy />}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM: remove role */}
      {roleToDelete && (
        <div className="barbermasters__overlay" onClick={() => setRoleToDelete(null)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Удалить роль</h3>
              <button className="barbermasters__iconBtn" onClick={() => setRoleToDelete(null)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>
            <div className="barbermasters__content">
              Вы действительно хотите удалить роль «{roleToDelete.name || "—"}»? Действие необратимо.
            </div>
            <div className="barbermasters__footer">
              <span className="barbermasters__spacer" />
              <div className="barbermasters__footerRight">
                <button className="barbermasters__btn barbermasters__btn--secondary" onClick={() => setRoleToDelete(null)}>
                  Отмена
                </button>
                <button
                  className="barbermasters__btn barbermasters__btn--danger"
                  onClick={doRemoveRole}
                  disabled={roleDeletingIds.has(roleToDelete.id)}
                >
                  {roleDeletingIds.has(roleToDelete.id) ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM: remove employee */}
      {empToDelete && (
        <div className="barbermasters__overlay" onClick={() => setEmpToDelete(null)}>
          <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Удалить сотрудника</h3>
              <button className="barbermasters__iconBtn" onClick={() => setEmpToDelete(null)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>
            <div className="barbermasters__content">
              Удалить «{fullName(empToDelete) || empToDelete.email || "—"}»? Действие необратимо.
            </div>
            <div className="barbermasters__footer">
              <span className="barbermasters__spacer" />
              <div className="barbermasters__footerRight">
                <button className="barbermasters__btn barbermasters__btn--secondary" onClick={() => setEmpToDelete(null)}>
                  Отмена
                </button>
                <button
                  className="barbermasters__btn barbermasters__btn--danger"
                  onClick={doRemoveEmployee}
                  disabled={empDeletingIds.has(empToDelete.id)}
                >
                  {empDeletingIds.has(empToDelete.id) ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Masters;
