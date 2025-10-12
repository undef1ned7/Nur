// // src/components/Education/Leads.jsx
// // ВАЖНО: проверьте путь импорта api!
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FaPlus,
//   FaSearch,
//   FaTimes,
//   FaExchangeAlt,
//   FaTrash,
//   FaEdit,
// } from "react-icons/fa";
// import "./Leads.scss";
// import api from "../../../../api";

// /* ===== API endpoints ===== */
// const LEADS_EP = "/education/leads/";
// const COURSES_EP = "/education/courses/";
// const GROUPS_EP = "/education/groups/";
// const STUDENTS_EP = "/education/students/";

// /* ===== constants (универсальные подписи) ===== */
// const SOURCE_OPTIONS = [
//   { value: "instagram", label: "Instagram" },
//   { value: "whatsapp", label: "WhatsApp" },
//   { value: "telegram", label: "Telegram" },
// ];
// const LS = { INVOICES: "invoices" };

// /* ===== utils ===== */
// const asArray = (data) =>
//   Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

// const normalizeLead = (l = {}) => ({
//   id: l.id,
//   name: l.name ?? "",
//   phone: l.phone ?? "",
//   source: (l.source || "instagram").toLowerCase(),
//   note: l.note ?? "",
//   created_at: l.created_at ?? "",
// });

// const normalizeCourse = (c = {}) => ({
//   id: c.id,
//   name: c.title ?? "",
//   price: Number(String(c.price_per_month ?? "0").replace(",", ".")),
// });

// const normalizeGroup = (g = {}) => ({
//   id: g.id,
//   name: g.name ?? "",
//   courseId: g.course ?? "",
// });

// const normalizeStudent = (s = {}) => ({
//   id: s.id,
//   name: s.name ?? "",
//   phone: s.phone ?? "",
//   group: s.group ?? null,
// });

// const lc = (s) => String(s || "").trim().toLowerCase();
// const digits = (s) => String(s || "").replace(/\D/g, "");
// const isPhoneLike = (s) => {
//   const d = digits(s);
//   return d.length === 0 || (d.length >= 9 && d.length <= 15);
// };
// const allowedSource = (s) =>
//   SOURCE_OPTIONS.some((o) => o.value === lc(s)) ? lc(s) : "instagram";

// const cleanSpaces = (s) => String(s || "").replace(/\s+/g, " ").trim();
// const isNameValid = (s) => {
//   const v = cleanSpaces(s);
//   if (v.length < 2 || v.length > 80) return false;
//   if (!/[A-Za-zА-Яа-яЁёӨөҮүҚқҒғІіҺһ\s'-]/.test(v)) return false;
//   return true;
// };
// const sanitizeNote = (s) => cleanSpaces(String(s || "").slice(0, 500));

// const todayISO = () => new Date().toISOString().slice(0, 10);
// const ym = (iso = todayISO()) => iso.slice(0, 7);
// const uid = () => Date.now();
// const invoiceNum = () => {
//   const d = new Date();
//   const y = String(d.getFullYear()).slice(-2);
//   const m = String(d.getMonth() + 1).padStart(2, "0");
//   const dd = String(d.getDate()).padStart(2, "0");
//   return `INV-${y}${m}${dd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
// };

// const SchoolLeads = () => {
//   /* data */
//   const [leads, setLeads] = useState([]);
//   const [courses, setCourses] = useState([]);
//   const [groups, setGroups] = useState([]);
//   const [students, setStudents] = useState([]); // <-- для проверки дублей при зачислении

//   /* ui */
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [convertSaving, setConvertSaving] = useState(false);
//   const [error, setError] = useState("");            // страничные ошибки
//   const [modalError, setModalError] = useState("");  // ошибки в модалке заявки
//   const [convertError, setConvertError] = useState("");// ошибки в модалке зачисления
//   const [query, setQuery] = useState("");
//   const [deletingIds, setDeletingIds] = useState(new Set());

//   /* modal: lead */
//   const emptyForm = { id: null, name: "", phone: "", source: "instagram", note: "" };
//   const [isModalOpen, setModalOpen] = useState(false);
//   const [mode, setMode] = useState("create");
//   const [form, setForm] = useState(emptyForm);

//   /* modal: convert */
//   const [isConvertOpen, setConvertOpen] = useState(false);
//   const [convert, setConvert] = useState({ leadId: null, courseId: "", groupId: "", discount: 0 });

//   /* load */
//   const fetchAll = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const [le, cr, gr, st] = await Promise.all([
//         api.get(LEADS_EP),
//         api.get(COURSES_EP),
//         api.get(GROUPS_EP),
//         api.get(STUDENTS_EP), // <-- подгружаем учеников
//       ]);
//       setLeads(asArray(le.data).map(normalizeLead));
//       setCourses(asArray(cr.data).map(normalizeCourse));
//       setGroups(asArray(gr.data).map(normalizeGroup));
//       setStudents(asArray(st.data).map(normalizeStudent));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось загрузить данные.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchAll();
//   }, [fetchAll]);

//   /* search */
//   const filtered = useMemo(() => {
//     const t = query.toLowerCase().trim();
//     if (!t) return leads;
//     return leads.filter((x) =>
//       [x.name, x.phone, x.source, x.note].some((v) => String(v || "").toLowerCase().includes(t))
//     );
//   }, [leads, query]);

//   /* дубль заявок */
//   const hasDuplicateCreate = (name, phone, source) => {
//     const phoneD = digits(phone);
//     const nameLc = lc(name);
//     if (phoneD && leads.some((l) => digits(l.phone) === phoneD)) return true;
//     if (!phoneD && leads.some((l) => lc(l.name) === nameLc && lc(l.source) === source)) return true;
//     return false;
//   };
//   const hasDuplicateEdit = (id, name, phone, source) => {
//     const phoneD = digits(phone);
//     const nameLc = lc(name);
//     if (phoneD && leads.some((l) => l.id !== id && digits(l.phone) === phoneD)) return true;
//     if (!phoneD && leads.some((l) => l.id !== id && lc(l.name) === nameLc && lc(l.source) === source)) return true;
//     return false;
//   };

//   /* дубль УЧЕНИКА при зачислении из заявки */
//   const studentDuplicateExists = (leadName, leadPhone, targetGroupId) => {
//     const phoneD = digits(leadPhone);
//     const nameLc = lc(leadName);
//     if (phoneD) {
//       // телефон уникален во всей базе учеников
//       if (students.some((s) => digits(s.phone) === phoneD)) return true;
//     } else {
//       // без телефона — не даём создать одинаковое имя в той же группе
//       if (
//         students.some(
//           (s) => lc(s.name) === nameLc && String(s.group || "") === String(targetGroupId || "")
//         )
//       )
//         return true;
//     }
//     return false;
//   };

//   /* lead modal */
//   const openCreate = () => {
//     setMode("create");
//     setForm(emptyForm);
//     setModalError("");
//     setModalOpen(true);
//   };
//   const openEdit = (lead) => {
//     setMode("edit");
//     setForm({
//       id: lead.id,
//       name: lead.name || "",
//       phone: lead.phone || "",
//       source: (lead.source || "instagram").toLowerCase(),
//       note: lead.note || "",
//     });
//     setModalError("");
//     setModalOpen(true);
//   };
//   const closeModal = () => {
//     setModalOpen(false);
//     setForm(emptyForm);
//     setModalError("");
//   };

//   const submitLead = async (e) => {
//     e.preventDefault();
//     if (saving) return;

//     const name = cleanSpaces(form.name);
//     const phone = cleanSpaces(form.phone);
//     const src = allowedSource(form.source);
//     const note = sanitizeNote(form.note);

//     if (!isNameValid(name)) {
//       setModalError("Имя должно быть 2–80 символов и не состоять только из цифр/знаков.");
//       return;
//     }
//     if (!isPhoneLike(phone)) {
//       setModalError("Телефон укажите 9–15 цифр (можно оставить пустым).");
//       return;
//     }

//     if (mode === "create" && hasDuplicateCreate(name, phone, src)) {
//       setModalError("Дубликат: заявка с таким телефоном или (имя+источник) уже есть.");
//       return;
//     }
//     if (mode === "edit" && hasDuplicateEdit(form.id, name, phone, src)) {
//       setModalError("Дубликат: другая заявка использует этот телефон или (имя+источник).");
//       return;
//     }

//     setSaving(true);
//     setModalError("");
//     try {
//       const payloadBase = { name, source: src, note };
//       if (mode === "create") {
//         const payload = phone ? { ...payloadBase, phone } : payloadBase;
//         const { data } = await api.post(LEADS_EP, payload);
//         const created = normalizeLead(data || payload);
//         if (!created.id) await fetchAll();
//         else setLeads((prev) => [created, ...prev]);
//       } else {
//         const payload = { ...payloadBase, phone: phone || "" };
//         const { data } = await api.put(`${LEADS_EP}${form.id}/`, payload);
//         const updated = normalizeLead(data || { id: form.id, ...payload });
//         setLeads((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
//       }
//       setSaving(false);
//       closeModal();
//     } catch (e2) {
//       console.error("request submit error:", e2);
//       setModalError(mode === "create" ? "Не удалось создать заявку." : "Не удалось обновить заявку.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* delete */
//   const removeLead = async (id) => {
//     setDeletingIds((p) => new Set(p).add(id));
//     try {
//       await api.delete(`${LEADS_EP}${id}/`);
//       setLeads((prev) => prev.filter((x) => x.id !== id));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось удалить заявку.");
//     } finally {
//       setDeletingIds((prev) => {
//         const n = new Set(prev);
//         n.delete(id);
//         return n;
//       });
//     }
//   };

//   /* convert */
//   const openConvert = (lead) => {
//     setConvert({ leadId: lead.id, courseId: "", groupId: "", discount: 0 });
//     setConvertError("");
//     setConvertOpen(true);
//   };
//   const closeConvert = () => {
//     setConvertOpen(false);
//     setConvertError("");
//   };

//   const submitConvert = async (e) => {
//     e.preventDefault();
//     if (convertSaving) return;

//     const lead = leads.find((l) => l.id === convert.leadId);
//     if (!lead) return;

//     if (!convert.courseId || !convert.groupId) {
//       setConvertError("Выберите программу и группу для зачисления.");
//       return;
//     }
//     const group = groups.find((g) => String(g.id) === String(convert.groupId));
//     if (!group || String(group.courseId) !== String(convert.courseId)) {
//       setConvertError("Выбрана некорректная группа для выбранной программы.");
//       return;
//     }

//     // --- ГЛАВНОЕ: проверка дублей учеников перед созданием ---
//     if (studentDuplicateExists(lead.name, lead.phone, convert.groupId)) {
//       setConvertError(
//         "Дубликат: такой ученик уже есть (по телефону или по связке «имя+группа»)."
//       );
//       return;
//     }

//     const course = courses.find((c) => String(c.id) === String(convert.courseId));
//     const decStr = String(convert.discount ?? 0).replace(",", ".");
//     const discountNum = Number(decStr);
//     if (!Number.isFinite(discountNum) || discountNum < 0) {
//       setConvertError("Скидка должна быть числом ≥ 0.");
//       return;
//     }
//     if (course && Number.isFinite(course.price) && discountNum > Number(course.price)) {
//       setConvertError("Скидка не может быть больше стоимости программы.");
//       return;
//     }

//     setConvertSaving(true);
//     setConvertError("");
//     try {
//       const payload = {
//         name: cleanSpaces(lead.name),
//         phone: lead.phone ? String(lead.phone).trim() : "",
//         status: "active",
//         group: convert.groupId,
//         discount: decStr,
//         note: sanitizeNote(lead.note),
//       };
//       const { data: stData } = await api.post(STUDENTS_EP, payload);

//       // авто-счёт (оставлено)
//       const studentId = stData?.id;
//       const studentName = stData?.name || lead.name;
//       if (studentId && course && course.price) {
//         const invoices = JSON.parse(localStorage.getItem(LS.INVOICES) || "[]");
//         const already = invoices.some(
//           (inv) => inv.studentId === studentId && inv.period === ym(todayISO())
//         );
//         if (!already) {
//           const price = Number(course.price || 0);
//           const amount = Math.max(0, price - discountNum);
//           const inv = {
//             id: uid(),
//             number: invoiceNum(),
//             studentId,
//             studentName,
//             courseId: course.id,
//             courseName: course.name,
//             groupId: group?.id || "",
//             groupName: group?.name || "",
//             price,
//             months: 1,
//             discount: discountNum,
//             amount,
//             method: "",
//             date: todayISO(),
//             dueDate: todayISO(),
//             status: "unpaid",
//             note: "Автосчёт при зачислении",
//             period: ym(todayISO()),
//             createdAt: Date.now(),
//           };
//           localStorage.setItem(LS.INVOICES, JSON.stringify([inv, ...invoices]));
//         }
//       }

//       try { await api.delete(`${LEADS_EP}${lead.id}/`); } catch {}
//       setLeads((prev) => prev.filter((x) => x.id !== lead.id));

//       // локально обновим список учеников, чтобы дальше корректно ловить дубли
//       setStudents((prev) => [
//         ...prev,
//         normalizeStudent({ id: stData?.id, name: payload.name, phone: payload.phone, group: payload.group }),
//       ]);

//       setConvertSaving(false);
//       closeConvert();
//     } catch (e2) {
//       console.error("convert error:", e2);
//       setConvertError("Не удалось зачислить ученика.");
//     } finally {
//       setConvertSaving(false);
//     }
//   };

//   return (
//     <div className="school-leads">
//       <header className="school-leads__header">
//         <div className="school-leads__head">
//           <h2 className="school-leads__title">Заявки</h2>
//           <p className="school-leads__subtitle">Список заявок. Зачисляйте учеников.</p>
//         </div>

//         <div className="school-leads__toolbar">
//           <label className="school-leads__search">
//             <FaSearch className="school-leads__search-icon" aria-hidden />
//             <input
//               className="school-leads__search-input"
//               placeholder="Поиск по заявкам…"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               aria-label="Поиск по заявкам"
//             />
//           </label>

//           <button
//             className="school-leads__btn school-leads__btn--primary"
//             onClick={openCreate}
//             type="button"
//           >
//             <FaPlus /> Создать заявку
//           </button>
//         </div>
//       </header>

//       {loading && <div className="school-leads__alert">Загрузка…</div>}
//       {!!error && !loading && <div className="school-leads__alert" role="alert">{error}</div>}

//       {!loading && !error && (
//         <div className="school-leads__list">
//           {filtered.map((l) => {
//             const initial = (l.name || "•").charAt(0).toUpperCase();
//             const srcLabel = SOURCE_OPTIONS.find((o) => o.value === l.source)?.label || l.source;
//             const deleting = deletingIds.has(l.id);

//             return (
//               <article key={l.id} className="school-leads__card">
//                 <div className="school-leads__card-main">
//                   <div className="school-leads__avatar" aria-hidden>{initial}</div>

//                   <div className="school-leads__info">
//                     <div className="school-leads__row">
//                       <h3 className="school-leads__name">{l.name}</h3>
//                       <span className="school-leads__phone">{l.phone || "—"}</span>
//                     </div>
//                     <div className="school-leads__meta">
//                       <span>Источник: {srcLabel}</span>
//                       {l.note && <span className="school-leads__note">Заметка: {l.note}</span>}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="school-leads__actions">
//                   <button
//                     className="school-leads__btn school-leads__btn--secondary"
//                     onClick={() => openEdit(l)}
//                     type="button"
//                     title="Изменить заявку"
//                   >
//                     <FaEdit /> Изменить
//                   </button>

//                   <button
//                     className="school-leads__btn school-leads__btn--secondary"
//                     onClick={() => openConvert(l)}
//                     type="button"
//                     title="Зачислить ученика"
//                   >
//                     <FaExchangeAlt /> Зачислить
//                   </button>

//                   <button
//                     className="school-leads__btn school-leads__btn--danger"
//                     onClick={() => removeLead(l.id)}
//                     type="button"
//                     disabled={deleting}
//                     title="Удалить заявку"
//                   >
//                     <FaTrash /> {deleting ? "Удаление…" : "Удалить"}
//                   </button>
//                 </div>
//               </article>
//             );
//           })}

//           {filtered.length === 0 && (
//             <div className="school-leads__alert">Заявки не найдены.</div>
//           )}
//         </div>
//       )}

//       {/* Lead modal */}
//       {isModalOpen && (
//         <div className="school-leads__modal-overlay" role="dialog" aria-modal="true">
//           <div className="school-leads__modal">
//             <div className="school-leads__modal-header">
//               <h3 className="school-leads__modal-title">
//                 {mode === "create" ? "Новая заявка" : "Изменить заявку"}
//               </h3>
//               <button className="school-leads__icon-btn" onClick={closeModal} type="button" aria-label="Закрыть">
//                 <FaTimes />
//               </button>
//             </div>

//             {!!modalError && (
//               <div className="school-leads__alert" role="alert" style={{margin:"0 16px"}}>
//                 {modalError}
//               </div>
//             )}

//             <form className="school-leads__form" onSubmit={submitLead} noValidate>
//               <div className="school-leads__form-grid">
//                 <div className="school-leads__field">
//                   <label className="school-leads__label">
//                     Имя <span className="school-leads__req">*</span>
//                   </label>
//                   <input
//                     className="school-leads__input"
//                     value={form.name}
//                     onChange={(e) => setForm({ ...form, name: e.target.value })}
//                     maxLength={80}
//                     required
//                   />
//                 </div>

//                 <div className="school-leads__field">
//                   <label className="school-leads__label">Телефон</label>
//                   <input
//                     className="school-leads__input"
//                     value={form.phone}
//                     onChange={(e) => setForm({ ...form, phone: e.target.value })}
//                     inputMode="tel"
//                     placeholder="+996..."
//                     pattern="^(\+?\d{9,15})?$"
//                     title="9–15 цифр, можно с + в начале"
//                   />
//                 </div>

//                 <div className="school-leads__field">
//                   <label className="school-leads__label">Источник</label>
//                   <select
//                     className="school-leads__input"
//                     value={form.source}
//                     onChange={(e) => setForm({ ...form, source: e.target.value })}
//                   >
//                     {SOURCE_OPTIONS.map((o) => (
//                       <option key={o.value} value={o.value}>{o.label}</option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="school-leads__field school-leads__field--full">
//                   <label className="school-leads__label">Заметка</label>
//                   <textarea
//                     className="school-leads__textarea"
//                     value={form.note}
//                     onChange={(e) => setForm({ ...form, note: e.target.value })}
//                     maxLength={500}
//                   />
//                 </div>
//               </div>

//               <div className="school-leads__form-actions">
//                 <span className="school-leads__actions-spacer" />
//                 <div className="school-leads__actions-right">
//                   <button
//                     type="button"
//                     className="school-leads__btn school-leads__btn--secondary"
//                     onClick={closeModal}
//                     disabled={saving}
//                   >
//                     Отмена
//                   </button>
//                   <button type="submit" className="school-leads__btn school-leads__btn--primary" disabled={saving}>
//                     {saving
//                       ? mode === "create"
//                         ? "Сохранение…"
//                         : "Обновление…"
//                       : mode === "create"
//                       ? "Сохранить"
//                       : "Сохранить изменения"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* Convert modal */}
//       {isConvertOpen && (
//         <div className="school-leads__modal-overlay" role="dialog" aria-modal="true">
//           <div className="school-leads__modal">
//             <div className="school-leads__modal-header">
//               <h3 className="school-leads__modal-title">Зачисление ученика</h3>
//               <button
//                 className="school-leads__icon-btn"
//                 onClick={closeConvert}
//                 type="button"
//                 aria-label="Закрыть"
//                 disabled={convertSaving}
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {!!convertError && (
//               <div className="school-leads__alert" role="alert" style={{margin:"0 16px"}}>
//                 {convertError}
//               </div>
//             )}

//             <form className="school-leads__form" onSubmit={submitConvert} noValidate>
//               <div className="school-leads__form-grid">
//                 <div className="school-leads__field">
//                   <label className="school-leads__label">
//                     Программа <span className="school-leads__req">*</span>
//                   </label>
//                   <select
//                     className="school-leads__input"
//                     value={convert.courseId}
//                     onChange={(e) =>
//                       setConvert({ ...convert, courseId: e.target.value, groupId: "" })
//                     }
//                     required
//                   >
//                     <option value="">— выберите —</option>
//                     {courses.map((c) => (
//                       <option key={c.id} value={c.id}>{c.name}</option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="school-leads__field">
//                   <label className="school-leads__label">
//                     Группа <span className="school-leads__req">*</span>
//                   </label>
//                   <select
//                     className="school-leads__input"
//                     value={convert.groupId}
//                     onChange={(e) => setConvert({ ...convert, groupId: e.target.value })}
//                     required
//                   >
//                     <option value="">— выберите —</option>
//                     {groups
//                       .filter((g) => String(g.courseId) === String(convert.courseId))
//                       .map((g) => (
//                         <option key={g.id} value={g.id}>{g.name}</option>
//                       ))}
//                   </select>
//                 </div>

//                 <div className="school-leads__field">
//                   <label className="school-leads__label">Скидка (сом)</label>
//                   <input
//                     className="school-leads__input"
//                     type="number"
//                     min="0"
//                     step="1"
//                     value={convert.discount}
//                     onChange={(e) => setConvert({ ...convert, discount: e.target.value })}
//                   />
//                 </div>
//               </div>

//               <div className="school-leads__form-actions">
//                 <span className="school-leads__actions-spacer" />
//                 <div className="school-leads__actions-right">
//                   <button
//                     type="button"
//                     className="school-leads__btn school-leads__btn--secondary"
//                     onClick={closeConvert}
//                     disabled={convertSaving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="school-leads__btn school-leads__btn--primary"
//                     disabled={convertSaving}
//                   >
//                     Зачислить и выставить счёт
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default SchoolLeads;



// src/components/Education/Leads.jsx
// ВАЖНО: проверьте путь импорта api!
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaTimes,
  FaExchangeAlt,
  FaTrash,
  FaEdit,
} from "react-icons/fa";
import "./Leads.scss";
import api from "../../../../api";

/* ===== API endpoints ===== */
const LEADS_EP = "/education/leads/";
const COURSES_EP = "/education/courses/";
const GROUPS_EP = "/education/groups/";
const STUDENTS_EP = "/education/students/";

/* ===== constants ===== */
const SOURCE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
];
const LS = { INVOICES: "invoices" };
const PAGE_SIZE = 15;

/* ===== utils ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const normalizeLead = (l = {}) => ({
  id: l.id,
  name: l.name ?? "",
  phone: l.phone ?? "",
  source: (l.source || "instagram").toLowerCase(),
  note: l.note ?? "",
  created_at: l.created_at ?? "",
});

const normalizeCourse = (c = {}) => ({
  id: c.id,
  name: c.title ?? "",
  price: Number(String(c.price_per_month ?? "0").replace(",", ".")),
});

const normalizeGroup = (g = {}) => ({
  id: g.id,
  name: g.name ?? "",
  courseId: g.course ?? "",
});

const normalizeStudent = (s = {}) => ({
  id: s.id,
  name: s.name ?? "",
  phone: s.phone ?? "",
  group: s.group ?? null,
});

const lc = (s) => String(s || "").trim().toLowerCase();
const digits = (s) => String(s || "").replace(/\D/g, "");
const isPhoneLike = (s) => {
  const d = digits(s);
  return d.length === 0 || (d.length >= 9 && d.length <= 15);
};
const allowedSource = (s) =>
  SOURCE_OPTIONS.some((o) => o.value === lc(s)) ? lc(s) : "instagram";

const cleanSpaces = (s) => String(s || "").replace(/\s+/g, " ").trim();
const isNameValid = (s) => {
  const v = cleanSpaces(s);
  if (v.length < 2 || v.length > 80) return false;
  if (!/[A-Za-zА-Яа-яЁёӨөҮүҚқҒғІіҺһ\s'-]/.test(v)) return false;
  return true;
};
const sanitizeNote = (s) => cleanSpaces(String(s || "").slice(0, 500));

const todayISO = () => new Date().toISOString().slice(0, 10);
const ym = (iso = todayISO()) => iso.slice(0, 7);
const uid = () => Date.now();
const invoiceNum = () => {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `INV-${y}${m}${dd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

const SchoolLeads = () => {
  /* data */
  const [leads, setLeads] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]); // для проверки дублей при зачислении

  /* ui */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertSaving, setConvertSaving] = useState(false);
  const [error, setError] = useState("");             // страничные ошибки
  const [modalError, setModalError] = useState("");   // ошибки в модалке заявки
  const [convertError, setConvertError] = useState("");// ошибки в модалке зачисления
  const [query, setQuery] = useState("");
  const [deletingIds, setDeletingIds] = useState(new Set());

  /* pagination */
  const [page, setPage] = useState(1);

  /* confirm (удаление) */
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });
  const askDeleteLead = (lead) =>
    setConfirm({ open: true, id: lead.id, name: lead.name || "—" });
  const closeConfirm = () => setConfirm({ open: false, id: null, name: "" });

  /* modal: lead */
  const emptyForm = { id: null, name: "", phone: "", source: "instagram", note: "" };
  const [isModalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [form, setForm] = useState(emptyForm);

  /* modal: convert */
  const [isConvertOpen, setConvertOpen] = useState(false);
  const [convert, setConvert] = useState({ leadId: null, courseId: "", groupId: "", discount: 0 });

  /* load */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [le, cr, gr, st] = await Promise.all([
        api.get(LEADS_EP),
        api.get(COURSES_EP),
        api.get(GROUPS_EP),
        api.get(STUDENTS_EP),
      ]);
      setLeads(asArray(le.data).map(normalizeLead));
      setCourses(asArray(cr.data).map(normalizeCourse));
      setGroups(asArray(gr.data).map(normalizeGroup));
      setStudents(asArray(st.data).map(normalizeStudent));
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* search + pagination */
  const filtered = useMemo(() => {
    const t = query.toLowerCase().trim();
    if (!t) return leads;
    return leads.filter((x) =>
      [x.name, x.phone, x.source, x.note].some((v) => String(v || "").toLowerCase().includes(t))
    );
  }, [leads, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [query, filtered.length]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const pagesWindow = useMemo(() => {
    const around = 2;
    const start = Math.max(1, page - around);
    const end = Math.min(totalPages, page + around);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  /* дубли заявок */
  const hasDuplicateCreate = (name, phone, source) => {
    const phoneD = digits(phone);
    const nameLc = lc(name);
    if (phoneD && leads.some((l) => digits(l.phone) === phoneD)) return true;
    if (!phoneD && leads.some((l) => lc(l.name) === nameLc && lc(l.source) === source)) return true;
    return false;
  };
  const hasDuplicateEdit = (id, name, phone, source) => {
    const phoneD = digits(phone);
    const nameLc = lc(name);
    if (phoneD && leads.some((l) => l.id !== id && digits(l.phone) === phoneD)) return true;
    if (!phoneD && leads.some((l) => l.id !== id && lc(l.name) === nameLc && lc(l.source) === source)) return true;
    return false;
  };

  /* дубль УЧЕНИКА при зачислении из заявки */
  const studentDuplicateExists = (leadName, leadPhone, targetGroupId) => {
    const phoneD = digits(leadPhone);
    const nameLc = lc(leadName);
    if (phoneD) {
      if (students.some((s) => digits(s.phone) === phoneD)) return true;
    } else {
      if (students.some((s) => lc(s.name) === nameLc && String(s.group || "") === String(targetGroupId || "")))
        return true;
    }
    return false;
  };

  /* lead modal */
  const openCreate = () => {
    setMode("create");
    setForm(emptyForm);
    setModalError("");
    setModalOpen(true);
  };
  const openEdit = (lead) => {
    setMode("edit");
    setForm({
      id: lead.id,
      name: lead.name || "",
      phone: lead.phone || "",
      source: (lead.source || "instagram").toLowerCase(),
      note: lead.note || "",
    });
    setModalError("");
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
    setModalError("");
  };

  const submitLead = async (e) => {
    e.preventDefault();
    if (saving) return;

    const name = cleanSpaces(form.name);
    const phone = cleanSpaces(form.phone);
    const src = allowedSource(form.source);
    const note = sanitizeNote(form.note);

    if (!isNameValid(name)) {
      setModalError("Имя должно быть 2–80 символов и не состоять только из цифр/знаков.");
      return;
    }
    if (!isPhoneLike(phone)) {
      setModalError("Телефон укажите 9–15 цифр (можно оставить пустым).");
      return;
    }

    if (mode === "create" && hasDuplicateCreate(name, phone, src)) {
      setModalError("Дубликат: заявка с таким телефоном или (имя+источник) уже есть.");
      return;
    }
    if (mode === "edit" && hasDuplicateEdit(form.id, name, phone, src)) {
      setModalError("Дубликат: другая заявка использует этот телефон или (имя+источник).");
      return;
    }

    setSaving(true);
    setModalError("");
    try {
      const payloadBase = { name, source: src, note };
      if (mode === "create") {
        const payload = phone ? { ...payloadBase, phone } : payloadBase;
        const { data } = await api.post(LEADS_EP, payload);
        const created = normalizeLead(data || payload);
        if (!created.id) await fetchAll();
        else setLeads((prev) => [created, ...prev]);
      } else {
        const payload = { ...payloadBase, phone: phone || "" };
        const { data } = await api.put(`${LEADS_EP}${form.id}/`, payload);
        const updated = normalizeLead(data || { id: form.id, ...payload });
        setLeads((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      }
      closeModal();
    } catch (e2) {
      console.error(e2);
      setModalError(mode === "create" ? "Не удалось создать заявку." : "Не удалось обновить заявку.");
    } finally {
      setSaving(false);
    }
  };

  /* delete */
  const removeLead = async (id) => {
    setDeletingIds((p) => new Set(p).add(id));
    try {
      await api.delete(`${LEADS_EP}${id}/`);
      setLeads((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить заявку.");
    } finally {
      setDeletingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const confirmYes = async () => {
    const id = confirm.id;
    closeConfirm();
    if (!id) return;
    await removeLead(id);
  };

  /* convert */
  const openConvert = (lead) => {
    setConvert({ leadId: lead.id, courseId: "", groupId: "", discount: 0 });
    setConvertError("");
    setConvertOpen(true);
  };
  const closeConvert = () => {
    setConvertOpen(false);
    setConvertError("");
  };

  const submitConvert = async (e) => {
    e.preventDefault();
    if (convertSaving) return;

    const lead = leads.find((l) => l.id === convert.leadId);
    if (!lead) return;

    if (!convert.courseId || !convert.groupId) {
      setConvertError("Выберите программу и группу для зачисления.");
      return;
    }
    const group = groups.find((g) => String(g.id) === String(convert.groupId));
    if (!group || String(group.courseId) !== String(convert.courseId)) {
      setConvertError("Выбрана некорректная группа для выбранной программы.");
      return;
    }

    if (studentDuplicateExists(lead.name, lead.phone, convert.groupId)) {
      setConvertError("Дубликат: такой ученик уже есть (по телефону или по связке «имя+группа»).");
      return;
    }

    const course = courses.find((c) => String(c.id) === String(convert.courseId));
    const decStr = String(convert.discount ?? 0).replace(",", ".");
    const discountNum = Number(decStr);
    if (!Number.isFinite(discountNum) || discountNum < 0) {
      setConvertError("Скидка должна быть числом ≥ 0.");
      return;
    }
    if (course && Number.isFinite(course.price) && discountNum > Number(course.price)) {
      setConvertError("Скидка не может быть больше стоимости программы.");
      return;
    }

    setConvertSaving(true);
    setConvertError("");
    try {
      const payload = {
        name: cleanSpaces(lead.name),
        phone: lead.phone ? String(lead.phone).trim() : "",
        status: "active",
        group: convert.groupId,
        discount: decStr,
        note: sanitizeNote(lead.note),
      };
      const { data: stData } = await api.post(STUDENTS_EP, payload);

      // авто-счёт в локальном LS (как было)
      const studentId = stData?.id;
      const studentName = stData?.name || lead.name;
      if (studentId && course && course.price) {
        const invoices = JSON.parse(localStorage.getItem(LS.INVOICES) || "[]");
        const already = invoices.some(
          (inv) => inv.studentId === studentId && inv.period === ym(todayISO())
        );
        if (!already) {
          const price = Number(course.price || 0);
          const amount = Math.max(0, price - discountNum);
          const inv = {
            id: uid(),
            number: invoiceNum(),
            studentId,
            studentName,
            courseId: course.id,
            courseName: course.name,
            groupId: group?.id || "",
            groupName: group?.name || "",
            price,
            months: 1,
            discount: discountNum,
            amount,
            method: "",
            date: todayISO(),
            dueDate: todayISO(),
            status: "unpaid",
            note: "Автосчёт при зачислении",
            period: ym(todayISO()),
            createdAt: Date.now(),
          };
          localStorage.setItem(LS.INVOICES, JSON.stringify([inv, ...invoices]));
        }
      }

      try { await api.delete(`${LEADS_EP}${lead.id}/`); } catch (eDel) { /* no-op */ }
      setLeads((prev) => prev.filter((x) => x.id !== lead.id));

      // обновим список учеников для дальнейших проверок дублей
      setStudents((prev) => [
        ...prev,
        normalizeStudent({ id: stData?.id, name: payload.name, phone: payload.phone, group: payload.group }),
      ]);

      closeConvert();
    } catch (e2) {
      console.error(e2);
      setConvertError("Не удалось зачислить ученика.");
    } finally {
      setConvertSaving(false);
    }
  };

  return (
    <div className="school-leads">
      <header className="school-leads__header">
        <div className="school-leads__head">
          <h2 className="school-leads__title">Заявки</h2>
          <p className="school-leads__subtitle">Список заявок. Зачисляйте учеников.</p>
        </div>

        <div className="school-leads__toolbar">
          <label className="school-leads__search">
            <FaSearch className="school-leads__search-icon" aria-hidden />
            <input
              className="school-leads__search-input"
              placeholder="Поиск по заявкам…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск по заявкам"
            />
          </label>

          <button
            className="school-leads__btn school-leads__btn--primary"
            onClick={openCreate}
            type="button"
          >
            <FaPlus /> Создать заявку
          </button>
        </div>
      </header>

      {loading && <div className="school-leads__alert">Загрузка…</div>}
      {!!error && !loading && <div className="school-leads__alert" role="alert">{error}</div>}

      {!loading && !error && (
        <>
          <div className="school-leads__list">
            {pageItems.map((l) => {
              const initial = (l.name || "•").charAt(0).toUpperCase();
              const srcLabel = SOURCE_OPTIONS.find((o) => o.value === l.source)?.label || l.source;
              const deleting = deletingIds.has(l.id);

              return (
                <article key={l.id} className="school-leads__card">
                  <div className="school-leads__card-main">
                    <div className="school-leads__avatar" aria-hidden>{initial}</div>

                    <div className="school-leads__info">
                      <div className="school-leads__row">
                        <h3 className="school-leads__name">{l.name}</h3>
                        <span className="school-leads__phone">{l.phone || "—"}</span>
                      </div>
                      <div className="school-leads__meta">
                        <span>Источник: {srcLabel}</span>
                        {l.note && <span className="school-leads__note">Заметка: {l.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="school-leads__actions">
                    <button
                      className="school-leads__btn school-leads__btn--secondary"
                      onClick={() => openEdit(l)}
                      type="button"
                      title="Изменить заявку"
                    >
                      <FaEdit /> Изменить
                    </button>

                    <button
                      className="school-leads__btn school-leads__btn--secondary"
                      onClick={() => openConvert(l)}
                      type="button"
                      title="Зачислить ученика"
                    >
                      <FaExchangeAlt /> Зачислить
                    </button>

                    <button
                      className="school-leads__btn school-leads__btn--danger"
                      onClick={() => askDeleteLead(l)}
                      type="button"
                      disabled={deleting}
                      title="Удалить заявку"
                    >
                      <FaTrash /> {deleting ? "Удаление…" : "Удалить"}
                    </button>
                  </div>
                </article>
              );
            })}

            {filtered.length === 0 && (
              <div className="school-leads__alert">Заявки не найдены.</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="school-leads__pagination" role="navigation" aria-label="Пагинация заявок">
              <button
                type="button"
                className="school-leads__page-btn"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="Предыдущая страница"
              >
                ←
              </button>

              {pagesWindow[0] > 1 && (
                <>
                  <button type="button" className="school-leads__page-btn" onClick={() => setPage(1)}>1</button>
                  <span className="school-leads__dots">…</span>
                </>
              )}

              {pagesWindow.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`school-leads__page-btn ${p === page ? "school-leads__page-btn--active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}

              {pagesWindow[pagesWindow.length - 1] < totalPages && (
                <>
                  <span className="school-leads__dots">…</span>
                  <button
                    type="button"
                    className="school-leads__page-btn"
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                className="school-leads__page-btn"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                aria-label="Следующая страница"
              >
                →
              </button>

              <div className="school-leads__page-info">
                Стр. {page}/{totalPages} • Показано {pageItems.length} из {filtered.length}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lead modal */}
      {isModalOpen && (
        <div className="school-leads__modal-overlay" role="dialog" aria-modal="true">
          <div className="school-leads__modal">
            <div className="school-leads__modal-header">
              <h3 className="school-leads__modal-title">
                {mode === "create" ? "Новая заявка" : "Изменить заявку"}
              </h3>
              <button className="school-leads__icon-btn" onClick={closeModal} type="button" aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            {!!modalError && (
              <div className="school-leads__alert" role="alert" style={{margin:"0 16px"}}>
                {modalError}
              </div>
            )}

            <form className="school-leads__form" onSubmit={submitLead} noValidate>
              <div className="school-leads__form-grid">
                <div className="school-leads__field">
                  <label className="school-leads__label">
                    Имя <span className="school-leads__req">*</span>
                  </label>
                  <input
                    className="school-leads__input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={80}
                    required
                  />
                </div>

                <div className="school-leads__field">
                  <label className="school-leads__label">Телефон</label>
                  <input
                    className="school-leads__input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    inputMode="tel"
                    placeholder="+996..."
                    pattern="^(\+?\d{9,15})?$"
                    title="9–15 цифр, можно с + в начале"
                  />
                </div>

                <div className="school-leads__field">
                  <label className="school-leads__label">Источник</label>
                  <select
                    className="school-leads__input"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="school-leads__field school-leads__field--full">
                  <label className="school-leads__label">Заметка</label>
                  <textarea
                    className="school-leads__textarea"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="school-leads__form-actions">
                <span className="school-leads__actions-spacer" />
                <div className="school-leads__actions-right">
                  <button
                    type="button"
                    className="school-leads__btn school-leads__btn--secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="school-leads__btn school-leads__btn--primary" disabled={saving}>
                    {saving
                      ? mode === "create"
                        ? "Сохранение…"
                        : "Обновление…"
                      : mode === "create"
                      ? "Сохранить"
                      : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {isConvertOpen && (
        <div className="school-leads__modal-overlay" role="dialog" aria-modal="true">
          <div className="school-leads__modal">
            <div className="school-leads__modal-header">
              <h3 className="school-leads__modal-title">Зачисление ученика</h3>
              <button
                className="school-leads__icon-btn"
                onClick={closeConvert}
                type="button"
                aria-label="Закрыть"
                disabled={convertSaving}
              >
                <FaTimes />
              </button>
            </div>

            {!!convertError && (
              <div className="school-leads__alert" role="alert" style={{margin:"0 16px"}}>
                {convertError}
              </div>
            )}

            <form className="school-leads__form" onSubmit={submitConvert} noValidate>
              <div className="school-leads__form-grid">
                <div className="school-leads__field">
                  <label className="school-leads__label">
                    Программа <span className="school-leads__req">*</span>
                  </label>
                  <select
                    className="school-leads__input"
                    value={convert.courseId}
                    onChange={(e) =>
                      setConvert({ ...convert, courseId: e.target.value, groupId: "" })
                    }
                    required
                  >
                    <option value="">— выберите —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="school-leads__field">
                  <label className="school-leads__label">
                    Группа <span className="school-leads__req">*</span>
                  </label>
                  <select
                    className="school-leads__input"
                    value={convert.groupId}
                    onChange={(e) => setConvert({ ...convert, groupId: e.target.value })}
                    required
                  >
                    <option value="">— выберите —</option>
                    {groups
                      .filter((g) => String(g.courseId) === String(convert.courseId))
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                  </select>
                </div>

                <div className="school-leads__field">
                  <label className="school-leads__label">Скидка (сом)</label>
                  <input
                    className="school-leads__input"
                    type="number"
                    min="0"
                    step="1"
                    value={convert.discount}
                    onChange={(e) => setConvert({ ...convert, discount: e.target.value })}
                  />
                </div>
              </div>

              <div className="school-leads__form-actions">
                <span className="school-leads__actions-spacer" />
                <div className="school-leads__actions-right">
                  <button
                    type="button"
                    className="school-leads__btn school-leads__btn--secondary"
                    onClick={closeConvert}
                    disabled={convertSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="school-leads__btn school-leads__btn--primary"
                    disabled={convertSaving}
                  >
                    Зачислить и выставить счёт
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm modal (удаление заявки) */}
      {confirm.open && (
        <div className="school-leads__modal-overlay" role="dialog" aria-modal="true" onClick={closeConfirm}>
          <div className="school-leads__confirm" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="school-leads__confirm-title">Подтверждение</div>
            <div className="school-leads__confirm-text">
              Удалить заявку «{confirm.name}»? Действие необратимо.
            </div>
            <div className="school-leads__confirm-actions">
              <button type="button" className="school-leads__btn school-leads__btn--secondary" onClick={closeConfirm}>
                Нет
              </button>
              <button type="button" className="school-leads__btn school-leads__btn--danger" onClick={confirmYes}>
                Да
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolLeads;
