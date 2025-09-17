// // src/components/Education/LessonsRooms.jsx
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FaPlus,
//   FaSearch,
//   FaTimes,
//   FaClipboardCheck,
//   FaEdit,
//   FaTrash,
//   FaClock,
//   FaCalendarAlt,
// } from "react-icons/fa";
// import "./LessonsRooms.scss";
// import api from "../../../../api";

// /* ===== endpoints ===== */
// const LESSONS_EP   = "/education/lessons/";
// const COURSES_EP   = "/education/courses/";
// const GROUPS_EP    = "/education/groups/";
// const STUDENTS_EP  = "/education/students/";
// const EMPLOYEES_EP = "/users/employees/";
// const LESSON_ATT   = (id) => `/education/lessons/${id}/attendance/`;

// /* ===== helpers ===== */
// const asArray = (data) =>
//   Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

// const apiErr = (e, fb = "Ошибка запроса.") => {
//   const d = e?.response?.data;
//   if (!d) return fb;
//   if (typeof d === "string") return d;
//   if (typeof d === "object") {
//     try {
//       const k = Object.keys(d)[0];
//       const v = Array.isArray(d[k]) ? d[k][0] : d[k];
//       return String(v || fb);
//     } catch {
//       return fb;
//     }
//   }
//   return fb;
// };

// const listFromAttendance = (res) => {
//   const d = res?.data;
//   if (Array.isArray(d)) return d;
//   if (Array.isArray(d?.results)) return d.results;
//   if (Array.isArray(d?.items)) return d.items;
//   if (Array.isArray(d?.attendances)) return d.attendances;
//   if (d && typeof d === "object") {
//     return Object.entries(d).map(([student, v]) => ({
//       student,
//       present: !!v?.present,
//       note: v?.note || "",
//     }));
//   }
//   return [];
// };

// const toMin = (t) => {
//   if (!t) return 0;
//   const [h, m] = String(t).split(":").map((n) => parseInt(n || "0", 10));
//   return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
// };
// const overlap = (aS, aD, bS, bD) => aS < bS + bD && bS < aS + aD;
// const isTimeStr = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));

// /* ===== normalizers ===== */
// const normalizeCourse = (c = {}) => ({
//   id: c.id,
//   name: c.title ?? "",
// });

// const normalizeGroup = (g = {}) => ({
//   id: g.id,
//   name: g.name ?? "",
//   courseId: g.course ?? "",
//   courseName: g.course_title ?? g.course_name ?? "",
// });

// // ⬇️ поддержка и boolean active, и status-строки
// const normalizeStudent = (s = {}) => {
//   const hasBool = typeof s.active === "boolean";
//   const statusStr = String(s.status ?? "").toLowerCase();
//   const isActive = hasBool ? s.active : statusStr ? statusStr === "active" : true;
//   return {
//     id: s.id,
//     name: s.name ?? "",
//     status: isActive ? "active" : "inactive",
//     isActive,
//     groupId: s.group ?? "",
//   };
// };

// const normalizeEmployee = (e = {}) => {
//   const first = String(e.first_name || "").trim();
//   const last  = String(e.last_name  || "").trim();
//   const full  = `${first} ${last}`.trim();
//   return { id: e.id, name: full || e.email || "—" };
// };

// const normalizeLesson = (l = {}) => ({
//   id: l.id,
//   courseId: l.course ?? "",
//   courseName: l.course_name ?? l.course_title ?? "",
//   groupId: l.group ?? "",
//   groupName: l.group_name ?? "",
//   date: l.date ?? "",
//   time: l.time ?? "",
//   duration: Number(l.duration ?? 0),
//   teacherId: l.teacher ?? "",
//   teacher: l.teacher_name ?? "",
// });

// const LessonsRooms = () => {
//   /* server data */
//   const [courses, setCourses]   = useState([]);
//   const [groups, setGroups]     = useState([]);
//   const [students, setStudents] = useState([]);
//   const [employees, setEmployees] = useState([]);
//   const [lessons, setLessons]   = useState([]);

//   /* ui */
//   const [query, setQuery] = useState("");
//   const [dateFrom, setDateFrom] = useState("");
//   const [dateTo, setDateTo] = useState("");
//   const [error, setError] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [deletingIds, setDeletingIds] = useState(new Set());

//   /* attendance state */
//   const [att, setAtt] = useState({});
//   const [attLoading, setAttLoading] = useState(new Set());
//   const [attSaving, setAttSaving] = useState(new Set());

//   const fetchAll = useCallback(async () => {
//     setError("");
//     try {
//       const [cr, gr, st, em, ls] = await Promise.all([
//         api.get(COURSES_EP),
//         api.get(GROUPS_EP),
//         api.get(STUDENTS_EP),
//         api.get(EMPLOYEES_EP),
//         api.get(LESSONS_EP),
//       ]);
//       setCourses(asArray(cr.data).map(normalizeCourse));
//       setGroups(asArray(gr.data).map(normalizeGroup));
//       setStudents(asArray(st.data).map(normalizeStudent));
//       setEmployees(asArray(em.data).map(normalizeEmployee));
//       setLessons(asArray(ls.data).map(normalizeLesson));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось загрузить данные.");
//     }
//   }, []);
//   useEffect(() => { fetchAll(); }, [fetchAll]);

//   /* search + date filters */
//   const filtered = useMemo(() => {
//     const t = query.toLowerCase().trim();
//     return lessons
//       .filter((r) => (dateFrom ? r.date >= dateFrom : true))
//       .filter((r) => (dateTo ? r.date <= dateTo : true))
//       .filter((r) =>
//         !t
//           ? true
//           : [r.courseName, r.groupName, r.teacher, r.time, r.date]
//               .filter(Boolean)
//               .some((v) => String(v).toLowerCase().includes(t))
//       );
//   }, [lessons, query, dateFrom, dateTo]);

//   /* modal state */
//   const [isModal, setModal] = useState(false);
//   const [mode, setMode] = useState("create"); // 'create' | 'edit'
//   const [editingId, setEditingId] = useState(null);

//   const emptyForm = {
//     courseId: "",
//     groupId: "",
//     date: "",
//     time: "",
//     duration: 90,
//     teacherId: "",
//   };
//   const [form, setForm] = useState(emptyForm);

//   const findGroup = (gid) => groups.find((g) => String(g.id) === String(gid)) || null;

//   const openCreate = () => {
//     setMode("create");
//     setEditingId(null);
//     setForm(emptyForm);
//     setModal(true);
//   };

//   const openEdit = (r) => {
//     const g = r.groupId ? findGroup(r.groupId) : null;
//     setMode("edit");
//     setEditingId(r.id);
//     setForm({
//       courseId: r.courseId || g?.courseId || "",
//       groupId: r.groupId || "",
//       date: r.date || "",
//       time: r.time || "",
//       duration: Number(r.duration || 0) || 90,
//       teacherId: r.teacherId || "",
//     });
//     setModal(true);
//   };

//   const closeModal = () => {
//     setModal(false);
//     setEditingId(null);
//     setMode("create");
//     setForm(emptyForm);
//     setError("");
//   };

//   /* ===== live conflicts (disable busy teachers) ===== */
//   const busyTeacherIds = useMemo(() => {
//     if (!form.date || !isTimeStr(form.time) || !Number(form.duration)) return new Set();
//     const s = toMin(form.time);
//     const d = Number(form.duration);
//     const busy = new Set();
//     lessons.forEach((x) => {
//       if (String(x.id) === String(editingId)) return;
//       if (x.date !== form.date) return;
//       if (overlap(toMin(x.time), Number(x.duration || 0), s, d) && x.teacherId) {
//         busy.add(String(x.teacherId));
//       }
//     });
//     return busy;
//   }, [lessons, form.date, form.time, form.duration, editingId]);

//   const groupOverlapNow = useMemo(() => {
//     if (!form.groupId || !form.date || !isTimeStr(form.time) || !Number(form.duration)) return false;
//     const s = toMin(form.time);
//     const d = Number(form.duration);
//     return lessons.some(
//       (x) =>
//         String(x.id) !== String(editingId) &&
//         x.date === form.date &&
//         String(x.groupId) === String(form.groupId) &&
//         overlap(toMin(x.time), Number(x.duration || 0), s, d)
//     );
//   }, [lessons, form, editingId]);

//   /* ===== final validation helpers ===== */
//   const hasExactDuplicate = (c, excludeId = null) =>
//     lessons.some(
//       (x) =>
//         (!excludeId || String(x.id) !== String(excludeId)) &&
//         String(x.groupId) === String(c.groupId) &&
//         x.date === c.date &&
//         x.time === c.time
//     );

//   const hasGroupOverlap = (c, excludeId = null) => {
//     const cS = toMin(c.time);
//     const cD = Number(c.duration || 0);
//     return lessons.some(
//       (x) =>
//         (!excludeId || String(x.id) !== String(excludeId)) &&
//         x.date === c.date &&
//         String(x.groupId) === String(c.groupId) &&
//         overlap(toMin(x.time), Number(x.duration || 0), cS, cD)
//     );
//   };

//   const hasTeacherOverlap = (c, excludeId = null) => {
//     if (!c.teacherId) return false;
//     const cS = toMin(c.time);
//     const cD = Number(c.duration || 0);
//     return lessons.some(
//       (x) =>
//         (!excludeId || String(x.id) !== String(excludeId)) &&
//         x.date === c.date &&
//         String(x.teacherId || "") === String(c.teacherId || "") &&
//         overlap(toMin(x.time), Number(x.duration || 0), cS, cD)
//     );
//   };

//   /* ===== on-change helpers ===== */
//   const onChangeCourse = (courseId) => {
//     const g = findGroup(form.groupId);
//     const keepGroup = g && String(g.courseId) === String(courseId);
//     setForm((f) => ({ ...f, courseId, groupId: keepGroup ? f.groupId : "" }));
//   };

//   const onChangeGroup = (groupId) => {
//     const g = findGroup(groupId);
//     setForm((f) => ({ ...f, groupId, courseId: g?.courseId || f.courseId }));
//   };

//   /* submit lesson */
//   const submitLesson = async (e) => {
//     e.preventDefault();

//     if (!form.groupId) return setError("Выберите группу.");
//     if (!form.date) return setError("Укажите дату.");
//     if (!isTimeStr(form.time)) return setError("Укажите корректное время (ЧЧ:ММ).");
//     const dur = Number(form.duration ?? 0);
//     if (!Number.isFinite(dur) || dur <= 0 || dur > 1440)
//       return setError("Длительность должна быть от 1 до 1440 минут.");

//     const g = findGroup(form.groupId);
//     if (form.courseId && g && String(g.courseId) !== String(form.courseId)) {
//       return setError("Выбрана группа не из указанного курса.");
//     }

//     const candidate = {
//       id: editingId || "tmp",
//       courseId: form.courseId || g?.courseId || "",
//       courseName:
//         courses.find((c) => String(c.id) === String(form.courseId || g?.courseId))?.name || "",
//       groupId: form.groupId,
//       groupName: g?.name || "",
//       date: form.date,
//       time: form.time,
//       duration: dur,
//       teacherId: form.teacherId || "",
//       teacher: employees.find((t) => String(t.id) === String(form.teacherId))?.name || "",
//     };

//     if (hasExactDuplicate(candidate, mode === "edit" ? editingId : null)) {
//       setError("Дубликат: у этой группы уже есть урок на эту дату и время.");
//       return;
//     }
//     if (hasGroupOverlap(candidate, mode === "edit" ? editingId : null)) {
//       setError("Конфликт: перекрытие с другим занятием группы.");
//       return;
//     }
//     if (hasTeacherOverlap(candidate, mode === "edit" ? editingId : null)) {
//       setError("Преподаватель занят в это время.");
//       return;
//     }

//     const finalCourseId = form.courseId || g?.courseId || null;

//     const payload = {
//       course: finalCourseId,
//       group: form.groupId,
//       teacher: form.teacherId || null,
//       date: form.date,
//       time: form.time,
//       duration: dur,
//     };

//     setSaving(true);
//     setError("");
//     try {
//       if (mode === "create") {
//         const { data } = await api.post(LESSONS_EP, payload);
//         const created = normalizeLesson(data || {});
//         if (created.id) setLessons((p) => [created, ...p]);
//         else {
//           const res = await api.get(LESSONS_EP);
//           setLessons(asArray(res.data).map(normalizeLesson));
//         }
//       } else {
//         const { data } = await api.put(`${LESSONS_EP}${editingId}/`, payload);
//         const updated = data && data.id ? normalizeLesson(data) : candidate;
//         setLessons((p) => p.map((x) => (x.id === editingId ? updated : x)));
//       }
//       closeModal();
//     } catch (err) {
//       console.error(err);
//       setError(apiErr(err, mode === "create" ? "Не удалось создать занятие." : "Не удалось обновить занятие."));
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* delete lesson */
//   const removeLesson = async (id) => {
//     if (!window.confirm("Удалить занятие?")) return;
//     setDeletingIds((p) => new Set(p).add(id));
//     setError("");
//     try {
//       await api.delete(`${LESSONS_EP}${id}/`);
//       setLessons((p) => p.filter((r) => r.id !== id));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось удалить занятие.");
//     } finally {
//       setDeletingIds((prev) => {
//         const n = new Set(prev);
//         n.delete(id);
//         return n;
//       });
//     }
//   };

//   /* attendance */
//   const studentsOfGroup = (gid) =>
//     students.filter(
//       (s) => s.isActive && String(s.groupId) === String(gid)
//     );

//   const loadAttendance = async (lessonId, groupId) => {
//     if (att[lessonId] || attLoading.has(lessonId)) return;
//     setAttLoading((p) => new Set(p).add(lessonId));
//     try {
//       const res = await api.get(LESSON_ATT(lessonId));
//       const arr = listFromAttendance(res);
//       const map = {};
//       arr.forEach((i) => {
//         const sid = i.student || i.student_id || i.id;
//         if (!sid) return;
//         map[sid] = { present: !!i.present, note: i.note || "" };
//       });
//       studentsOfGroup(groupId).forEach((st) => {
//         if (!map[st.id]) map[st.id] = { present: false, note: "" };
//       });
//       setAtt((prev) => ({ ...prev, [lessonId]: map }));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось загрузить посещаемость.");
//     } finally {
//       setAttLoading((prev) => {
//         const n = new Set(prev);
//         n.delete(lessonId);
//         return n;
//       });
//     }
//   };

//   const presentFor = (lid, sid) => !!att[lid]?.[sid]?.present;

//   const toggleAttendance = (lid, sid) => {
//     setAtt((prev) => {
//       const cur = prev[lid] || {};
//       const curItem = cur[sid] || { present: false, note: "" };
//       return {
//         ...prev,
//         [lid]: { ...cur, [sid]: { ...curItem, present: !curItem.present } },
//       };
//     });
//   };

//   const saveAttendance = async (lesson) => {
//     const lid = lesson.id;
//     const items = studentsOfGroup(lesson.groupId).map((st) => ({
//       student: st.id,
//       present: att[lid]?.[st.id]?.present ?? false,
//       note: att[lid]?.[st.id]?.note || "",
//     }));

//     setAttSaving((p) => new Set(p).add(lid));
//     setError("");
//     try {
//       try {
//         await api.put(LESSON_ATT(lid), { items });
//       } catch (e1) {
//         try {
//           await api.put(LESSON_ATT(lid), { attendances: items });
//         } catch (e2) {
//           try {
//             await api.put(LESSON_ATT(lid), { lesson: lid, items });
//           } catch (e3) {
//             await api.put(LESSON_ATT(lid), items);
//           }
//         }
//       }
//     } catch (e) {
//       console.error(e);
//       setError(apiErr(e, "Не удалось сохранить посещаемость."));
//     } finally {
//       setAttSaving((prev) => {
//         const n = new Set(prev);
//         n.delete(lid);
//         return n;
//       });
//     }
//   };

//   return (
//     <div className="Schoollessons">
//       {/* Header */}
//       <div className="Schoollessons__header">
//         <div className="Schoollessons__titleWrap">
//           <h2 className="Schoollessons__title">Уроки</h2>
//           <p className="Schoollessons__subtitle">
//             Курс (по желанию) + группа обязательна. Отмечайте посещаемость.
//           </p>
//         </div>

//         <div className="Schoollessons__search">
//           <FaSearch className="Schoollessons__searchIcon" aria-hidden />
//           <input
//             className="Schoollessons__searchInput"
//             placeholder="Поиск по урокам…"
//             value={query}
//             onChange={(e) => setQuery(e.target.value)}
//             aria-label="Поиск по урокам"
//           />
//         </div>

//         <input
//           type="date"
//           className="Schoollessons__dateFilter"
//           value={dateFrom}
//           onChange={(e) => setDateFrom(e.target.value)}
//           aria-label="Фильтр: с даты"
//         />
//         <input
//           type="date"
//           className="Schoollessons__dateFilter"
//           value={dateTo}
//           onChange={(e) => setDateTo(e.target.value)}
//           aria-label="Фильтр: по дату"
//         />

//         <button
//           className="Schoollessons__btn Schoollessons__btn--primary Schoollessons__createBtn"
//           onClick={openCreate}
//         >
//           <FaPlus /> Создать
//         </button>
//       </div>

//       {!!error && <div className="Schoollessons__alert">{error}</div>}

//       {/* List */}
//       <div className="Schoollessons__list">
//         {filtered.map((r) => {
//           const initial = (r.groupName || "•").charAt(0).toUpperCase();
//           const groupStudents = studentsOfGroup(r.groupId);
//           const deleting = deletingIds.has(r.id);
//           const isLoadingAtt = attLoading.has(r.id);
//           const isSavingAtt = attSaving.has(r.id);
//           const hasAtt = !!att[r.id];

//           return (
//             <div key={r.id} className="Schoollessons__card">
//               <div className="Schoollessons__cardLeft">
//                 <div className="Schoollessons__avatar" aria-hidden>
//                   {initial}
//                 </div>

//                 <div className="Schoollessons__content">
//                   <div className="Schoollessons__row">
//                     <p className="Schoollessons__name">
//                       {r.groupName || "Группа"}
//                       {r.courseName ? (
//                         <span className="Schoollessons__muted"> · {r.courseName}</span>
//                       ) : null}
//                     </p>
//                     <span className="Schoollessons__time">
//                       <FaCalendarAlt style={{ marginRight: 6 }} />
//                       {r.date || "—"}{" "}
//                       <span style={{ marginLeft: 10 }}>
//                         <FaClock /> {r.time || "—"}
//                       </span>
//                     </span>
//                   </div>

//                   <div className="Schoollessons__meta">
//                     <span>Преподаватель: {r.teacher || "—"}</span>
//                     {Number(r.duration) ? <span> • {r.duration} мин</span> : null}
//                   </div>

//                   <details
//                     className="Schoollessons__att"
//                     onToggle={(e) => {
//                       if (e.currentTarget.open) loadAttendance(r.id, r.groupId);
//                     }}
//                   >
//                     <summary>
//                       <FaClipboardCheck /> Посещаемость
//                     </summary>

//                     {isLoadingAtt && (
//                       <div className="Schoollessons__muted">Загрузка…</div>
//                     )}

//                     {hasAtt && (
//                       <>
//                         <ul className="Schoollessons__attList">
//                           {groupStudents.map((st) => (
//                             <li key={st.id} className="Schoollessons__attItem">
//                               <label className="Schoollessons__attLabel">
//                                 <input
//                                   type="checkbox"
//                                   checked={presentFor(r.id, st.id)}
//                                   onChange={() => toggleAttendance(r.id, st.id)}
//                                 />
//                                 <span>{st.name}</span>
//                               </label>
//                             </li>
//                           ))}
//                           {groupStudents.length === 0 && (
//                             <li className="Schoollessons__muted">
//                               В группе нет активных студентов
//                             </li>
//                           )}
//                         </ul>

//                         {groupStudents.length > 0 && (
//                           <div style={{ marginTop: 10 }}>
//                             <button
//                               type="button"
//                               className="Schoollessons__btn Schoollessons__btn--primary"
//                               onClick={() => saveAttendance(r)}
//                               disabled={isSavingAtt}
//                             >
//                               {isSavingAtt
//                                 ? "Сохранение…"
//                                 : "Сохранить посещаемость"}
//                             </button>
//                           </div>
//                         )}
//                       </>
//                     )}
//                   </details>
//                 </div>
//               </div>

//               <div className="Schoollessons__rowActions">
//                 <button
//                   className="Schoollessons__btn Schoollessons__btn--secondary"
//                   onClick={() => openEdit(r)}
//                   title="Изменить"
//                 >
//                   <FaEdit /> Изменить
//                 </button>
//                 <button
//                   className="Schoollessons__btn Schoollessons__btn--danger"
//                   onClick={() => removeLesson(r.id)}
//                   disabled={deleting}
//                   title="Удалить"
//                 >
//                   <FaTrash /> {deleting ? "Удаление…" : "Удалить"}
//                 </button>
//               </div>
//             </div>
//           );
//         })}

//         {filtered.length === 0 && (
//           <div className="Schoollessons__alert">Ничего не найдено.</div>
//         )}
//       </div>

//       {/* Modal */}
//       {isModal && (
//         <div className="Schoollessons__modalOverlay" role="dialog" aria-modal="true">
//           <div className="Schoollessons__modal">
//             <div className="Schoollessons__modalHeader">
//               <h3 className="Schoollessons__modalTitle">
//                 {mode === "create" ? "Новое занятие" : "Изменить занятие"}
//               </h3>
//               <button
//                 className="Schoollessons__iconBtn"
//                 onClick={closeModal}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             <form className="Schoollessons__form" onSubmit={submitLesson}>
//               <div className="Schoollessons__formGrid">
//                 <div className="Schoollessons__field">
//                   <label className="Schoollessons__label">Курс</label>
//                   <select
//                     className="Schoollessons__input"
//                     value={form.courseId}
//                     onChange={(e) => onChangeCourse(e.target.value)}
//                   >
//                     <option value="">— любой/не указан —</option>
//                     {courses.map((c) => (
//                       <option key={c.id} value={c.id}>{c.name}</option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="Schoollessons__field">
//                   <label className="Schoollessons__label">
//                     Группа<span className="Schoollessons__req">*</span>
//                   </label>
//                   <select
//                     className="Schoollessons__input"
//                     value={form.groupId}
//                     onChange={(e) => onChangeGroup(e.target.value)}
//                     required
//                   >
//                     <option value="">— выберите —</option>
//                     {groups
//                       .filter((g) =>
//                         form.courseId ? String(g.courseId) === String(form.courseId) : true
//                       )
//                       .map((g) => (
//                         <option key={g.id} value={g.id}>
//                           {g.name}
//                         </option>
//                       ))}
//                   </select>
//                 </div>

//                 <div className="Schoollessons__field">
//                   <label className="Schoollessons__label">
//                     Дата<span className="Schoollessons__req">*</span>
//                   </label>
//                   <input
//                     className="Schoollessons__input"
//                     type="date"
//                     value={form.date}
//                     onChange={(e) => setForm({ ...form, date: e.target.value })}
//                     required
//                   />
//                 </div>

//                 <div className="Schoollessons__field">
//                   <label className="Schoollessons__label">
//                     Время<span className="Schoollessons__req">*</span>
//                   </label>
//                   <input
//                     className="Schoollessons__input"
//                     type="time"
//                     value={form.time}
//                     onChange={(e) => setForm({ ...form, time: e.target.value })}
//                     required
//                   />
//                 </div>

//                 <div className="Schoollessons__field">
//                   <label className="Schoollessons__label">Преподаватель</label>
//                   <select
//                     className="Schoollessons__input"
//                     value={form.teacherId}
//                     onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
//                   >
//                     <option value="">— не указан —</option>
//                     {employees.map((t) => {
//                       const disabled = busyTeacherIds.has(String(t.id));
//                       return (
//                         <option key={t.id} value={t.id} disabled={disabled}>
//                           {t.name}{disabled ? " (занят)" : ""}
//                         </option>
//                       );
//                     })}
//                   </select>
//                   {form.teacherId && busyTeacherIds.has(String(form.teacherId)) && (
//                     <div className="Schoollessons__alert" style={{ marginTop: 6 }}>
//                       Преподаватель занят в выбранное время.
//                     </div>
//                   )}
//                 </div>

//                 <div className="Schoollessons__field">
//                   <label className="Schoollessons__label">Длительность (мин)</label>
//                   <input
//                     className="Schoollessons__input"
//                     type="number"
//                     min="1"
//                     max="1440"
//                     step="1"
//                     value={form.duration}
//                     onChange={(e) =>
//                       setForm({ ...form, duration: Number(e.target.value || 0) })
//                     }
//                   />
//                 </div>
//               </div>

//               {groupOverlapNow && (
//                 <div className="Schoollessons__alert" style={{ marginTop: 8 }}>
//                   Перекрытие с другим занятием выбранной группы.
//                 </div>
//               )}

//               <div className="Schoollessons__formActions">
//                 <span className="Schoollessons__actionsSpacer" />
//                 <div className="Schoollessons__actionsRight">
//                   <button
//                     type="button"
//                     className="Schoollessons__btn Schoollessons__btn--secondary"
//                     onClick={closeModal}
//                     disabled={saving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="Schoollessons__btn Schoollessons__btn--primary"
//                     disabled={saving}
//                   >
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

//             <div className="Schoollessons__hint">
//               Проверяются дубликаты и перекрытия по группе, занятость преподавателя и согласованность курс⇄группа.
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default LessonsRooms;



// src/components/Education/LessonsRooms.jsx
// проверь путь импорта api при вставке в проект
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaSearch,
  FaTimes,
  FaClipboardCheck,
  FaEdit,
  FaTrash,
  FaClock,
  FaCalendarAlt,
} from "react-icons/fa";
import "./LessonsRooms.scss";
import api from "../../../../api";

/* ===== endpoints ===== */
const LESSONS_EP   = "/education/lessons/";
const COURSES_EP   = "/education/courses/";
const GROUPS_EP    = "/education/groups/";
const STUDENTS_EP  = "/education/students/";
const EMPLOYEES_EP = "/users/employees/";
const LESSON_ATT   = (id) => `/education/lessons/${id}/attendance/`;

/* ===== constants ===== */
const PAGE_SIZE = 15;

/* ===== helpers ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const apiErr = (e, fb = "Ошибка запроса.") => {
  const d = e?.response?.data;
  if (!d) return fb;
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    try {
      const k = Object.keys(d)[0];
      const v = Array.isArray(d[k]) ? d[k][0] : d[k];
      return String(v || fb);
    } catch { return fb; }
  }
  return fb;
};

const listFromAttendance = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.attendances)) return d.attendances;
  if (d && typeof d === "object") {
    return Object.entries(d).map(([student, v]) => ({
      student,
      present: !!v?.present,
      note: v?.note || "",
    }));
  }
  return [];
};

const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map((n) => parseInt(n || "0", 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};
const overlap = (aS, aD, bS, bD) => aS < bS + bD && bS < aS + aD;
const isTimeStr = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));

/* ===== normalizers ===== */
const normalizeCourse = (c = {}) => ({ id: c.id, name: c.title ?? "" });

const normalizeGroup = (g = {}) => ({
  id: g.id,
  name: g.name ?? "",
  courseId: g.course ?? "",
  courseName: g.course_title ?? g.course_name ?? "",
});

const normalizeStudent = (s = {}) => {
  const hasBool = typeof s.active === "boolean";
  const statusStr = String(s.status ?? "").toLowerCase();
  const isActive = hasBool ? s.active : statusStr ? statusStr === "active" : true;
  return {
    id: s.id,
    name: s.name ?? "",
    status: isActive ? "active" : "inactive",
    isActive,
    groupId: s.group ?? "",
  };
};

const normalizeEmployee = (e = {}) => {
  const first = String(e.first_name || "").trim();
  const last  = String(e.last_name  || "").trim();
  const full  = `${first} ${last}`.trim();
  return { id: e.id, name: full || e.email || "—" };
};

const normalizeLesson = (l = {}) => ({
  id: l.id,
  courseId: l.course ?? "",
  courseName: l.course_name ?? l.course_title ?? "",
  groupId: l.group ?? "",
  groupName: l.group_name ?? "",
  date: l.date ?? "",
  time: l.time ?? "",
  duration: Number(l.duration ?? 0),
  teacherId: l.teacher ?? "",
  teacher: l.teacher_name ?? "",
});

/* ===== component ===== */
const LessonsRooms = () => {
  /* server data */
  const [courses, setCourses]     = useState([]);
  const [groups, setGroups]       = useState([]);
  const [students, setStudents]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [lessons, setLessons]     = useState([]);

  /* ui */
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState(new Set());

  /* pagination (15/стр) */
  const [page, setPage] = useState(1);

  /* confirm dialog (без window.confirm) */
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });
  const askDelete = (rec) =>
    setConfirm({
      open: true,
      id: rec.id,
      name: `${rec.groupName || "Группа"} — ${rec.date || "—"} ${rec.time || ""}`.trim(),
    });
  const closeConfirm = () => setConfirm({ open: false, id: null, name: "" });

  /* attendance state */
  const [att, setAtt] = useState({});
  const [attLoading, setAttLoading] = useState(new Set());
  const [attSaving, setAttSaving] = useState(new Set());

  /* load all */
  const fetchAll = useCallback(async () => {
    setError("");
    try {
      const [cr, gr, st, em, ls] = await Promise.all([
        api.get(COURSES_EP),
        api.get(GROUPS_EP),
        api.get(STUDENTS_EP),
        api.get(EMPLOYEES_EP),
        api.get(LESSONS_EP),
      ]);
      setCourses(asArray(cr.data).map(normalizeCourse));
      setGroups(asArray(gr.data).map(normalizeGroup));
      setStudents(asArray(st.data).map(normalizeStudent));
      setEmployees(asArray(em.data).map(normalizeEmployee));
      setLessons(asArray(ls.data).map(normalizeLesson));
      setPage(1);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные.");
    }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* search + date filters */
  const filtered = useMemo(() => {
    const t = query.toLowerCase().trim();
    return lessons
      .filter((r) => (dateFrom ? r.date >= dateFrom : true))
      .filter((r) => (dateTo ? r.date <= dateTo : true))
      .filter((r) =>
        !t
          ? true
          : [r.courseName, r.groupName, r.teacher, r.time, r.date]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(t))
      );
  }, [lessons, query, dateFrom, dateTo]);

  /* paginate */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [query, dateFrom, dateTo, filtered.length]);
  const pageWindow = useMemo(() => {
    const around = 2;
    const start = Math.max(1, page - around);
    const end = Math.min(totalPages, page + around);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);
  const paged = useMemo(() => {
    const s = (page - 1) * PAGE_SIZE;
    return filtered.slice(s, s + PAGE_SIZE);
  }, [filtered, page]);

  /* modal state */
  const [isModal, setModal] = useState(false);
  const [mode, setMode] = useState("create"); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    courseId: "",
    groupId: "",
    date: "",
    time: "",
    duration: 90,
    teacherId: "",
  };
  const [form, setForm] = useState(emptyForm);

  const findGroup = (gid) => groups.find((g) => String(g.id) === String(gid)) || null;

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (r) => {
    const g = r.groupId ? findGroup(r.groupId) : null;
    setMode("edit");
    setEditingId(r.id);
    setForm({
      courseId: r.courseId || g?.courseId || "",
      groupId: r.groupId || "",
      date: r.date || "",
      time: r.time || "",
      duration: Number(r.duration || 0) || 90,
      teacherId: r.teacherId || "",
    });
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditingId(null);
    setMode("create");
    setForm(emptyForm);
    setError("");
  };

  /* занятость преподавателей */
  const busyTeacherIds = useMemo(() => {
    if (!form.date || !isTimeStr(form.time) || !Number(form.duration)) return new Set();
    const s = toMin(form.time);
    const d = Number(form.duration);
    const busy = new Set();
    lessons.forEach((x) => {
      if (String(x.id) === String(editingId)) return;
      if (x.date !== form.date) return;
      if (overlap(toMin(x.time), Number(x.duration || 0), s, d) && x.teacherId) {
        busy.add(String(x.teacherId));
      }
    });
    return busy;
  }, [lessons, form.date, form.time, form.duration, editingId]);

  const groupOverlapNow = useMemo(() => {
    if (!form.groupId || !form.date || !isTimeStr(form.time) || !Number(form.duration)) return false;
    const s = toMin(form.time);
    const d = Number(form.duration);
    return lessons.some(
      (x) =>
        String(x.id) !== String(editingId) &&
        x.date === form.date &&
        String(x.groupId) === String(form.groupId) &&
        overlap(toMin(x.time), Number(x.duration || 0), s, d)
    );
  }, [lessons, form, editingId]);

  /* финальные проверки */
  const hasExactDuplicate = (c, excludeId = null) =>
    lessons.some(
      (x) =>
        (!excludeId || String(x.id) !== String(excludeId)) &&
        String(x.groupId) === String(c.groupId) &&
        x.date === c.date &&
        x.time === c.time
    );

  const hasGroupOverlap = (c, excludeId = null) => {
    const cS = toMin(c.time);
    const cD = Number(c.duration || 0);
    return lessons.some(
      (x) =>
        (!excludeId || String(x.id) !== String(excludeId)) &&
        x.date === c.date &&
        String(x.groupId) === String(c.groupId) &&
        overlap(toMin(x.time), Number(x.duration || 0), cS, cD)
    );
  };

  const hasTeacherOverlap = (c, excludeId = null) => {
    if (!c.teacherId) return false;
    const cS = toMin(c.time);
    const cD = Number(c.duration || 0);
    return lessons.some(
      (x) =>
        (!excludeId || String(x.id) !== String(excludeId)) &&
        x.date === c.date &&
        String(x.teacherId || "") === String(c.teacherId || "") &&
        overlap(toMin(x.time), Number(x.duration || 0), cS, cD)
    );
  };

  /* on-change */
  const onChangeCourse = (courseId) => {
    const g = findGroup(form.groupId);
    const keepGroup = g && String(g.courseId) === String(courseId);
    setForm((f) => ({ ...f, courseId, groupId: keepGroup ? f.groupId : "" }));
  };
  const onChangeGroup = (groupId) => {
    const g = findGroup(groupId);
    setForm((f) => ({ ...f, groupId, courseId: g?.courseId || f.courseId }));
  };

  /* submit */
  const submitLesson = async (e) => {
    e.preventDefault();

    if (!form.groupId) return setError("Выберите группу.");
    if (!form.date) return setError("Укажите дату.");
    if (!isTimeStr(form.time)) return setError("Укажите корректное время (ЧЧ:ММ).");
    const dur = Number(form.duration ?? 0);
    if (!Number.isFinite(dur) || dur <= 0 || dur > 1440)
      return setError("Длительность должна быть от 1 до 1440 минут.");

    const g = findGroup(form.groupId);
    if (form.courseId && g && String(g.courseId) !== String(form.courseId)) {
      return setError("Выбрана группа не из указанного курса.");
    }

    const candidate = {
      id: editingId || "tmp",
      courseId: form.courseId || g?.courseId || "",
      courseName:
        courses.find((c) => String(c.id) === String(form.courseId || g?.courseId))?.name || "",
      groupId: form.groupId,
      groupName: g?.name || "",
      date: form.date,
      time: form.time,
      duration: dur,
      teacherId: form.teacherId || "",
      teacher: employees.find((t) => String(t.id) === String(form.teacherId))?.name || "",
    };

    if (hasExactDuplicate(candidate, mode === "edit" ? editingId : null)) {
      setError("Дубликат: у этой группы уже есть занятие на эти дату и время.");
      return;
    }
    if (hasGroupOverlap(candidate, mode === "edit" ? editingId : null)) {
      setError("Перекрытие с другим занятием группы.");
      return;
    }
    if (hasTeacherOverlap(candidate, mode === "edit" ? editingId : null)) {
      setError("Преподаватель занят в это время.");
      return;
    }

    const finalCourseId = form.courseId || g?.courseId || null;
    const payload = {
      course: finalCourseId,
      group: form.groupId,
      teacher: form.teacherId || null,
      date: form.date,
      time: form.time,
      duration: dur,
    };

    setSaving(true);
    setError("");
    try {
      if (mode === "create") {
        const { data } = await api.post(LESSONS_EP, payload);
        const created = normalizeLesson(data || {});
        if (created.id) setLessons((p) => [created, ...p]);
        else {
          const res = await api.get(LESSONS_EP);
          setLessons(asArray(res.data).map(normalizeLesson));
        }
      } else {
        const { data } = await api.put(`${LESSONS_EP}${editingId}/`, payload);
        const updated = data && data.id ? normalizeLesson(data) : candidate;
        setLessons((p) => p.map((x) => (x.id === editingId ? updated : x)));
      }
      closeModal();
    } catch (err) {
      console.error(err);
      setError(apiErr(err, mode === "create" ? "Не удалось создать занятие." : "Не удалось обновить занятие."));
    } finally {
      setSaving(false);
    }
  };

  /* delete (через свой confirm) */
  const deleteLesson = async (id) => {
    setDeletingIds((p) => new Set(p).add(id));
    setError("");
    try {
      await api.delete(`${LESSONS_EP}${id}/`);
      setLessons((p) => p.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить занятие.");
    } finally {
      setDeletingIds((prev) => {
        const n = new Set(prev); n.delete(id); return n;
      });
    }
  };
  const confirmYes = async () => {
    const id = confirm.id;
    closeConfirm();
    if (id) await deleteLesson(id);
  };

  /* attendance */
  const studentsOfGroup = (gid) =>
    students.filter((s) => s.isActive && String(s.groupId) === String(gid));

  const loadAttendance = async (lessonId, groupId) => {
    if (att[lessonId] || attLoading.has(lessonId)) return;
    setAttLoading((p) => new Set(p).add(lessonId));
    try {
      const res = await api.get(LESSON_ATT(lessonId));
      const arr = listFromAttendance(res);
      const map = {};
      arr.forEach((i) => {
        const sid = i.student || i.student_id || i.id;
        if (!sid) return;
        map[sid] = { present: !!i.present, note: i.note || "" };
      });
      studentsOfGroup(groupId).forEach((st) => {
        if (!map[st.id]) map[st.id] = { present: false, note: "" };
      });
      setAtt((prev) => ({ ...prev, [lessonId]: map }));
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить посещаемость.");
    } finally {
      setAttLoading((prev) => { const n = new Set(prev); n.delete(lessonId); return n; });
    }
  };

  const presentFor = (lid, sid) => !!att[lid]?.[sid]?.present;
  const toggleAttendance = (lid, sid) => {
    setAtt((prev) => {
      const cur = prev[lid] || {};
      const curItem = cur[sid] || { present: false, note: "" };
      return { ...prev, [lid]: { ...cur, [sid]: { ...curItem, present: !curItem.present } } };
    });
  };

  const saveAttendance = async (lesson) => {
    const lid = lesson.id;
    const items = studentsOfGroup(lesson.groupId).map((st) => ({
      student: st.id,
      present: att[lid]?.[st.id]?.present ?? false,
      note: att[lid]?.[st.id]?.note || "",
    }));

    setAttSaving((p) => new Set(p).add(lid));
    setError("");
    try {
      try { await api.put(LESSON_ATT(lid), { items }); }
      catch { try { await api.put(LESSON_ATT(lid), { attendances: items }); }
      catch { try { await api.put(LESSON_ATT(lid), { lesson: lid, items }); }
      catch { await api.put(LESSON_ATT(lid), items); }}}
    } catch (e) {
      console.error(e);
      setError(apiErr(e, "Не удалось сохранить посещаемость."));
    } finally {
      setAttSaving((prev) => { const n = new Set(prev); n.delete(lid); return n; });
    }
  };

  /* ===== render ===== */
  return (
    <div className="Schoollessons">
      {/* Header */}
      <div className="Schoollessons__header">
        <div className="Schoollessons__titleWrap">
          <h2 className="Schoollessons__title">Уроки</h2>
          <p className="Schoollessons__subtitle">
            Курс (по желанию) + группа обязательна. Отмечайте посещаемость.
          </p>
        </div>

        <div className="Schoollessons__search">
          <FaSearch className="Schoollessons__searchIcon" aria-hidden />
          <input
            className="Schoollessons__searchInput"
            placeholder="Поиск по урокам…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск по урокам"
          />
        </div>

        <input
          type="date"
          className="Schoollessons__dateFilter"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Фильтр: с даты"
        />
        <input
          type="date"
          className="Schoollessons__dateFilter"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Фильтр: по дату"
        />

        <button
          className="Schoollessons__btn Schoollessons__btn--primary Schoollessons__createBtn"
          onClick={openCreate}
        >
          <FaPlus /> Создать
        </button>
      </div>

      {!!error && <div className="Schoollessons__alert">{error}</div>}

      {/* List */}
      <div className="Schoollessons__list" role="list">
        {paged.map((r) => {
          const initial = (r.groupName || "•").charAt(0).toUpperCase();
          const groupStudents = studentsOfGroup(r.groupId);
          const deleting = deletingIds.has(r.id);
          const isLoadingAtt = attLoading.has(r.id);
          const isSavingAtt = attSaving.has(r.id);
          const hasAtt = !!att[r.id];

          return (
            <div key={r.id} className="Schoollessons__card" role="listitem">
              <div className="Schoollessons__cardLeft">
                <div className="Schoollessons__avatar" aria-hidden>
                  {initial}
                </div>

                <div className="Schoollessons__content">
                  <div className="Schoollessons__row">
                    <p className="Schoollessons__name">
                      {r.groupName || "Группа"}
                      {r.courseName ? (
                        <span className="Schoollessons__muted"> · {r.courseName}</span>
                      ) : null}
                    </p>
                    <span className="Schoollessons__time" title="Дата и время">
                      <FaCalendarAlt aria-hidden style={{ marginRight: 6 }} />
                      {r.date || "—"}{" "}
                      <span style={{ marginLeft: 10 }}>
                        <FaClock aria-hidden /> {r.time || "—"}
                      </span>
                    </span>
                  </div>

                  <div className="Schoollessons__meta">
                    <span>Преподаватель: {r.teacher || "—"}</span>
                    {Number(r.duration) ? <span> • {r.duration} мин</span> : null}
                  </div>

                  <details
                    className="Schoollessons__att"
                    onToggle={(e) => {
                      if (e.currentTarget.open) loadAttendance(r.id, r.groupId);
                    }}
                  >
                    <summary>
                      <FaClipboardCheck aria-hidden /> Посещаемость
                    </summary>

                    {isLoadingAtt && (
                      <div className="Schoollessons__muted">Загрузка…</div>
                    )}

                    {hasAtt && (
                      <>
                        <ul className="Schoollessons__attList">
                          {groupStudents.map((st) => (
                            <li key={st.id} className="Schoollessons__attItem">
                              <label className="Schoollessons__attLabel">
                                <input
                                  type="checkbox"
                                  checked={presentFor(r.id, st.id)}
                                  onChange={() => toggleAttendance(r.id, st.id)}
                                  aria-label={`Присутствие: ${st.name}`}
                                />
                                <span>{st.name}</span>
                              </label>
                            </li>
                          ))}
                          {groupStudents.length === 0 && (
                            <li className="Schoollessons__muted">
                              В группе нет активных студентов.
                            </li>
                          )}
                        </ul>

                        {groupStudents.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              className="Schoollessons__btn Schoollessons__btn--primary"
                              onClick={() => saveAttendance(r)}
                              disabled={isSavingAtt}
                            >
                              {isSavingAtt ? "Сохранение…" : "Сохранить посещаемость"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </details>
                </div>
              </div>

              <div className="Schoollessons__rowActions">
                <button
                  type="button"
                  className="Schoollessons__btn Schoollessons__btn--secondary"
                  onClick={() => openEdit(r)}
                  title="Изменить"
                >
                  <FaEdit aria-hidden /> Изменить
                </button>
                <button
                  type="button"
                  className="Schoollessons__btn Schoollessons__btn--danger"
                  onClick={() => askDelete(r)}
                  disabled={deleting}
                  title="Удалить"
                >
                  <FaTrash aria-hidden /> {deleting ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="Schoollessons__alert">Ничего не найдено.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="Schoollessons__pagination" role="navigation" aria-label="Пагинация">
          <button
            type="button"
            className="Schoollessons__pageBtn"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Предыдущая страница"
          >
            ←
          </button>

          {pageWindow[0] > 1 && (
            <>
              <button type="button" className="Schoollessons__pageBtn" onClick={() => setPage(1)}>1</button>
              <span className="Schoollessons__dots">…</span>
            </>
          )}

          {pageWindow.map((p) => (
            <button
              key={p}
              type="button"
              className={`Schoollessons__pageBtn ${p === page ? "Schoollessons__pageBtn--active" : ""}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}

          {pageWindow[pageWindow.length - 1] < totalPages && (
            <>
              <span className="Schoollessons__dots">…</span>
              <button type="button" className="Schoollessons__pageBtn" onClick={() => setPage(totalPages)}>
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            className="Schoollessons__pageBtn"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Следующая страница"
          >
            →
          </button>

          <div className="Schoollessons__pageInfo">
            Стр. {page}/{totalPages} • Показано {paged.length} из {filtered.length}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModal && (
        <div className="Schoollessons__modalOverlay" role="dialog" aria-modal="true">
          <div className="Schoollessons__modal" role="document">
            <div className="Schoollessons__modalHeader">
              <h3 className="Schoollessons__modalTitle">
                {mode === "create" ? "Новое занятие" : "Изменить занятие"}
              </h3>
              <button
                className="Schoollessons__iconBtn"
                onClick={closeModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="Schoollessons__form" onSubmit={submitLesson}>
              <div className="Schoollessons__formGrid">
                <div className="Schoollessons__field">
                  <label className="Schoollessons__label">Курс</label>
                  <select
                    className="Schoollessons__input"
                    value={form.courseId}
                    onChange={(e) => onChangeCourse(e.target.value)}
                  >
                    <option value="">— любой/не указан —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="Schoollessons__field">
                  <label className="Schoollessons__label">
                    Группа<span className="Schoollessons__req">*</span>
                  </label>
                  <select
                    className="Schoollessons__input"
                    value={form.groupId}
                    onChange={(e) => onChangeGroup(e.target.value)}
                    required
                  >
                    <option value="">— выберите —</option>
                    {groups
                      .filter((g) =>
                        form.courseId ? String(g.courseId) === String(form.courseId) : true
                      )
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                  </select>
                </div>

                <div className="Schoollessons__field">
                  <label className="Schoollessons__label">
                    Дата<span className="Schoollessons__req">*</span>
                  </label>
                  <input
                    className="Schoollessons__input"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>

                <div className="Schoollessons__field">
                  <label className="Schoollessons__label">
                    Время<span className="Schoollessons__req">*</span>
                  </label>
                  <input
                    className="Schoollessons__input"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    required
                  />
                </div>

                <div className="Schoollessons__field">
                  <label className="Schoollessons__label">Преподаватель</label>
                  <select
                    className="Schoollessons__input"
                    value={form.teacherId}
                    onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                  >
                    <option value="">— не указан —</option>
                    {employees.map((t) => {
                      const disabled = busyTeacherIds.has(String(t.id));
                      return (
                        <option key={t.id} value={t.id} disabled={disabled}>
                          {t.name}{disabled ? " (занят)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {form.teacherId && busyTeacherIds.has(String(form.teacherId)) && (
                    <div className="Schoollessons__alert" style={{ marginTop: 6 }}>
                      Преподаватель занят в выбранное время.
                    </div>
                  )}
                </div>

                <div className="Schoollessons__field">
                  <label className="Schoollessons__label">Длительность (мин)</label>
                  <input
                    className="Schoollessons__input"
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value || 0) })}
                  />
                </div>
              </div>

              {groupOverlapNow && (
                <div className="Schoollessons__alert" style={{ marginTop: 8 }}>
                  Перекрытие с другим занятием выбранной группы.
                </div>
              )}

              <div className="Schoollessons__formActions">
                <span className="Schoollessons__actionsSpacer" />
                <div className="Schoollessons__actionsRight">
                  <button
                    type="button"
                    className="Schoollessons__btn Schoollessons__btn--secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="Schoollessons__btn Schoollessons__btn--primary"
                    disabled={saving}
                  >
                    {saving
                      ? mode === "create" ? "Сохранение…" : "Обновление…"
                      : mode === "create" ? "Сохранить" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>

            <div className="Schoollessons__hint">
              Проверяются дубликаты и перекрытия по группе, занятость преподавателя и согласованность курс⇄группа.
            </div>
          </div>
        </div>
      )}

      {/* Confirm */}
      {confirm.open && (
        <div className="Schoollessons__modalOverlay" role="dialog" aria-modal="true" onClick={closeConfirm}>
          <div className="Schoollessons__confirm" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="Schoollessons__confirmTitle">Подтверждение</div>
            <div className="Schoollessons__confirmText">
              Удалить занятие «{confirm.name}»? Действие необратимо.
            </div>
            <div className="Schoollessons__confirmActions">
              <button type="button" className="Schoollessons__btn Schoollessons__btn--secondary" onClick={closeConfirm}>
                Нет
              </button>
              <button type="button" className="Schoollessons__btn Schoollessons__btn--danger" onClick={confirmYes}>
                Да
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonsRooms;
