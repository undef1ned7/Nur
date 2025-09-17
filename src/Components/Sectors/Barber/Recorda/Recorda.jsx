// import React, { useState, useEffect, useMemo, useRef } from "react";
// import api from "../../../../api";
// import "./Recorda.scss";
// import { FaPlus, FaEdit, FaTimes, FaSearch, FaTrash } from "react-icons/fa";

// /* utils */
// const pad = (n) => String(n).padStart(2, "0");
// const toDate = (iso) =>
//   iso
//     ? (() => {
//         const d = new Date(iso);
//         return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
//       })()
//     : "";
// const toTime = (iso) =>
//   iso
//     ? (() => {
//         const d = new Date(iso);
//         return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
//       })()
//     : "";
// const asArray = (data) =>
//   Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

// /* helpers for validation */
// const TZ = "+06:00"; // ваш бэкенд ждёт этот оффсет
// const toISOWithTZ = (date, time) => `${date}T${time}:00${TZ}`;
// const ts = (iso) => new Date(iso).getTime();
// const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

// const normalizeName = (s) =>
//   String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
// const normalizePhone = (s) => String(s || "").replace(/[^\d]/g, ""); // только цифры

// /* labels */
// const STATUS_LABELS = {
//   booked: "Забронировано",
//   confirmed: "Подтверждено",
//   completed: "Завершено",
//   canceled: "Отменено",
//   no_show: "Не пришёл",
// };
// const BLOCKING_STATUSES = new Set(["booked", "confirmed", "completed", "no_show"]);

// const UI_TO_API_STATUS = {
//   Активен: "active",
//   Неактивен: "inactive",
//   VIP: "vip",
//   "В черном списке": "blacklist",
// };
// const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

// /* toast */
// const NotificationBanner = ({ appointment, onClose, lookup, index }) => (
//   <div
//     className="Barberrocarda__notification"
//     style={{ bottom: `${20 + index * 120}px` }}
//   >
//     <div className="Barberrocarda__notification-content">
//       <h4 className="Barberrocarda__notification-title">Напоминание о записи</h4>
//       <p>
//         Клиент: {appointment.client_name || lookup.client(appointment.client)}
//         <br />
//         Телефон: {lookup.clientPhone(appointment.client) || "—"}
//         <br />
//         Мастер: {appointment.barber_name || lookup.barber(appointment.barber)}
//         <br />
//         Услуга: {appointment.service_name || lookup.service(appointment.service)}
//         <br />
//         Время: {toDate(appointment.start_at)} {toTime(appointment.start_at)}
//       </p>
//       <button
//         className="Barberrocarda__btn Barberrocarda__btn--secondary"
//         onClick={onClose}
//       >
//         <FaTimes /> Закрыть
//       </button>
//     </div>
//   </div>
// );

// const Recorda = () => {
//   const [appointments, setAppointments] = useState([]);
//   const [clients, setClients] = useState([]);
//   const [barbers, setBarbers] = useState([]);
//   const [services, setServices] = useState([]);

//   const [loading, setLoading] = useState(true);
//   const [pageError, setPageError] = useState(""); // только для общего экрана

//   // форма записи
//   const [modalOpen, setModalOpen] = useState(false);
//   const [current, setCurrent] = useState(null);
//   const [saving, setSaving] = useState(false);
//   const [deleting, setDeleting] = useState(false);
//   const [formAlerts, setFormAlerts] = useState([]); // верхний красный блок
//   const [fieldErrs, setFieldErrs] = useState({}); // подсветка полей

//   const [search, setSearch] = useState("");
//   const [notifications, setNotifications] = useState([]);

//   // мини-модалка клиента
//   const [clientModalOpen, setClientModalOpen] = useState(false);
//   const [clientSaving, setClientSaving] = useState(false);
//   const [clientAlerts, setClientAlerts] = useState([]);
//   const [clientFieldErrs, setClientFieldErrs] = useState({});
//   const clientSelectRef = useRef(null);
//   const [clientSearch, setClientSearch] = useState("");

//   /* fetch */
//   const fetchAll = async () => {
//     setLoading(true);
//     setPageError("");
//     try {
//       const [clRes, empRes, sRes, aRes] = await Promise.all([
//         api.get("/barbershop/clients/"),
//         api.get("/users/employees/"),
//         api.get("/barbershop/services/"),
//         api.get("/barbershop/appointments/"),
//       ]);

//       const cls = asArray(clRes.data).sort((a, b) =>
//         (a.full_name || a.name || "").localeCompare(
//           b.full_name || b.name || "",
//           "ru"
//         )
//       );
//       const svcs = asArray(sRes.data).sort((a, b) =>
//         (a.service_name || a.name || "").localeCompare(
//           b.service_name || b.name || "",
//           "ru"
//         )
//       );
//       setClients(cls);
//       setServices(svcs);
//       setAppointments(asArray(aRes.data));

//       const employees = asArray(empRes.data)
//         .map((e) => {
//           const first = e.first_name ?? "";
//           const last = e.last_name ?? "";
//           const display =
//             ([last, first].filter(Boolean).join(" ").trim()) ||
//             e.email ||
//             "—";
//           return {
//             id: e.id,
//             barber_name: display,
//             full_name: display,
//             name: display,
//           };
//         })
//         .sort((a, b) => a.barber_name.localeCompare(b.barber_name, "ru"));
//       setBarbers(employees);
//     } catch (e) {
//       setPageError(
//         e?.response?.data?.detail || "Не удалось загрузить данные"
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const reloadClients = async () => {
//     const res = await api.get("/barbershop/clients/");
//     const list = asArray(res.data).sort((a, b) =>
//       (a.full_name || a.name || "").localeCompare(
//         b.full_name || b.name || "",
//         "ru"
//       )
//     );
//     setClients(list);
//     return list;
//   };

//   useEffect(() => {
//     fetchAll();
//   }, []);

//   /* reminders */
//   useEffect(() => {
//     const check = () => {
//       const now = new Date();
//       const shown = JSON.parse(localStorage.getItem("shownNotifications") || "[]");
//       const newly = appointments
//         .filter((a) => {
//           const st = new Date(a.start_at).getTime();
//           return (
//             a.status === "booked" &&
//             st <= now.getTime() &&
//             st > now.getTime() - 5 * 60 * 1000 &&
//             !shown.includes(a.id)
//           );
//         })
//         .slice(0, 1);
//       if (newly.length) {
//         setNotifications((prev) => [...prev, ...newly]);
//         localStorage.setItem(
//           "shownNotifications",
//           JSON.stringify([...shown, ...newly.map((a) => a.id)])
//         );
//       }
//     };
//     check();
//     const id = setInterval(check, 60000);
//     return () => clearInterval(id);
//   }, [appointments]);

//   /* modal */
//   const openModal = (rec = null) => {
//     setCurrent(rec);
//     setFormAlerts([]);
//     setFieldErrs({});
//     setModalOpen(true);
//   };
//   const closeModal = () => {
//     if (!saving && !deleting) {
//       setCurrent(null);
//       setModalOpen(false);
//       setFormAlerts([]);
//       setFieldErrs({});
//     }
//   };

//   const refreshAppointments = async () => {
//     try {
//       const res = await api.get("/barbershop/appointments/");
//       setAppointments(asArray(res.data));
//       localStorage.setItem("shownNotifications", "[]");
//       setNotifications([]);
//     } catch (e) {
//       setPageError(e?.response?.data?.detail || "Не удалось обновить записи");
//     }
//   };

//   /* lookups */
//   const displayClientName = (c) =>
//     c?.client_name || c?.full_name || c?.name || "";
//   const lookup = useMemo(
//     () => ({
//       client: (id) => displayClientName(clients.find((x) => x.id === id)),
//       clientPhone: (id) =>
//         clients.find((x) => x.id === id)?.phone ||
//         clients.find((x) => x.id === id)?.phone_number ||
//         "",
//       barber: (id) => {
//         const b = barbers.find((x) => x.id === id);
//         return b?.barber_name || b?.full_name || b?.name || "";
//       },
//       service: (id) => {
//         const s = services.find((x) => x.id === id);
//         return s?.service_name || s?.name || "";
//       },
//     }),
//     [clients, barbers, services]
//   );

//   /* filter */
//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return appointments;
//     return appointments.filter((r) => {
//       const c = (r.client_name || lookup.client(r.client) || "").toLowerCase();
//       const m = (r.barber_name || lookup.barber(r.barber) || "").toLowerCase();
//       const s = (r.service_name || lookup.service(r.service) || "").toLowerCase();
//       const st = (STATUS_LABELS[r.status] || r.status || "").toLowerCase();
//       return c.includes(q) || m.includes(q) || s.includes(q) || st.includes(q);
//     });
//   }, [appointments, search, lookup]);

//   /* clients search in select */
//   const clientsFiltered = useMemo(() => {
//     const q = clientSearch.trim().toLowerCase();
//     if (!q) return clients;
//     return clients.filter((c) => {
//       const name = displayClientName(c).toLowerCase();
//       const phone = (c.phone || c.phone_number || "").toLowerCase();
//       return name.includes(q) || phone.includes(q);
//     });
//   }, [clients, clientSearch]);

//   /* ===== validation: appointment ===== */
//   const validateAppointment = (fd) => {
//     const alerts = [];
//     const errs = {};

//     const clientId = fd.get("clientId");
//     const barberId = fd.get("barberId");
//     const serviceId = fd.get("serviceId");
//     const startDate = fd.get("startDate");
//     const startTime = fd.get("startTime");
//     const endDate = fd.get("endDate");
//     const endTime = fd.get("endTime");

//     if (!clientId) { errs.clientId = true; alerts.push("Выберите клиента"); }
//     if (!barberId) { errs.barberId = true; alerts.push("Выберите мастера"); }
//     if (!serviceId) { errs.serviceId = true; alerts.push("Выберите услугу"); }
//     if (!startDate || !startTime) { errs.startDate = true; errs.startTime = true; alerts.push("Укажите дату и время начала"); }
//     if (!endDate || !endTime) { errs.endDate = true; errs.endTime = true; alerts.push("Укажите дату и время окончания"); }

//     if (alerts.length) return { errs, alerts };

//     const startISO = toISOWithTZ(startDate, startTime);
//     const endISO = toISOWithTZ(endDate, endTime);
//     const startTs = ts(startISO);
//     const endTs = ts(endISO);

//     if (!(endTs > startTs)) {
//       errs.endDate = true; errs.endTime = true;
//       alerts.push("Окончание должно быть позже начала");
//       return { errs, alerts };
//     }

//     // проверка занятости мастера
//     const conflicts = appointments.filter((a) => {
//       if (String(a.barber) !== String(barberId)) return false;
//       if (current?.id && a.id === current.id) return false; // не сравниваем сам с собой
//       if (!BLOCKING_STATUSES.has(a.status)) return false;   // отменённые не блокируют
//       const aStart = ts(a.start_at);
//       const aEnd = ts(a.end_at);
//       return overlaps(startTs, endTs, aStart, aEnd);
//     });

//     if (conflicts.length > 0) {
//       errs.startDate = errs.startTime = errs.endDate = errs.endTime = true;
//       const samples = conflicts.slice(0, 2).map((c) => {
//         const t1 = `${toDate(c.start_at)} ${toTime(c.start_at)}`;
//         const t2 = `${toDate(c.end_at)} ${toTime(c.end_at)}`;
//         const who = c.client_name || lookup.client(c.client) || "клиент";
//         return `${t1} — ${t2} (${who})`;
//       });
//       alerts.push(
//         `У выбранного мастера уже есть запись в этот интервал:\n${samples.join(
//           "\n"
//         )}\nВыберите другое время.`
//       );
//     }

//     return { errs, alerts, startISO, endISO };
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setSaving(true);
//     setFormAlerts([]);
//     setFieldErrs({});

//     const fd = new FormData(e.currentTarget);
//     const { errs, alerts, startISO, endISO } = validateAppointment(fd);

//     if (alerts.length) {
//       setSaving(false);
//       setFieldErrs(errs);
//       setFormAlerts(["Исправьте ошибки в форме", ...alerts]);
//       // фокус на первое ошибочное поле
//       const order = [
//         "clientId",
//         "barberId",
//         "serviceId",
//         "startDate",
//         "startTime",
//         "endDate",
//         "endTime",
//       ];
//       const key = order.find((k) => errs[k]);
//       if (key) document.getElementsByName(key)?.[0]?.focus?.();
//       return;
//     }

//     try {
//       const payload = {
//         client: fd.get("clientId"),
//         barber: fd.get("barberId"),
//         service: fd.get("serviceId"),
//         start_at: startISO,
//         end_at: endISO,
//         status: fd.get("status"),
//         comment: (fd.get("comment") || "").toString().trim() || null,
//         company: localStorage.getItem("company"),
//       };

//       if (current?.id)
//         await api.patch(`/barbershop/appointments/${current.id}/`, payload);
//       else await api.post("/barbershop/appointments/", payload);

//       await refreshAppointments();
//       closeModal();
//     } catch (e2) {
//       // собираем ошибки бэка в верхний алерт
//       const d = e2?.response?.data;
//       const msgs = [];
//       if (typeof d === "string") msgs.push(d);
//       else if (d && typeof d === "object") {
//         Object.values(d).forEach((v) => msgs.push(String(Array.isArray(v) ? v[0] : v)));
//       }
//       if (!msgs.length) msgs.push("Не удалось сохранить запись");
//       setFormAlerts(msgs);
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDelete = async () => {
//     if (!current?.id) return;
//     if (!window.confirm("Удалить эту запись без возможности восстановления?"))
//       return;
//     setDeleting(true);
//     setFormAlerts([]);
//     try {
//       await api.delete(`/barbershop/appointments/${current.id}/`);
//       await refreshAppointments();
//       closeModal();
//     } catch (e2) {
//       const msg =
//         e2?.response?.data?.detail || "Не удалось удалить запись";
//       setFormAlerts([msg]);
//     } finally {
//       setDeleting(false);
//     }
//   };

//   /* new client modal */
//   const openClientModal = () => {
//     setClientAlerts([]);
//     setClientFieldErrs({});
//     setClientModalOpen(true);
//   };
//   const closeClientModal = () => {
//     if (!clientSaving) setClientModalOpen(false);
//   };

//   const validateNewClient = ({ fullName, phone }) => {
//     const alerts = [];
//     const errs = {};

//     const nName = normalizeName(fullName);
//     const nPhone = normalizePhone(phone);

//     if (!nName) { errs.fullName = true; alerts.push("Укажите ФИО"); }
//     if (!nPhone) { errs.phone = true; alerts.push("Укажите телефон"); }
//     else if (nPhone.length < 9) { errs.phone = true; alerts.push("Телефон указан некорректно"); }

//     // дубли
//     if (nName && clients.some((c) => normalizeName(displayClientName(c)) === nName)) {
//       errs.fullName = true; alerts.push("Клиент с таким ФИО уже существует");
//     }
//     if (nPhone && clients.some((c) => normalizePhone(c.phone || c.phone_number) === nPhone)) {
//       errs.phone = true; alerts.push("Такой телефон уже используется");
//     }

//     return { alerts, errs };
//   };

//   const handleCreateClient = async (e) => {
//     e.preventDefault();
//     setClientSaving(true);
//     setClientAlerts([]);
//     setClientFieldErrs({});

//     const fd = new FormData(e.currentTarget);
//     const fullName = (fd.get("fullName") || "").toString().trim();
//     const phone = (fd.get("phone") || "").toString().trim();
//     const birthDate = (fd.get("birthDate") || "").toString().trim();
//     const statusUi = (fd.get("status") || "Активен").toString().trim();
//     const notes = (fd.get("notes") || "").toString();

//     const { alerts, errs } = validateNewClient({ fullName, phone });
//     if (alerts.length) {
//       setClientSaving(false);
//       setClientFieldErrs(errs);
//       setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
//       const firstKey = ["fullName", "phone"].find((k) => errs[k]);
//       if (firstKey) document.getElementsByName(firstKey)?.[0]?.focus?.();
//       return;
//     }

//     try {
//       const payload = {
//         full_name: fullName,
//         phone,
//         email: null, // email не нужен
//         birth_date: birthDate || null,
//         status: UI_TO_API_STATUS[statusUi] || "active",
//         notes: notes || null,
//         company: localStorage.getItem("company"),
//       };
//       const res = await api.post("/barbershop/clients/", payload);
//       const created = res?.data;
//       const list = await reloadClients();
//       if (clientSelectRef.current && created?.id) {
//         clientSelectRef.current.value = created.id;
//         setClientSearch("");
//       }
//       // проскроллим селект к новому
//       const exists = list.find((c) => c.id === created?.id);
//       if (exists) clientSelectRef.current?.focus?.();
//       setClientModalOpen(false);
//     } catch (e2) {
//       const msg =
//         e2?.response?.data?.detail || "Не удалось сохранить клиента";
//       setClientAlerts([msg]);
//     } finally {
//       setClientSaving(false);
//     }
//   };

//   const closeNotification = (id) =>
//     setNotifications((prev) => prev.filter((n) => n.id !== id));

//   return (
//     <div className="Barberrocarda">
//       {/* Header */}
//       <div className="Barberrocarda__header">
//         <div className="Barberrocarda__titlebox">
//           <h2 className="Barberrocarda__title">Записи</h2>
//           <span className="Barberrocarda__subtitle">
//             {loading ? "Загрузка..." : `${filtered.length} шт.`}
//           </span>
//         </div>

//         <div className="Barberrocarda__search">
//           <FaSearch className="Barberrocarda__search-icon" />
//           <input
//             type="text"
//             className="Barberrocarda__search-input"
//             placeholder="Поиск: клиент, мастер, услуга, статус"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             aria-label="Поиск по записям"
//           />
//         </div>

//         <button
//           className="Barberrocarda__btn Barberrocarda__btn--primary Barberrocarda__addBtn"
//           onClick={() => openModal()}
//         >
//           <FaPlus /> Добавить
//         </button>
//       </div>

//       {pageError && <div className="Barberrocarda__alert">{pageError}</div>}

//       <div className="Barberrocarda__table-wrap">
//         <table className="Barberrocarda__table">
//           <thead>
//             <tr>
//               <th>Клиент</th>
//               <th>Мастер</th>
//               <th>Услуга</th>
//               <th>Статус</th>
//               <th />
//             </tr>
//           </thead>
//           <tbody>
//             {!loading && filtered.length === 0 && (
//               <tr>
//                 <td colSpan="5" className="Barberrocarda__loading">
//                   Ничего не найдено
//                 </td>
//               </tr>
//             )}

//             {!loading &&
//               filtered.map((r) => (
//                 <tr key={r.id}>
//                   <td>{r.client_name || lookup.client(r.client)}</td>
//                   <td>{r.barber_name || lookup.barber(r.barber)}</td>
//                   <td>{r.service_name || lookup.service(r.service)}</td>
//                   <td>
//                     <span
//                       className={`Barberrocarda__badge Barberrocarda__badge--${r.status}`}
//                     >
//                       {STATUS_LABELS[r.status] || r.status}
//                     </span>
//                   </td>
//                   <td>
//                     <button
//                       className="Barberrocarda__btn Barberrocarda__btn--secondary"
//                       onClick={() => openModal(r)}
//                       aria-label="Редактировать запись"
//                     >
//                       <FaEdit /> Ред.
//                     </button>
//                   </td>
//                 </tr>
//               ))}

//             {loading && (
//               <tr>
//                 <td colSpan="5" className="Barberrocarda__loading">
//                   Загрузка...
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {/* Modal: запись */}
//       {modalOpen && (
//         <div className="Barberrocarda__modal-overlay" onClick={closeModal}>
//           <div
//             className="Barberrocarda__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="Barberrocarda__modal-header">
//               <h3 className="Barberrocarda__modal-title">
//                 {current ? "Редактировать запись" : "Новая запись"}
//               </h3>
//               <button
//                 className="Barberrocarda__icon-btn"
//                 onClick={closeModal}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {/* верхний красный алерт */}
//             {formAlerts.length > 0 && (
//               <div className="Barberrocarda__alert Barberrocarda__alert--inModal">
//                 {formAlerts.length === 1 ? (
//                   formAlerts[0]
//                 ) : (
//                   <ul style={{ margin: 0, paddingLeft: 18 }}>
//                     {formAlerts.map((m, i) => (
//                       <li key={i}>{m}</li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form className="Barberrocarda__form" onSubmit={handleSubmit} noValidate>
//               <div className="Barberrocarda__form-grid">
//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Клиент *</label>
//                   <input
//                     type="text"
//                     className="Barberrocarda__input"
//                     placeholder="Поиск клиента: имя или телефон"
//                     value={clientSearch}
//                     onChange={(e) => setClientSearch(e.target.value)}
//                   />
//                   <select
//                     name="clientId"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.clientId ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={current?.client || ""}
//                     ref={clientSelectRef}
//                     required
//                   >
//                     <option value="">Выберите клиента</option>
//                     {clientsFiltered.map((c) => (
//                       <option key={c.id} value={c.id}>
//                         {displayClientName(c)}
//                         {c.phone ? ` — ${c.phone}` : ""}
//                       </option>
//                     ))}
//                   </select>
//                   <button
//                     type="button"
//                     className="Barberrocarda__btn Barberrocarda__btn--secondary"
//                     onClick={openClientModal}
//                     style={{ marginTop: 8 }}
//                   >
//                     <FaPlus /> Добавить клиента
//                   </button>
//                 </div>

//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Мастер *</label>
//                   <select
//                     name="barberId"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.barberId ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={current?.barber || ""}
//                     required
//                   >
//                     <option value="">Выберите мастера</option>
//                     {barbers.map((m) => (
//                       <option key={m.id} value={m.id}>
//                         {m.barber_name || m.full_name || m.name || ""}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Услуга *</label>
//                   <select
//                     name="serviceId"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.serviceId ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={current?.service || ""}
//                     required
//                   >
//                     <option value="">Выберите услугу</option>
//                     {services.map((s) => (
//                       <option key={s.id} value={s.id}>
//                         {(s.service_name || s.name || "") +
//                           (s.price ? ` — ${s.price}` : "")}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Начало — дата *</label>
//                   <input
//                     name="startDate"
//                     type="date"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.startDate ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={toDate(current?.start_at)}
//                     required
//                   />
//                 </div>
//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Начало — время *</label>
//                   <input
//                     name="startTime"
//                     type="time"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.startTime ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={toTime(current?.start_at)}
//                     required
//                   />
//                 </div>

//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Конец — дата *</label>
//                   <input
//                     name="endDate"
//                     type="date"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.endDate ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={toDate(current?.end_at)}
//                     required
//                   />
//                 </div>
//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Конец — время *</label>
//                   <input
//                     name="endTime"
//                     type="time"
//                     className={`Barberrocarda__input ${
//                       fieldErrs.endTime ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     defaultValue={toTime(current?.end_at)}
//                     required
//                   />
//                 </div>

//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Статус *</label>
//                   <select
//                     name="status"
//                     className="Barberrocarda__input"
//                     defaultValue={current?.status || "booked"}
//                     required
//                   >
//                     <option value="booked">{STATUS_LABELS.booked}</option>
//                     <option value="confirmed">{STATUS_LABELS.confirmed}</option>
//                     <option value="completed">{STATUS_LABELS.completed}</option>
//                     <option value="canceled">{STATUS_LABELS.canceled}</option>
//                     <option value="no_show">{STATUS_LABELS.no_show}</option>
//                   </select>
//                 </div>

//                 <div className="Barberrocarda__field Barberrocarda__field--full">
//                   <label className="Barberrocarda__label">Комментарий</label>
//                   <textarea
//                     name="comment"
//                     className="Barberrocarda__textarea"
//                     defaultValue={current?.comment || ""}
//                     placeholder="Заметка для мастера/клиента"
//                   />
//                 </div>
//               </div>

//               <div className="Barberrocarda__form-actions">
//                 {current?.id ? (
//                   <button
//                     type="button"
//                     className="Barberrocarda__btn Barberrocarda__btn--danger"
//                     onClick={handleDelete}
//                     disabled={deleting || saving}
//                     title="Удалить запись"
//                   >
//                     <FaTrash /> {deleting ? "Удаление..." : "Удалить"}
//                   </button>
//                 ) : (
//                   <span className="Barberrocarda__form-actions-spacer" />
//                 )}

//                 <div className="Barberrocarda__form-actions-right">
//                   <button
//                     type="button"
//                     onClick={closeModal}
//                     className="Barberrocarda__btn Barberrocarda__btn--secondary"
//                     disabled={saving || deleting}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={saving || deleting}
//                     className="Barberrocarda__btn Barberrocarda__btn--primary"
//                   >
//                     {saving ? "Сохранение..." : "Сохранить"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* mini modal client */}
//       {clientModalOpen && (
//         <div
//           className="Barberrocarda__modal-overlay"
//           onClick={closeClientModal}
//           style={{ zIndex: 120 }}
//         >
//           <div
//             className="Barberrocarda__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="Barberrocarda__modal-header">
//               <h3 className="Barberrocarda__modal-title">Новый клиент</h3>
//               <button
//                 className="Barberrocarda__icon-btn"
//                 onClick={closeClientModal}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {clientAlerts.length > 0 && (
//               <div className="Barberrocarda__alert Barberrocarda__alert--inModal">
//                 {clientAlerts.length === 1 ? (
//                   clientAlerts[0]
//                 ) : (
//                   <ul style={{ margin: 0, paddingLeft: 18 }}>
//                     {clientAlerts.map((m, i) => (
//                       <li key={i}>{m}</li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form className="Barberrocarda__form" onSubmit={handleCreateClient} noValidate>
//               <div className="Barberrocarda__form-grid">
//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">
//                     ФИО <span className="Barberrocarda__req">*</span>
//                   </label>
//                   <input
//                     name="fullName"
//                     className={`Barberrocarda__input ${
//                       clientFieldErrs.fullName ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     placeholder="Фамилия Имя Отчество"
//                     required
//                   />
//                 </div>
//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">
//                     Телефон <span className="Barberrocarda__req">*</span>
//                   </label>
//                   <input
//                     name="phone"
//                     className={`Barberrocarda__input ${
//                       clientFieldErrs.phone ? "Barberrocarda__input--invalid" : ""
//                     }`}
//                     placeholder="+996 ..."
//                     inputMode="tel"
//                     required
//                   />
//                 </div>

//                 {/* Email убран по требованиям */}

//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Дата рождения</label>
//                   <input name="birthDate" className="Barberrocarda__input" type="date" />
//                 </div>
//                 <div className="Barberrocarda__field">
//                   <label className="Barberrocarda__label">Статус</label>
//                   <select name="status" className="Barberrocarda__input" defaultValue="Активен">
//                     {STATUS_OPTIONS_UI.map((s) => (
//                       <option key={s} value={s}>
//                         {s}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <div className="Barberrocarda__field Barberrocarda__field--full">
//                   <label className="Barberrocarda__label">Заметки</label>
//                   <textarea
//                     name="notes"
//                     className="Barberrocarda__textarea"
//                     placeholder="Комментарий, пожелания..."
//                   />
//                 </div>
//               </div>

//               <div className="Barberrocarda__form-actions">
//                 <span className="Barberrocarda__form-actions-spacer" />
//                 <div className="Barberrocarda__form-actions-right">
//                   <button
//                     type="button"
//                     className="Barberrocarda__btn Barberrocarda__btn--secondary"
//                     onClick={closeClientModal}
//                     disabled={clientSaving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="Barberrocarda__btn Barberrocarda__btn--primary"
//                     disabled={clientSaving}
//                   >
//                     {clientSaving ? "Сохранение..." : "Сохранить клиента"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {notifications.map((n, i) => (
//         <NotificationBanner
//           key={n.id}
//           appointment={n}
//           onClose={() => closeNotification(n.id)}
//           lookup={lookup}
//           index={i}
//         />
//       ))}
//     </div>
//   );
// };

// export default Recorda;



import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../../../../api";
import "./Recorda.scss";
import { FaPlus, FaEdit, FaTimes, FaSearch } from "react-icons/fa";

/* utils */
const pad = (n) => String(n).padStart(2, "0");
const toDate = (iso) =>
  iso
    ? (() => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })()
    : "";
const toTime = (iso) =>
  iso
    ? (() => {
        const d = new Date(iso);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : "";
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

/* pagination */
const PAGE_SIZE = 15;

/* helpers for validation */
const TZ = "+06:00"; // ваш бэкенд ждёт этот оффсет
const toISOWithTZ = (date, time) => `${date}T${time}:00${TZ}`;
const ts = (iso) => new Date(iso).getTime();
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

const normalizeName = (s) =>
  String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const normalizePhone = (s) => String(s || "").replace(/[^\d]/g, ""); // только цифры

/* labels */
const STATUS_LABELS = {
  booked: "Забронировано",
  confirmed: "Подтверждено",
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не пришёл",
};
const BLOCKING_STATUSES = new Set(["booked", "confirmed", "completed", "no_show"]);

const UI_TO_API_STATUS = {
  Активен: "active",
  Неактивен: "inactive",
  VIP: "vip",
  "В черном списке": "blacklist",
};
const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

/* toast */
const NotificationBanner = ({ appointment, onClose, lookup, index }) => (
  <div
    className="Barberrocarda__notification"
    style={{ bottom: `${20 + index * 120}px` }}
  >
    <div className="Barberrocarda__notification-content">
      <h4 className="Barberrocarda__notification-title">Напоминание о записи</h4>
      <p>
        Клиент: {appointment.client_name || lookup.client(appointment.client)}
        <br />
        Телефон: {lookup.clientPhone(appointment.client) || "—"}
        <br />
        Мастер: {appointment.barber_name || lookup.barber(appointment.barber)}
        <br />
        Услуга: {appointment.service_name || lookup.service(appointment.service)}
        <br />
        Время: {toDate(appointment.start_at)} {toTime(appointment.start_at)}
      </p>
      <button
        className="Barberrocarda__btn Barberrocarda__btn--secondary"
        onClick={onClose}
      >
        <FaTimes /> Закрыть
      </button>
    </div>
  </div>
);

const Recorda = () => {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // форма записи
  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formAlerts, setFormAlerts] = useState([]); // верхний красный блок
  const [fieldErrs, setFieldErrs] = useState({}); // подсветка полей

  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState([]);

  // мини-модалка клиента
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [clientAlerts, setClientAlerts] = useState([]);
  const [clientFieldErrs, setClientFieldErrs] = useState({});
  const clientSelectRef = useRef(null);
  const [clientSearch, setClientSearch] = useState("");

  // пагинация
  const [page, setPage] = useState(1);

  /* fetch */
  const fetchAll = async () => {
    setLoading(true);
    setPageError("");
    try {
      const [clRes, empRes, sRes, aRes] = await Promise.all([
        api.get("/barbershop/clients/"),
        api.get("/users/employees/"),
        api.get("/barbershop/services/"),
        api.get("/barbershop/appointments/"),
      ]);

      const cls = asArray(clRes.data).sort((a, b) =>
        (a.full_name || a.name || "").localeCompare(
          b.full_name || b.name || "",
          "ru"
        )
      );
      const svcs = asArray(sRes.data).sort((a, b) =>
        (a.service_name || a.name || "").localeCompare(
          b.service_name || b.name || "",
          "ru"
        )
      );
      setClients(cls);
      setServices(svcs);
      setAppointments(asArray(aRes.data));

      const employees = asArray(empRes.data)
        .map((e) => {
          const first = e.first_name ?? "";
          const last = e.last_name ?? "";
          const display =
            ([last, first].filter(Boolean).join(" ").trim()) ||
            e.email ||
            "—";
          return {
            id: e.id,
            barber_name: display,
            full_name: display,
            name: display,
          };
        })
        .sort((a, b) => a.barber_name.localeCompare(b.barber_name, "ru"));
      setBarbers(employees);
    } catch (e) {
      setPageError(e?.response?.data?.detail || "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  };

  const reloadClients = async () => {
    const res = await api.get("/barbershop/clients/");
    const list = asArray(res.data).sort((a, b) =>
      (a.full_name || a.name || "").localeCompare(
        b.full_name || b.name || "",
        "ru"
      )
    );
    setClients(list);
    return list;
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* reminders */
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const shown = JSON.parse(localStorage.getItem("shownNotifications") || "[]");
      const newly = appointments
        .filter((a) => {
          const st = new Date(a.start_at).getTime();
          return (
            a.status === "booked" &&
            st <= now.getTime() &&
            st > now.getTime() - 5 * 60 * 1000 &&
            !shown.includes(a.id)
          );
        })
        .slice(0, 1);
      if (newly.length) {
        setNotifications((prev) => [...prev, ...newly]);
        localStorage.setItem(
          "shownNotifications",
          JSON.stringify([...shown, ...newly.map((a) => a.id)])
        );
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [appointments]);

  /* modal */
  const openModal = (rec = null) => {
    setCurrent(rec);
    setFormAlerts([]);
    setFieldErrs({});
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) {
      setCurrent(null);
      setModalOpen(false);
      setFormAlerts([]);
      setFieldErrs({});
    }
  };

  const refreshAppointments = async () => {
    try {
      const res = await api.get("/barbershop/appointments/");
      setAppointments(asArray(res.data));
      localStorage.setItem("shownNotifications", "[]");
      setNotifications([]);
    } catch (e) {
      setPageError(e?.response?.data?.detail || "Не удалось обновить записи.");
    }
  };

  /* lookups */
  const displayClientName = (c) =>
    c?.client_name || c?.full_name || c?.name || "";
  const lookup = useMemo(
    () => ({
      client: (id) => displayClientName(clients.find((x) => x.id === id)),
      clientPhone: (id) =>
        clients.find((x) => x.id === id)?.phone ||
        clients.find((x) => x.id === id)?.phone_number ||
        "",
      barber: (id) => {
        const b = barbers.find((x) => x.id === id);
        return b?.barber_name || b?.full_name || b?.name || "";
      },
      service: (id) => {
        const s = services.find((x) => x.id === id);
        return s?.service_name || s?.name || "";
      },
    }),
    [clients, barbers, services]
  );

  /* filter */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((r) => {
      const c = (r.client_name || lookup.client(r.client) || "").toLowerCase();
      const m = (r.barber_name || lookup.barber(r.barber) || "").toLowerCase();
      const s = (r.service_name || lookup.service(r.service) || "").toLowerCase();
      const st = (STATUS_LABELS[r.status] || r.status || "").toLowerCase();
      return c.includes(q) || m.includes(q) || s.includes(q) || st.includes(q);
    });
  }, [appointments, search, lookup]);

  // сбрасываем страницу при изменении поиска/кол-ва данных
  useEffect(() => {
    setPage(1);
  }, [search, appointments.length]);

  /* clients search in select */
  const clientsFiltered = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = displayClientName(c).toLowerCase();
      const phone = (c.phone || c.phone_number || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [clients, clientSearch]);

  /* ===== validation: appointment ===== */
  const validateAppointment = (fd) => {
    const alerts = [];
    const errs = {};

    const clientId = fd.get("clientId");
    const barberId = fd.get("barberId");
    const serviceId = fd.get("serviceId");
    const startDate = fd.get("startDate");
    const startTime = fd.get("startTime");
    const endDate = fd.get("endDate");
    const endTime = fd.get("endTime");

    if (!clientId) { errs.clientId = true; alerts.push("Выберите клиента."); }
    if (!barberId) { errs.barberId = true; alerts.push("Выберите мастера."); }
    if (!serviceId) { errs.serviceId = true; alerts.push("Выберите услугу."); }
    if (!startDate || !startTime) { errs.startDate = true; errs.startTime = true; alerts.push("Укажите дату и время начала."); }
    if (!endDate || !endTime) { errs.endDate = true; errs.endTime = true; alerts.push("Укажите дату и время окончания."); }

    if (alerts.length) return { errs, alerts };

    const startISO = toISOWithTZ(startDate, startTime);
    const endISO = toISOWithTZ(endDate, endTime);
    const startTs = ts(startISO);
    const endTs = ts(endISO);

    if (!(endTs > startTs)) {
      errs.endDate = true; errs.endTime = true;
      alerts.push("Окончание должно быть позже начала.");
      return { errs, alerts };
    }

    // проверка занятости мастера
    const conflicts = appointments.filter((a) => {
      if (String(a.barber) !== String(barberId)) return false;
      if (current?.id && a.id === current.id) return false; // не сравниваем сам с собой
      if (!BLOCKING_STATUSES.has(a.status)) return false;   // отменённые не блокируют
      const aStart = ts(a.start_at);
      const aEnd = ts(a.end_at);
      return overlaps(startTs, endTs, aStart, aEnd);
    });

    if (conflicts.length > 0) {
      errs.startDate = errs.startTime = errs.endDate = errs.endTime = true;
      const samples = conflicts.slice(0, 2).map((c) => {
        const t1 = `${toDate(c.start_at)} ${toTime(c.start_at)}`;
        const t2 = `${toDate(c.end_at)} ${toTime(c.end_at)}`;
        const who = c.client_name || lookup.client(c.client) || "клиент";
        return `${t1} — ${t2} (${who})`;
      });
      alerts.push(
        `У выбранного мастера уже есть запись в этот интервал:\n${samples.join(
          "\n"
        )}\nВыберите другое время.`
      );
    }

    return { errs, alerts, startISO, endISO };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormAlerts([]);
    setFieldErrs({});

    const fd = new FormData(e.currentTarget);
    const { errs, alerts, startISO, endISO } = validateAppointment(fd);

    if (alerts.length) {
      setSaving(false);
      setFieldErrs(errs);
      setFormAlerts(["Исправьте ошибки в форме.", ...alerts]);
      // фокус на первое ошибочное поле
      const order = [
        "clientId",
        "barberId",
        "serviceId",
        "startDate",
        "startTime",
        "endDate",
        "endTime",
      ];
      const key = order.find((k) => errs[k]);
      if (key) document.getElementsByName(key)?.[0]?.focus?.();
      return;
    }

    try {
      const payload = {
        client: fd.get("clientId"),
        barber: fd.get("barberId"),
        service: fd.get("serviceId"),
        start_at: startISO,
        end_at: endISO,
        status: fd.get("status"),
        comment: (fd.get("comment") || "").toString().trim() || null,
        company: localStorage.getItem("company"),
      };

      if (current?.id)
        await api.patch(`/barbershop/appointments/${current.id}/`, payload);
      else await api.post("/barbershop/appointments/", payload);

      await refreshAppointments();
      closeModal();
    } catch (e2) {
      // собираем ошибки бэка в верхний алерт
      const d = e2?.response?.data;
      const msgs = [];
      if (typeof d === "string") msgs.push(d);
      else if (d && typeof d === "object") {
        Object.values(d).forEach((v) => msgs.push(String(Array.isArray(v) ? v[0] : v)));
      }
      if (!msgs.length) msgs.push("Не удалось сохранить запись.");
      setFormAlerts(msgs);
    } finally {
      setSaving(false);
    }
  };

  /* new client modal */
  const openClientModal = () => {
    setClientAlerts([]);
    setClientFieldErrs({});
    setClientModalOpen(true);
  };
  const closeClientModal = () => {
    if (!clientSaving) setClientModalOpen(false);
  };

  const validateNewClient = ({ fullName, phone }) => {
    const alerts = [];
    const errs = {};

    const nName = normalizeName(fullName);
    const nPhone = normalizePhone(phone);

    if (!nName) { errs.fullName = true; alerts.push("Укажите ФИО."); }
    if (!nPhone) { errs.phone = true; alerts.push("Укажите телефон."); }
    else if (nPhone.length < 9) { errs.phone = true; alerts.push("Телефон указан некорректно."); }

    // дубли
    if (nName && clients.some((c) => normalizeName(displayClientName(c)) === nName)) {
      errs.fullName = true; alerts.push("Клиент с таким ФИО уже существует.");
    }
    if (nPhone && clients.some((c) => normalizePhone(c.phone || c.phone_number) === nPhone)) {
      errs.phone = true; alerts.push("Такой телефон уже используется.");
    }

    return { alerts, errs };
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setClientSaving(true);
    setClientAlerts([]);
    setClientFieldErrs({});

    const fd = new FormData(e.currentTarget);
    const fullName = (fd.get("fullName") || "").toString().trim();
    const phone = (fd.get("phone") || "").toString().trim();
    const birthDate = (fd.get("birthDate") || "").toString().trim();
    const statusUi = (fd.get("status") || "Активен").toString().trim();
    const notes = (fd.get("notes") || "").toString();

    const { alerts, errs } = validateNewClient({ fullName, phone });
    if (alerts.length) {
      setClientSaving(false);
      setClientFieldErrs(errs);
      setClientAlerts(["Исправьте ошибки в форме.", ...alerts]);
      const firstKey = ["fullName", "phone"].find((k) => errs[k]);
      if (firstKey) document.getElementsByName(firstKey)?.[0]?.focus?.();
      return;
    }

    try {
      const payload = {
        full_name: fullName,
        phone,
        email: null,
        birth_date: birthDate || null,
        status: UI_TO_API_STATUS[statusUi] || "active",
        notes: notes || null,
        company: localStorage.getItem("company"),
      };
      const res = await api.post("/barbershop/clients/", payload);
      const created = res?.data;
      const list = await reloadClients();
      if (clientSelectRef.current && created?.id) {
        clientSelectRef.current.value = created.id;
        setClientSearch("");
      }
      const exists = list.find((c) => c.id === created?.id);
      if (exists) clientSelectRef.current?.focus?.();
      setClientModalOpen(false);
    } catch (e2) {
      const msg = e2?.response?.data?.detail || "Не удалось сохранить клиента.";
      setClientAlerts([msg]);
    } finally {
      setClientSaving(false);
    }
  };

  const closeNotification = (id) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  /* pagination derived */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const Pager = () => {
    if (filtered.length <= PAGE_SIZE) return null;
    const onPrev = () => setPage((p) => Math.max(1, p - 1));
    const onNext = () => setPage((p) => Math.min(totalPages, p + 1));

    const pages = new Set([1, pageSafe - 1, pageSafe, pageSafe + 1, totalPages]);
    const list = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

    return (
      <nav className="Barberrocarda__pager" aria-label="Пагинация">
        <button
          className="Barberrocarda__pageBtn"
          onClick={onPrev}
          disabled={pageSafe === 1}
        >
          Назад
        </button>
        <ul className="Barberrocarda__pageList">
          {list.map((n, i) => {
            const prev = list[i - 1];
            const needDots = prev && n - prev > 1;
            return (
              <React.Fragment key={n}>
                {needDots && <li className="Barberrocarda__dots">…</li>}
                <li>
                  <button
                    className={`Barberrocarda__pageBtn ${n === pageSafe ? "is-active" : ""}`}
                    aria-current={n === pageSafe ? "page" : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <button
          className="Barberrocarda__pageBtn"
          onClick={onNext}
          disabled={pageSafe === totalPages}
        >
          Далее
        </button>
      </nav>
    );
  };

  return (
    <div className="Barberrocarda">
      {/* Header */}
      <div className="Barberrocarda__header">
        <div className="Barberrocarda__titlebox">
          <h2 className="Barberrocarda__title">Записи</h2>
          <span className="Barberrocarda__subtitle">
            {loading
              ? "Загрузка…"
              : `${filtered.length} шт.${
                  filtered.length > PAGE_SIZE ? ` · страница ${pageSafe}/${totalPages}` : ""
                }`}
          </span>
        </div>

        <div className="Barberrocarda__search">
          <FaSearch className="Barberrocarda__search-icon" />
          <input
            type="text"
            className="Barberrocarda__search-input"
            placeholder="Поиск: клиент, мастер, услуга, статус"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск по записям"
          />
        </div>

        <button
          className="Barberrocarda__btn Barberrocarda__btn--primary Barberrocarda__addBtn"
          onClick={() => openModal()}
        >
          <FaPlus /> Добавить
        </button>
      </div>

      {pageError && <div className="Barberrocarda__alert">{pageError}</div>}

      <div className="Barberrocarda__table-wrap">
        <table className="Barberrocarda__table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Мастер</th>
              <th>Услуга</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan="5" className="Barberrocarda__loading">
                  Ничего не найдено
                </td>
              </tr>
            )}

            {!loading &&
              pageRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.client_name || lookup.client(r.client)}</td>
                  <td>{r.barber_name || lookup.barber(r.barber)}</td>
                  <td>{r.service_name || lookup.service(r.service)}</td>
                  <td>
                    <span
                      className={`Barberrocarda__badge Barberrocarda__badge--${r.status}`}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="Barberrocarda__btn Barberrocarda__btn--secondary"
                      onClick={() => openModal(r)}
                      aria-label="Редактировать запись"
                    >
                      <FaEdit /> Ред.
                    </button>
                  </td>
                </tr>
              ))}

            {loading && (
              <tr>
                <td colSpan="5" className="Barberrocarda__loading">
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager />

      {/* Modal: запись */}
      {modalOpen && (
        <div className="Barberrocarda__modal-overlay" onClick={closeModal}>
          <div
            className="Barberrocarda__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="Barberrocarda__modal-header">
              <h3 className="Barberrocarda__modal-title">
                {current ? "Редактировать запись" : "Новая запись"}
              </h3>
              <button
                className="Barberrocarda__icon-btn"
                onClick={closeModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {/* верхний красный алерт */}
            {formAlerts.length > 0 && (
              <div className="Barberrocarda__alert Barberrocarda__alert--inModal">
                {formAlerts.length === 1 ? (
                  formAlerts[0]
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {formAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form className="Barberrocarda__form" onSubmit={handleSubmit} noValidate>
              <div className="Barberrocarda__form-grid">
                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Клиент <span className="Barberrocarda__req">*</span></label>
                  <input
                    type="text"
                    className="Barberrocarda__input"
                    placeholder="Поиск клиента: имя или телефон"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <select
                    name="clientId"
                    className={`Barberrocarda__input ${fieldErrs.clientId ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={current?.client || ""}
                    ref={clientSelectRef}
                    required
                  >
                    <option value="">Выберите клиента</option>
                    {clientsFiltered.map((c) => (
                      <option key={c.id} value={c.id}>
                        {displayClientName(c)}
                        {c.phone ? ` — ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="Barberrocarda__btn Barberrocarda__btn--secondary"
                    onClick={openClientModal}
                    style={{ marginTop: 8 }}
                  >
                    <FaPlus /> Добавить клиента
                  </button>
                </div>

                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Мастер <span className="Barberrocarda__req">*</span></label>
                  <select
                    name="barberId"
                    className={`Barberrocarda__input ${fieldErrs.barberId ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={current?.barber || ""}
                    required
                  >
                    <option value="">Выберите мастера</option>
                    {barbers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.barber_name || m.full_name || m.name || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Услуга <span className="Barberrocarda__req">*</span></label>
                  <select
                    name="serviceId"
                    className={`Barberrocarda__input ${fieldErrs.serviceId ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={current?.service || ""}
                    required
                  >
                    <option value="">Выберите услугу</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.service_name || s.name || "") + (s.price ? ` — ${s.price}` : "")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Начало — дата <span className="Barberrocarda__req">*</span></label>
                  <input
                    name="startDate"
                    type="date"
                    className={`Barberrocarda__input ${fieldErrs.startDate ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={toDate(current?.start_at)}
                    required
                  />
                </div>
                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Начало — время <span className="Barberrocarda__req">*</span></label>
                  <input
                    name="startTime"
                    type="time"
                    className={`Barberrocarda__input ${fieldErrs.startTime ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={toTime(current?.start_at)}
                    required
                  />
                </div>

                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Конец — дата <span className="Barberrocarda__req">*</span></label>
                  <input
                    name="endDate"
                    type="date"
                    className={`Barberrocarda__input ${fieldErrs.endDate ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={toDate(current?.end_at)}
                    required
                  />
                </div>
                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Конец — время <span className="Barberrocarda__req">*</span></label>
                  <input
                    name="endTime"
                    type="time"
                    className={`Barberrocarda__input ${fieldErrs.endTime ? "Barberrocarda__input--invalid" : ""}`}
                    defaultValue={toTime(current?.end_at)}
                    required
                  />
                </div>

                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Статус <span className="Barberrocarda__req">*</span></label>
                  <select
                    name="status"
                    className="Barberrocarda__input"
                    defaultValue={current?.status || "booked"}
                    required
                  >
                    <option value="booked">{STATUS_LABELS.booked}</option>
                    <option value="confirmed">{STATUS_LABELS.confirmed}</option>
                    <option value="completed">{STATUS_LABELS.completed}</option>
                    <option value="canceled">{STATUS_LABELS.canceled}</option>
                    <option value="no_show">{STATUS_LABELS.no_show}</option>
                  </select>
                </div>

                <div className="Barberrocarda__field Barberrocarda__field--full">
                  <label className="Barberrocarda__label">Комментарий</label>
                  <textarea
                    name="comment"
                    className="Barberrocarda__textarea"
                    defaultValue={current?.comment || ""}
                    placeholder="Заметка для мастера/клиента"
                  />
                </div>
              </div>

              <div className="Barberrocarda__form-actions">
                <span className="Barberrocarda__form-actions-spacer" />
                <div className="Barberrocarda__form-actions-right">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="Barberrocarda__btn Barberrocarda__btn--secondary"
                    disabled={saving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="Barberrocarda__btn Barberrocarda__btn--primary"
                  >
                    {saving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* mini modal client */}
      {clientModalOpen && (
        <div
          className="Barberrocarda__modal-overlay"
          onClick={closeClientModal}
          style={{ zIndex: 120 }}
        >
          <div
            className="Barberrocarda__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="Barberrocarda__modal-header">
              <h3 className="Barberrocarda__modal-title">Новый клиент</h3>
              <button
                className="Barberrocarda__icon-btn"
                onClick={closeClientModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {clientAlerts.length > 0 && (
              <div className="Barberrocarda__alert Barberrocarda__alert--inModal">
                {clientAlerts.length === 1 ? (
                  clientAlerts[0]
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {clientAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form className="Barberrocarda__form" onSubmit={handleCreateClient} noValidate>
              <div className="Barberrocarda__form-grid">
                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">
                    ФИО <span className="Barberrocarda__req">*</span>
                  </label>
                  <input
                    name="fullName"
                    className={`Barberrocarda__input ${clientFieldErrs.fullName ? "Barberrocarda__input--invalid" : ""}`}
                    placeholder="Фамилия Имя Отчество"
                    required
                  />
                </div>
                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">
                    Телефон <span className="Barberrocarda__req">*</span>
                  </label>
                  <input
                    name="phone"
                    className={`Barberrocarda__input ${clientFieldErrs.phone ? "Barberrocarda__input--invalid" : ""}`}
                    placeholder="+996 ..."
                    inputMode="tel"
                    required
                  />
                </div>

                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Дата рождения</label>
                  <input name="birthDate" className="Barberrocarda__input" type="date" />
                </div>
                <div className="Barberrocarda__field">
                  <label className="Barberrocarda__label">Статус</label>
                  <select name="status" className="Barberrocarda__input" defaultValue="Активен">
                    {STATUS_OPTIONS_UI.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="Barberrocarda__field Barberrocarda__field--full">
                  <label className="Barberrocarda__label">Заметки</label>
                  <textarea
                    name="notes"
                    className="Barberrocarda__textarea"
                    placeholder="Комментарий, пожелания..."
                  />
                </div>
              </div>

              <div className="Barberrocarda__form-actions">
                <span className="Barberrocarda__form-actions-spacer" />
                <div className="Barberrocarda__form-actions-right">
                  <button
                    type="button"
                    className="Barberrocarda__btn Barberrocarda__btn--secondary"
                    onClick={closeClientModal}
                    disabled={clientSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="Barberrocarda__btn Barberrocarda__btn--primary"
                    disabled={clientSaving}
                  >
                    {clientSaving ? "Сохранение…" : "Сохранить клиента"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {notifications.map((n, i) => (
        <NotificationBanner
          key={n.id}
          appointment={n}
          onClose={() => closeNotification(n.id)}
          lookup={lookup}
          index={i}
        />
      ))}
    </div>
  );
};

export default Recorda;
