/* eslint-disable react-hooks/rules-of-hooks */
// // src/components/Education/Invoices.jsx
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FaSearch,
//   FaSync,
//   FaMoneyBillWave,
//   FaClock,
//   FaHashtag,
//   FaSave,
// } from "react-icons/fa";
// import "./Invoices.scss";
// import api from "../../../../api";

// /* ====== Redux (Аналитика продаж/склада) ====== */
// import { useDispatch, useSelector } from "react-redux";
// import { historySellProduct } from "../../../../store/creators/saleThunk";
// import {
//   fetchProductsAsync,
//   fetchBrandsAsync,
//   fetchCategoriesAsync,
// } from "../../../../store/creators/productCreators";
// import { useSale } from "../../../../store/slices/saleSlice";

// /* ===== endpoints ===== */
// const EP_STUDENTS = "/education/students/";
// const EP_COURSES = "/education/courses/";
// const EP_GROUPS = "/education/groups/";
// const EP_LESSONS = "/education/lessons/";
// const EP_EMPLOYEES = "/users/employees/";

// /* ===== helpers (общие) ===== */
// const asArray = (data) =>
//   Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

// const listFrom = (r) => r?.data?.results || r?.data || [];
// const dec = (v) => Number(String(v ?? "0").replace(",", "."));
// const money = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;
// const pad2 = (n) => String(n).padStart(2, "0");
// const endOfMonthISO = (year, month) =>
//   new Date(year, month, 0).toISOString().slice(0, 10);
// const sameMonth = (iso, year, month) => {
//   if (!iso) return false;
//   const d = new Date(iso);
//   return d.getFullYear() === year && d.getMonth() + 1 === month;
// };

// /* ===== tiny sparkline ===== */
// const Sparkline = ({ values = [], width = 520, height = 140 }) => {
//   if (!values.length) {
//     return <div className="school-anal__sparkline-empty">Нет данных</div>;
//   }
//   const pad = 8;
//   const W = width - pad * 2;
//   const H = height - pad * 2;

//   const min = Math.min(...values);
//   const max = Math.max(...values);
//   const pts = values.map((v, i) => {
//     const x = pad + (i * W) / Math.max(1, values.length - 1);
//     const ratio = max === min ? 0.5 : (v - min) / (max - min);
//     const y = pad + (1 - ratio) * H;
//     return [x, y];
//   });
//   const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");

//   return (
//     <svg className="school-anal__sparkline" viewBox={`0 0 ${width} ${height}`} role="img">
//       <polyline
//         fill="none"
//         stroke="var(--border)"
//         strokeWidth="1"
//         points={`${pad},${height - pad} ${width - pad},${height - pad}`}
//       />
//       <path d={d} fill="none" stroke="var(--text)" strokeWidth="2" />
//       {pts.map(([x, y], i) => (
//         <circle key={i} cx={x} cy={y} r="2.2" fill="var(--text)" />
//       ))}
//     </svg>
//   );
// };

// /* =========================================================
//    ВКЛАДКА 1: СЧЕТА/АНАЛИТИКА ПО УЧЕБЕ
//    ========================================================= */
// const InvoicesTab = () => {
//   /* период: только месяц */
//   const now = new Date();
//   const YEARS = [2025, 2026];
//   const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
//   const defaultYear = YEARS.includes(now.getFullYear()) ? now.getFullYear() : 2025;

//   const [year, setYear] = useState(defaultYear);
//   const [month, setMonth] = useState(now.getMonth() + 1);
//   const periodLabel = `${year}-${pad2(month)}`;
//   const periodEndISO = useMemo(() => endOfMonthISO(year, month), [year, month]);

//   /* фильтры */
//   const [courseId, setCourseId] = useState("");
//   const [groupId, setGroupId] = useState("");
//   const [teacherId, setTeacherId] = useState("");
//   const [qText, setQText] = useState("");

//   /* data */
//   const [students, setStudents] = useState([]);
//   const [courses, setCourses] = useState([]);
//   const [groups, setGroups] = useState([]);
//   const [lessons, setLessons] = useState([]);
//   const [teachers, setTeachers] = useState([]);

//   /* state */
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   /* зарплата: режим и ставки */
//   const [rateMode, setRateMode] = useState(
//     localStorage.getItem("inv_rate_mode") || "hour" // hour | lesson | month
//   );
//   const [teacherRates, setTeacherRates] = useState(() => {
//     try {
//       const raw = localStorage.getItem("inv_teacher_rates");
//       return raw ? JSON.parse(raw) : {};
//     } catch {
//       return {};
//     }
//   });
//   const saveRatesToLS = useCallback(
//     (rates = teacherRates, mode = rateMode) => {
//       localStorage.setItem("inv_teacher_rates", JSON.stringify(rates || {}));
//       localStorage.setItem("inv_rate_mode", mode);
//     },
//     [teacherRates, rateMode]
//   );

//   /* normalize */
//   const normStudent = (s = {}) => ({
//     id: s.id,
//     name: s.name ?? "",
//     phone: s.phone ?? "",
//     status: s.status ?? "active",
//     groupId: s.group ?? "",
//     groupName: s.group_name ?? "",
//     discount: dec(s.discount),
//     createdAtISO: s.created_at
//       ? String(s.created_at)
//       : new Date().toISOString().slice(0, 10),
//     createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
//   });
//   const normCourse = (c = {}) => ({
//     id: c.id,
//     name: c.title ?? "",
//     price: dec(c.price_per_month),
//   });
//   const normGroup = (g = {}) => ({
//     id: g.id,
//     name: g.name ?? "",
//     courseId: g.course ?? "",
//     courseName: g.course_title ?? "",
//   });
//   const isTimeStr = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));
//   const normLesson = (l = {}) => ({
//     id: l.id,
//     groupId: l.group ?? "",
//     date: l.date ?? "",
//     time: isTimeStr(l.time) ? l.time : "",
//     duration: Number(l.duration ?? 0),
//     teacherId: l.teacher ?? "",
//   });
//   const normEmployeeAsTeacher = (e = {}) => {
//     const first = e.first_name ?? "";
//     const last = e.last_name ?? "";
//     const display = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//     return { id: e.id, name: display };
//   };

//   /* load all */
//   const loadAll = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const [st, cr, gr, ls, em] = await Promise.all([
//         api.get(EP_STUDENTS),
//         api.get(EP_COURSES),
//         api.get(EP_GROUPS),
//         api.get(EP_LESSONS),
//         api.get(EP_EMPLOYEES),
//       ]);
//       setStudents(asArray(st.data).map(normStudent));
//       setCourses(asArray(cr.data).map(normCourse));
//       setGroups(asArray(gr.data).map(normGroup));
//       setLessons(asArray(ls.data).map(normLesson));
//       setTeachers(asArray(em.data).map(normEmployeeAsTeacher));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось загрузить данные для аналитики.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadAll();
//   }, [loadAll]);

//   useEffect(() => {
//     setGroupId("");
//   }, [courseId]);

//   /* активные студенты по фильтрам и периоду */
//   const baseStudents = useMemo(() => {
//     return students.filter((s) => {
//       if (s.status !== "active") return false;
//       if (new Date(s.createdAtISO) > new Date(periodEndISO)) return false;

//       if (courseId) {
//         const g = groups.find((x) => String(x.id) === String(s.groupId));
//         if (!g || String(g.courseId) !== String(courseId)) return false;
//       }
//       if (groupId && String(s.groupId) !== String(groupId)) return false;

//       return true;
//     });
//   }, [students, groups, courseId, groupId, periodEndISO]);

//   /* строки по ученикам */
//   const rows = useMemo(() => {
//     const out = [];
//     baseStudents.forEach((st) => {
//       const grp = groups.find((g) => String(g.id) === String(st.groupId));
//       const crs = grp ? courses.find((c) => String(c.id) === String(grp.courseId)) : null;
//       const price = Number(crs?.price || 0);
//       if (!price) return;

//       const discount = Number(st.discount || 0);
//       const amount = Math.max(0, price - discount);

//       out.push({
//         id: `${st.id}-${periodLabel}`,
//         studentId: st.id,
//         studentName: st.name,
//         phone: st.phone,
//         courseId: crs?.id || grp?.courseId || "",
//         courseName: crs?.name || grp?.courseName || "—",
//         groupId: grp?.id || "",
//         groupName: grp?.name || st.groupName || "—",
//         price,
//         discount,
//         amount,
//         createdAt: st.createdAt,
//       });
//     });
//     return out;
//   }, [baseStudents, groups, courses, periodLabel]);

//   /* поиск по ученикам */
//   const filteredRows = useMemo(() => {
//     const t = qText.toLowerCase().trim();
//     if (!t) return rows;
//     return rows.filter((r) =>
//       [r.studentName, r.phone, r.courseName, r.groupName]
//         .filter(Boolean)
//         .some((v) => String(v).toLowerCase().includes(t))
//     );
//   }, [rows, qText]);

//   /* сводные по ученикам */
//   const totals = useMemo(() => {
//     const amount = filteredRows.reduce((acc, x) => acc + Number(x.amount || 0), 0);
//     const count = filteredRows.length;
//     return { amount, students: count, avg: count ? amount / count : 0 };
//   }, [filteredRows]);

//   const byCourse = useMemo(() => {
//     const map = new Map();
//     filteredRows.forEach((r) => {
//       const k = r.courseId || r.courseName;
//       if (!map.has(k)) map.set(k, { name: r.courseName, amount: 0, count: 0 });
//       const v = map.get(k);
//       v.amount += Number(r.amount || 0);
//       v.count += 1;
//     });
//     return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
//   }, [filteredRows]);

//   const byGroup = useMemo(() => {
//     const map = new Map();
//     filteredRows.forEach((r) => {
//       const k = r.groupId || `${r.courseName}/${r.groupName}`;
//       if (!map.has(k))
//         map.set(k, {
//           name: r.groupName,
//           amount: 0,
//           count: 0,
//           courseName: r.courseName,
//         });
//       const v = map.get(k);
//       v.amount += Number(r.amount || 0);
//       v.count += 1;
//     });
//     return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
//   }, [filteredRows]);

//   const maxCourseAmount = Math.max(1, ...byCourse.map((c) => c.amount));
//   const maxGroupAmount = Math.max(1, ...byGroup.map((g) => g.amount));

//   /* ===== ЗАРПЛАТА ПРЕПОДАВАТЕЛЕЙ ===== */
//   const lessonsInPeriod = useMemo(() => {
//     return lessons.filter((l) => {
//       if (!sameMonth(l.date, year, month)) return false;

//       const grp = groups.find((g) => String(g.id) === String(l.groupId));
//       if (courseId && (!grp || String(grp.courseId) !== String(courseId))) return false;
//       if (groupId && String(l.groupId) !== String(groupId)) return false;
//       if (teacherId && String(l.teacherId) !== String(teacherId)) return false;

//       return true;
//     });
//   }, [lessons, groups, year, month, courseId, groupId, teacherId]);

//   const teacherStats = useMemo(() => {
//     const activeStudentsByGroup = new Map();
//     baseStudents.forEach((s) => {
//       const arr = activeStudentsByGroup.get(s.groupId) || [];
//       arr.push(s);
//       activeStudentsByGroup.set(s.groupId, arr);
//     });

//     const byTeacher = new Map();
//     lessonsInPeriod.forEach((l) => {
//       if (!l.teacherId) return;
//       const tId = l.teacherId;
//       if (!byTeacher.has(tId)) {
//         const teacherName =
//           teachers.find((t) => String(t.id) === String(tId))?.name || "—";
//         byTeacher.set(tId, {
//           id: tId,
//           name: teacherName,
//           lessons: 0,
//           minutes: 0,
//           groups: new Set(),
//           students: new Set(),
//         });
//       }
//       const bucket = byTeacher.get(tId);
//       bucket.lessons += 1;
//       bucket.minutes += Number(l.duration || 0);
//       if (l.groupId) {
//         bucket.groups.add(String(l.groupId));
//         const studs = activeStudentsByGroup.get(l.groupId) || [];
//         studs.forEach((s) => bucket.students.add(String(s.id)));
//       }
//     });

//     const out = Array.from(byTeacher.values()).map((t) => {
//       const hours = t.minutes / 60;
//       const effRate = Number(teacherRates[t.id] ?? 0) || 0;
//       let amount = 0;
//       if (rateMode === "lesson") amount = t.lessons * effRate;
//       else if (rateMode === "hour") amount = hours * effRate;
//       else amount = effRate; // month — фикс за месяц
//       return {
//         id: t.id,
//         name: t.name,
//         lessons: t.lessons,
//         minutes: t.minutes,
//         hours,
//         groupsCount: t.groups.size,
//         studentsCount: t.students.size,
//         rate: effRate,
//         amount,
//       };
//     });

//     return out.sort((a, b) => b.amount - a.amount);
//   }, [lessonsInPeriod, teachers, baseStudents, teacherRates, rateMode]);

//   const payrollTotals = useMemo(() => {
//     const amount = teacherStats.reduce((acc, x) => acc + x.amount, 0);
//     const lessonsCnt = teacherStats.reduce((acc, x) => acc + x.lessons, 0);
//     const hoursCnt = teacherStats.reduce((acc, x) => acc + x.hours, 0);
//     return { amount, lessonsCnt, hoursCnt };
//   }, [teacherStats]);

//   const updateTeacherRate = (id, value) => {
//     setTeacherRates((prev) => ({ ...prev, [id]: value ? Number(value) : "" }));
//   };
//   const persistRates = () => saveRatesToLS();

//   useEffect(() => {
//     saveRatesToLS(teacherRates, rateMode);
//   }, [teacherRates, rateMode, saveRatesToLS]);

//   return (
//     <div className="school-invoices">
//       {/* Header */}
//       <div className="school-invoices__header">
//         <div>
//           <h2 className="school-invoices__title">Счета · Аналитика</h2>
//           <p className="school-invoices__subtitle">
//             Период: <b>{periodLabel}</b>
//           </p>
//         </div>

//         {/* Toolbar */}
//         <div className="school-invoices__toolbar">
//           <div className="school-invoices__filters">
//             <select
//               className="school-invoices__input"
//               value={year}
//               onChange={(e) => setYear(Number(e.target.value))}
//               title="Год"
//               aria-label="Год"
//             >
//               {YEARS.map((y) => (
//                 <option key={y} value={y}>
//                   {y}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={month}
//               onChange={(e) => setMonth(Number(e.target.value))}
//               title="Месяц"
//               aria-label="Месяц"
//             >
//               {MONTHS.map((m) => (
//                 <option key={m} value={m}>
//                   {pad2(m)}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={courseId}
//               onChange={(e) => setCourseId(e.target.value)}
//               title="Курс"
//               aria-label="Курс"
//             >
//               <option value="">Все курсы</option>
//               {courses.map((c) => (
//                 <option key={c.id} value={c.id}>
//                   {c.name}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={groupId}
//               onChange={(e) => setGroupId(e.target.value)}
//               title="Группа"
//               aria-label="Группа"
//               disabled={!courseId}
//             >
//               <option value="">Все группы</option>
//               {groups
//                 .filter((g) => String(g.courseId) === String(courseId))
//                 .map((g) => (
//                   <option key={g.id} value={g.id}>
//                     {g.name}
//                   </option>
//                 ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={teacherId}
//               onChange={(e) => setTeacherId(e.target.value)}
//               title="Преподаватель"
//               aria-label="Преподаватель"
//             >
//               <option value="">Все преподаватели</option>
//               {teachers
//                 .slice()
//                 .sort((a, b) => a.name.localeCompare(b.name, "ru"))
//                 .map((t) => (
//                   <option key={t.id} value={t.id}>
//                     {t.name}
//                   </option>
//                 ))}
//             </select>
//           </div>

//           <div className="school-invoices__right">
//             <div className="school-invoices__search">
//               <FaSearch className="school-invoices__search-icon" aria-hidden />
//               <input
//                 className="school-invoices__search-input"
//                 placeholder="Поиск: ученик / телефон / курс / группа"
//                 value={qText}
//                 onChange={(e) => setQText(e.target.value)}
//                 aria-label="Поиск"
//               />
//             </div>

//             <button
//               className="school-invoices__btn school-invoices__btn--secondary"
//               onClick={loadAll}
//               title="Обновить"
//               aria-label="Обновить"
//             >
//               <FaSync /> <span className="school-invoices__btnText">Обновить</span>
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* States */}
//       {loading && <div className="school-invoices__alert">Загрузка…</div>}
//       {!!error && !loading && (
//         <div className="school-invoices__alert">{error}</div>
//       )}

//       {/* Content */}
//       {!loading && !error && (
//         <>
//           {/* KPIs */}
//           <div className="school-invoices__kpis">
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">₮</div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Начислено за период</div>
//                 <div className="school-invoices__kpiValue">
//                   {money(totals.amount)}
//                 </div>
//               </div>
//             </div>

//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">👥</div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Активных учащихся</div>
//                 <div className="school-invoices__kpiValue">{totals.students}</div>
//               </div>
//             </div>

//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">Ø</div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Средний чек</div>
//                 <div className="school-invoices__kpiValue">{money(totals.avg)}</div>
//               </div>
//             </div>
//           </div>

//           {/* По курсам */}
//           <h3 className="school-invoices__sectionTitle">Курсы · сумма и ученики</h3>
//           <div className="school-invoices__list">
//             {byCourse.map((c, idx) => (
//               <div key={`${c.name}-${idx}`} className="school-invoices__card">
//                 <div className="school-invoices__card-left">
//                   <div className="school-invoices__avatar" aria-hidden>
//                     {(c.name || "•").charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="school-invoices__name-row">
//                       <p className="school-invoices__name">{c.name || "—"}</p>
//                       <span className="school-invoices__chip">{c.count} уч.</span>
//                     </div>
//                     <div className="school-invoices__meta">
//                       <span>
//                         Сумма: <b>{money(c.amount)}</b>
//                       </span>
//                     </div>
//                     <div className="school-invoices__bar">
//                       <div
//                         className="school-invoices__barFill"
//                         style={{ width: `${(c.amount / maxCourseAmount) * 100}%` }}
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//             {byCourse.length === 0 && (
//               <div className="school-invoices__empty">
//                 Нет данных по курсам за выбранный период.
//               </div>
//             )}
//           </div>

//           {/* По группам */}
//           <h3 className="school-invoices__sectionTitle">Группы · сумма и ученики</h3>
//           <div className="school-invoices__list">
//             {byGroup.map((g, idx) => (
//               <div key={`${g.name}-${idx}`} className="school-invoices__card">
//                 <div className="school-invoices__card-left">
//                   <div className="school-invoices__avatar" aria-hidden>
//                     {(g.name || "•").charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="school-invoices__name-row">
//                       <p className="school-invoices__name">
//                         {g.name || "—"}{" "}
//                         <span className="school-invoices__muted">
//                           · {g.courseName || "—"}
//                         </span>
//                       </p>
//                       <span className="school-invoices__chip">{g.count} уч.</span>
//                     </div>
//                     <div className="school-invoices__meta">
//                       <span>
//                         Сумма: <b>{money(g.amount)}</b>
//                       </span>
//                     </div>
//                     <div className="school-invoices__bar">
//                       <div
//                         className="school-invoices__barFill"
//                         style={{ width: `${(g.amount / maxGroupAmount) * 100}%` }}
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//             {byGroup.length === 0 && (
//               <div className="school-invoices__empty">
//                 Нет данных по группам за выбранный период.
//               </div>
//             )}
//           </div>

//           {/* ===== ЗАРПЛАТА ===== */}
//           <h3 className="school-invoices__sectionTitle">Зарплата преподавателей</h3>

//           <div className="school-invoices__filters" style={{ marginBottom: 12 }}>
//             <select
//               className="school-invoices__input"
//               value={rateMode}
//               onChange={(e) => setRateMode(e.target.value)}
//               title="Режим начисления"
//               aria-label="Режим начисления"
//             >
//               <option value="hour">По часам</option>
//               <option value="lesson">За урок</option>
//               <option value="month">Фикс за месяц</option>
//             </select>

//             <button
//               className="school-invoices__btn school-invoices__btn--secondary"
//               onClick={persistRates}
//               title="Сохранить персональные ставки"
//             >
//               <FaSave /> <span className="school-invoices__btnText">Сохранить ставки</span>
//             </button>
//           </div>

//           <div className="school-invoices__kpis" style={{ marginTop: 8 }}>
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">
//                 <FaMoneyBillWave />
//               </div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Итого фонд ЗП</div>
//                 <div className="school-invoices__kpiValue">
//                   {money(payrollTotals.amount)}
//                 </div>
//               </div>
//             </div>
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">
//                 <FaHashtag />
//               </div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Уроков за период</div>
//                 <div className="school-invoices__kpiValue">
//                   {payrollTotals.lessonsCnt}
//                 </div>
//               </div>
//             </div>
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">
//                 <FaClock />
//               </div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Часов за период</div>
//                 <div className="school-invoices__kpiValue">
//                   {payrollTotals.hoursCnt.toFixed(1)}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="school-invoices__list">
//             {teacherStats.map((t) => (
//               <div key={t.id} className="school-invoices__card">
//                 <div className="school-invoices__card-left">
//                   <div className="school-invoices__avatar" aria-hidden>
//                     {(t.name || "•").charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="school-invoices__name-row">
//                       <p className="school-invoices__name">{t.name || "—"}</p>
//                       <span className="school-invoices__chip">
//                         {rateMode === "hour"
//                           ? "часовая"
//                           : rateMode === "lesson"
//                           ? "за урок"
//                           : "фикс"}
//                         : {t.rate ? money(t.rate) : "—"}
//                       </span>
//                     </div>

//                     <div className="school-invoices__meta" style={{ gap: 12 }}>
//                       <span>
//                         Уроков: <b>{t.lessons}</b>
//                       </span>
//                       <span>
//                         Часы: <b>{t.hours.toFixed(1)}</b>
//                       </span>
//                       <span>
//                         Групп: <b>{t.groupsCount}</b>
//                       </span>
//                       <span>
//                         Ученики: <b>{t.studentsCount}</b>
//                       </span>
//                     </div>

//                     <div className="school-invoices__bar">
//                       <div
//                         className="school-invoices__barFill"
//                         style={{
//                           width: `${
//                             teacherStats[0]?.amount
//                               ? (t.amount / teacherStats[0].amount) * 100
//                               : 0
//                           }%`,
//                         }}
//                       />
//                     </div>
//                   </div>
//                 </div>

//                 <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//                   <div className="school-invoices__kpiValue" style={{ fontSize: 18 }}>
//                     {money(t.amount)}
//                   </div>
//                   <input
//                     className="school-invoices__input"
//                     type="number"
//                     min="0"
//                     step="50"
//                     value={teacherRates[t.id] ?? ""}
//                     onChange={(e) => updateTeacherRate(t.id, e.target.value)}
//                     placeholder={
//                       rateMode === "hour"
//                         ? "ставка, сом/час"
//                         : rateMode === "lesson"
//                         ? "ставка, сом/урок"
//                         : "фикс, сом/мес"
//                     }
//                     title="Персональная ставка"
//                     style={{ width: 160 }}
//                   />
//                 </div>
//               </div>
//             ))}

//             {teacherStats.length === 0 && (
//               <div className="school-invoices__empty">
//                 Нет уроков/преподавателей за выбранный месяц и фильтры.
//               </div>
//             )}
//           </div>
//         </>
//       )}
//     </div>
//   );
// };

// /* =========================================================
//    ВКЛАДКА 2: КАССА — только список и детали (без «Оплата»)
//    ========================================================= */
// const CashboxTab = () => {
//   const [view, setView] = useState("list"); // list | detail
//   const [detailId, setDetailId] = useState(null);

//   /* ---------- LIST ---------- */
//   const CashboxListInline = ({ onOpen }) => {
//     const [rows, setRows] = useState([]);
//     const [q, setQ] = useState("");
//     const [loading, setLoading] = useState(true);
//     const [err, setErr] = useState("");
//     const [createOpen, setCreateOpen] = useState(false);
//     const [name, setName] = useState("");

//     const fmtMoney = (v) =>
//       (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
//       " c";

//     const load = async () => {
//       try {
//         setErr("");
//         setLoading(true);
//         const { data } = await api.get("/construction/cashboxes/");
//         setRows(asArray(data));
//       } catch {
//         setErr("Не удалось загрузить кассы");
//       } finally {
//         setLoading(false);
//       }
//     };

//     useEffect(() => {
//       load();
//     }, []);

//     const filtered = useMemo(() => {
//       const t = q.trim().toLowerCase();
//       if (!t) return rows;
//       return rows.filter((r) =>
//         [r.department_name, r.name]
//           .filter(Boolean)
//           .some((x) => String(x || "").toLowerCase().includes(t))
//       );
//     }, [rows, q]);

//     const onCreate = async () => {
//       const title = (name || "").trim();
//       if (!title) return alert("Введите название кассы");
//       try {
//         await api.post("/construction/cashboxes/", { name: title });
//         setCreateOpen(false);
//         setName("");
//         load();
//       } catch {
//         alert("Не удалось создать кассу");
//       }
//     };

//     return (
//       <div className="school-cbox">
//         <div className="school-cbox__toolbar">
//           <div className="school-cbox__toolbar-side">
//             <span className="school-cbox__total">Всего: {filtered.length}</span>
//           </div>
//           <div className="school-cbox__controls">
//             <input
//               className="school-cbox__search"
//               type="text"
//               placeholder="Поиск…"
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//             />
//             <button className="school-cbox__btn" onClick={() => setCreateOpen(true)}>
//               Создать кассу
//             </button>
//           </div>
//         </div>

//         {err && <div className="school-cbox__error">{err}</div>}

//         <div className="school-cbox__table-wrap">
//           <table className="school-cbox__table">
//             <thead>
//               <tr>
//                 <th>#</th>
//                 <th>Название</th>
//                 <th>Приход</th>
//                 <th>Расход</th>
//                 <th>Действия</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 <tr>
//                   <td colSpan={5}>Загрузка…</td>
//                 </tr>
//               ) : filtered.length ? (
//                 filtered.map((r, i) => (
//                   <tr
//                     key={r.id}
//                     className="school-cbox__row"
//                     onClick={() => onOpen(r.id)}
//                   >
//                     <td>{i + 1}</td>
//                     <td>
//                       <b>{r.department_name || r.name || "—"}</b>
//                     </td>
//                     <td>{fmtMoney(r.analytics?.income?.total || 0)}</td>
//                     <td>{fmtMoney(r.analytics?.expense?.total || 0)}</td>
//                     <td>
//                       <button
//                         className="school-cbox__btn"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           onOpen(r.id);
//                         }}
//                       >
//                         Открыть
//                       </button>
//                     </td>
//                   </tr>
//                 ))
//               ) : (
//                 <tr>
//                   <td colSpan={5} className="school-cbox__muted">
//                     Нет данных
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>

//         {createOpen && (
//           <div className="school-cbox-modal">
//             <div
//               className="school-cbox-modal__overlay"
//               onClick={() => setCreateOpen(false)}
//             />
//             <div
//               className="school-cbox-modal__content"
//               onClick={(e) => e.stopPropagation()}
//             >
//               <div className="school-cbox-modal__header">
//                 <h3 className="school-cbox-modal__title">Создать кассу</h3>
//                 <button
//                   className="school-cbox-modal__close"
//                   onClick={() => setCreateOpen(false)}
//                 >
//                   ×
//                 </button>
//               </div>
//               <div className="school-cbox-modal__section">
//                 <label className="school-cbox-modal__label">Название кассы *</label>
//                 <input
//                   className="school-cbox-modal__input"
//                   type="text"
//                   placeholder="Например: касса №1"
//                   value={name}
//                   onChange={(e) => setName(e.target.value)}
//                   required
//                 />
//               </div>
//               <div className="school-cbox-modal__footer">
//                 <button className="school-cbox__btn" onClick={onCreate}>
//                   Сохранить
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     );
//   };

//   /* ---------- DETAIL ---------- */
//   const CashboxDetailInline = ({ id, onBack }) => {
//     const [box, setBox] = useState(null);
//     const [ops, setOps] = useState([]);
//     const [tab, setTab] = useState("all");
//     const [loading, setLoading] = useState(true);
//     const [err, setErr] = useState("");

//     const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
//     const fmtMoney = (v) =>
//       (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
//       " c";

//     const arrFromAny = (res) => {
//       const d = res?.data ?? res ?? [];
//       if (Array.isArray(d?.results)) return d.results;
//       if (Array.isArray(d)) return d;
//       return [];
//     };

//     const load = async () => {
//       setErr("");
//       setLoading(true);
//       try {
//         let detail = null;
//         try {
//           detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`))
//             .data;
//         } catch {}
//         if (!detail) {
//           try {
//             detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
//               .data;
//           } catch {}
//         }
//         if (!detail) {
//           detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
//         }
//         setBox(detail);

//         let flows =
//           arrFromAny({ data: detail?.operations }) ||
//           arrFromAny({ data: detail?.flows }) ||
//           arrFromAny({ data: detail?.transactions });

//         if (!flows.length) {
//           try {
//             const r1 = await api.get(`/construction/cashflows/`, {
//               params: { cashbox: id },
//             });
//             flows = arrFromAny(r1);
//           } catch {}
//         }
//         if (!flows.length && detail?.uuid) {
//           try {
//             const r2 = await api.get(`/construction/cashflows/`, {
//               params: { cashbox: detail.uuid },
//             });
//             flows = arrFromAny(r2);
//           } catch {}
//         }

//         const mapped = (flows || []).map((x, i) => {
//           const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
//           let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
//           if (type !== "income" && type !== "expense")
//             type = amt >= 0 ? "income" : "expense";
//           return {
//             id: x.id || x.uuid || `${i}`,
//             type,
//             title:
//               x.title ||
//               x.name ||
//               x.description ||
//               x.note ||
//               (type === "income" ? "Приход" : "Расход"),
//             amount: Math.abs(amt),
//             created_at:
//               x.created_at ||
//               x.created ||
//               x.date ||
//               x.timestamp ||
//               x.createdAt ||
//               null,
//           };
//         });

//         setOps(mapped);
//       } catch {
//         setErr("Не удалось загрузить детали кассы");
//       } finally {
//         setLoading(false);
//       }
//     };

//     useEffect(() => {
//       if (id) load();
//     }, [id]);

//     const shown = useMemo(() => {
//       if (tab === "income") return ops.filter((o) => o.type === "income");
//       if (tab === "expense") return ops.filter((o) => o.type === "expense");
//       return ops;
//     }, [ops, tab]);

//     return (
//       <div className="school-cbox">
//         <div className="school-cbox__header">
//           <div className="school-cbox__tabs">
//             <button className="school-cbox__tab" onClick={onBack}>
//               ← Назад
//             </button>
//             <span className="school-cbox__tab is-active">
//               {box?.department_name || box?.name || "Касса"}
//             </span>
//           </div>
//         </div>

//         <div className="school-cbox__seg">
//           <button
//             className={`school-cbox__seg-btn ${
//               tab === "expense" ? "is-active" : ""
//             }`}
//             onClick={() => setTab("expense")}
//           >
//             Расход
//           </button>
//           <button
//             className={`school-cbox__seg-btn ${
//               tab === "income" ? "is-active" : ""
//             }`}
//             onClick={() => setTab("income")}
//           >
//             Приход
//           </button>
//           <button
//             className={`school-cbox__seg-btn ${
//               tab === "all" ? "is-active" : ""
//             }`}
//             onClick={() => setTab("all")}
//           >
//             Все
//           </button>
//           <div className="school-cbox__seg-grow" />
//         </div>

//         <div className="school-cbox__table-wrap">
//           <table className="school-cbox__table">
//             <thead>
//               <tr>
//                 <th>Тип</th>
//                 <th>Наименование</th>
//                 <th>Сумма</th>
//                 <th>Дата</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 <tr>
//                   <td colSpan={4}>Загрузка…</td>
//                 </tr>
//               ) : err ? (
//                 <tr>
//                   <td colSpan={4} className="school-cbox__error">
//                     {err}
//                   </td>
//                 </tr>
//               ) : shown.length ? (
//                 shown.map((o) => (
//                   <tr key={o.id}>
//                     <td>{o.type === "income" ? "Приход" : "Расход"}</td>
//                     <td>{o.title}</td>
//                     <td>{fmtMoney(o.amount)}</td>
//                     <td>{when(o.created_at)}</td>
//                   </tr>
//                 ))
//               ) : (
//                 <tr>
//                   <td colSpan={4} className="school-cbox__muted">
//                     Нет операций
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="school-cbox">
//       {view === "list" && (
//         <CashboxListInline
//           onOpen={(id) => {
//             setDetailId(id);
//             setView("detail");
//           }}
//         />
//       )}
//       {view === "detail" && (
//         <CashboxDetailInline id={detailId} onBack={() => setView("list")} />
//       )}
//     </div>
//   );
// };

// /* =========================================================
//    ВКЛАДКА 3: АНАЛИТИКА (продажи/склад/бренды/категории/касса)
//    ========================================================= */
// const AnalyticsTab = () => {
//   const dispatch = useDispatch();

//   const { history = [], loading: salesLoading, error: salesError } = useSale();
//   const {
//     list: products = [],
//     brands = [],
//     categories = [],
//     loading: productsLoading,
//   } = useSelector((s) => s.product || {});

//   const [activeTab, setActiveTab] = useState("sales"); // sales | inventory | taxonomy | cashbox
//   const [startDate, setStartDate] = useState(() => {
//     const n = new Date();
//     return `${n.getFullYear()}-01-01`;
//   });
//   const [endDate, setEndDate] = useState(() =>
//     new Date().toISOString().slice(0, 10)
//   );
//   const [granularity, setGranularity] = useState("month"); // day | month | year

//   const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
//   const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
//   const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

//   const lan =
//     (typeof localStorage !== "undefined" && localStorage.getItem("i18nextLng")) ||
//     "ru";
//   const nfMoney = useMemo(() => {
//     try {
//       return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
//         style: "currency",
//         currency: "KGS",
//         maximumFractionDigits: 0,
//       });
//     } catch {
//       return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
//     }
//   }, [lan]);
//   const nfInt = useMemo(
//     () => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"),
//     [lan]
//   );

//   const parseISO = (s) => {
//     const d = new Date(s);
//     return isNaN(d.getTime()) ? null : d;
//   };
//   const keyByGranularity = (date, g) => {
//     const y = date.getFullYear();
//     const m = String(date.getMonth() + 1).padStart(2, "0");
//     const d = String(date.getDate()).padStart(2, "0");
//     if (g === "day") return `${y}-${m}-${d}`;
//     if (g === "year") return `${y}`;
//     return `${y}-${m}`;
//   };
//   const inRange = (d) => {
//     const sd = parseISO(startDate);
//     const ed = parseISO(endDate);
//     if (!d || !sd || !ed) return false;
//     const from = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, 0, 0);
//     const to = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59);
//     return d >= from && d <= to;
//   };
//   const quickPreset = (preset) => {
//     const now = new Date();
//     if (preset === "thisMonth") {
//       const sd = new Date(now.getFullYear(), now.getMonth(), 1);
//       const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("day");
//     }
//     if (preset === "lastMonth") {
//       const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//       const ed = new Date(now.getFullYear(), now.getMonth(), 0);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("day");
//     }
//     if (preset === "ytd") {
//       const sd = new Date(now.getFullYear(), 0, 1);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(now.toISOString().slice(0, 10));
//       setGranularity("month");
//     }
//     if (preset === "thisYear") {
//       const sd = new Date(now.getFullYear(), 0, 1);
//       const ed = new Date(now.getFullYear(), 11, 31);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("month");
//     }
//   };

//   useEffect(() => {
//     dispatch(historySellProduct({ search: "" }));
//     dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
//     dispatch(fetchBrandsAsync());
//     dispatch(fetchCategoriesAsync());
//   }, [dispatch]);

//   /* SALES */
//   const salesFiltered = useMemo(
//     () => (history || []).filter((r) => inRange(parseISO(r?.created_at))),
//     [history, startDate, endDate]
//   );

//   const salesTotals = useMemo(() => {
//     const count = salesFiltered.length;
//     const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
//     return { count, revenue, avg: count ? revenue / count : 0 };
//   }, [salesFiltered]);

//   const salesSeries = useMemo(() => {
//     const bucket = new Map();
//     for (const r of salesFiltered) {
//       const d = parseISO(r?.created_at);
//       if (!d) continue;
//       const key = keyByGranularity(d, granularity);
//       bucket.set(key, num(bucket.get(key)) + num(r?.total));
//     }
//     const keys = sortKeysAsc(Array.from(bucket.keys()));
//     return { labels: keys, values: keys.map((k) => Math.round(num(bucket.get(k)))) };
//   }, [salesFiltered, granularity]);

//   /* INVENTORY */
//   const LOW_STOCK_THRESHOLD = 5;

//   const inventoryKPIs = useMemo(() => {
//     const totalSkus = products.length;
//     const lowStock = products.filter((p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD).length;

//     const stockValueByPrice = products.reduce(
//       (acc, p) => acc + num(p?.price) * num(p?.quantity),
//       0
//     );

//     const stockValueByCost =
//       products.some((p) => "cost_price" in p)
//         ? products.reduce((acc, p) => acc + num(p?.cost_price) * num(p?.quantity), 0)
//         : null;

//     return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
//   }, [products]);

//   const topCategories = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.category || p?.category_name || "Без категории";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
//   }, [products]);

//   const lowStockList = useMemo(
//     () => [...products].sort((a, b) => num(a?.quantity) - num(b?.quantity)).slice(0, 10),
//     [products]
//   );

//   const abcStats = useMemo(() => {
//     if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
//     const items = products.map((p) => {
//       const value =
//         "cost_price" in p ? num(p.cost_price) * num(p.quantity) : num(p.price) * num(p.quantity);
//       return { id: p.id, name: p.name, value };
//     });
//     items.sort((a, b) => b.value - a.value);
//     const total = items.reduce((s, x) => s + x.value, 0) || 1;
//     let acc = 0;
//     let A = 0,
//       B = 0,
//       C = 0;
//     const tagged = items.map((it) => {
//       acc += it.value;
//       const share = acc / total;
//       let tag = "C";
//       if (share <= 0.8) tag = "A";
//       else if (share <= 0.95) tag = "B";
//       if (tag === "A") A += 1;
//       else if (tag === "B") B += 1;
//       else C += 1;
//       return { ...it, tag };
//     });
//     return { A, B, C, list: tagged.slice(0, 10) };
//   }, [products]);

//   /* TAXONOMY */
//   const brandStats = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.brand || p?.brand_name || "Без бренда";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
//     return { total: brands.length || pairs.length, top: pairs.slice(0, 10) };
//   }, [products, brands]);

//   const categoryStats = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.category || p?.category_name || "Без категории";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
//     return { total: categories.length || pairs.length, top: pairs.slice(0, 10) };
//   }, [products, categories]);

//   /* CASHBOX analytics */
//   const [boxes, setBoxes] = useState([]);
//   const [flows, setFlows] = useState([]);
//   const [boxId, setBoxId] = useState("all");
//   const [cashLoading, setCashLoading] = useState(false);
//   const [cashError, setCashError] = useState("");

//   useEffect(() => {
//     if (activeTab !== "cashbox" || boxes.length) return;
//     (async () => {
//       try {
//         const res = await api.get("/construction/cashboxes/", {
//           params: { page_size: 1000 },
//         });
//         setBoxes(listFrom(res));
//       } catch {
//         setBoxes([]);
//       }
//     })();
//   }, [activeTab, boxes.length]);

//   const loadFlows = async () => {
//     setCashError("");
//     setCashLoading(true);
//     try {
//       const params = { page_size: 1000 };
//       if (boxId !== "all") params.cashbox = boxId;
//       const r = await api.get("/construction/cashflows/", { params });
//       const raw = listFrom(r) || [];
//       const normalized = raw.map((x, i) => {
//         const amt = num(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
//         let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
//         if (type !== "income" && type !== "expense")
//           type = amt >= 0 ? "income" : "expense";
//         const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
//         const cashboxName =
//           x.cashbox?.department_name || x.cashbox?.name || x.cashbox_name || null;
//         return {
//           id: x.id || x.uuid || `${i}`,
//           type,
//           amount: Math.abs(amt),
//           title:
//             x.title ||
//             x.name ||
//             x.description ||
//             x.note ||
//             (type === "income" ? "Приход" : "Расход"),
//           created_at:
//             x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
//           cashboxId,
//           cashboxName,
//         };
//       });
//       setFlows(normalized);
//     } catch {
//       setCashError("Не удалось загрузить операции кассы");
//       setFlows([]);
//     } finally {
//       setCashLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (activeTab === "cashbox") loadFlows();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [activeTab, boxId, startDate, endDate, granularity]);

//   const flowsFiltered = useMemo(
//     () => flows.filter((f) => inRange(parseISO(f.created_at))),
//     [flows, startDate, endDate]
//   );

//   const cashTotals = useMemo(() => {
//     let income = 0,
//       expense = 0;
//     for (const f of flowsFiltered) {
//       if (f.type === "income") income += f.amount;
//       else expense += f.amount;
//     }
//     return { income, expense, net: income - expense };
//   }, [flowsFiltered]);

//   const cashSeries = useMemo(() => {
//     const inc = new Map();
//     const exp = new Map();
//     for (const f of flowsFiltered) {
//       const d = parseISO(f.created_at);
//       if (!d) continue;
//       const k = keyByGranularity(d, granularity);
//       if (f.type === "income") inc.set(k, num(inc.get(k)) + f.amount);
//       else exp.set(k, num(exp.get(k)) + f.amount);
//     }
//     const keys = sortKeysAsc(Array.from(new Set([...inc.keys(), ...exp.keys()])));
//     const incomeVals = keys.map((k) => Math.round(num(inc.get(k))));
//     const expenseVals = keys.map((k) => Math.round(num(exp.get(k))));
//     const netVals = keys.map((_, i) =>
//       Math.round(num(incomeVals[i]) - num(expenseVals[i]))
//     );
//     return { labels: keys, incomeVals, expenseVals, netVals };
//   }, [flowsFiltered, granularity]);

//   const perBox = useMemo(() => {
//     const map = new Map();
//     for (const f of flowsFiltered) {
//       const id = f.cashboxId || "—";
//       const name =
//         f.cashboxName ||
//         boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
//         boxes.find((b) => (b.id || b.uuid) === id)?.name ||
//         "—";
//       const cur = map.get(id) || { name, income: 0, expense: 0 };
//       if (f.type === "income") cur.income += f.amount;
//       else cur.expense += f.amount;
//       map.set(id, cur);
//     }
//     const rows = Array.from(map.entries()).map(([id, v]) => ({
//       id,
//       name: v.name,
//       income: v.income,
//       expense: v.expense,
//       net: v.income - v.expense,
//     }));
//     rows.sort((a, b) => b.net - a.net);
//     return rows;
//   }, [flowsFiltered, boxes]);

//   const topExpenseByTitle = useMemo(() => {
//     const m = new Map();
//     for (const f of flowsFiltered) {
//       if (f.type !== "expense") continue;
//       const key = (f.title || "Расход").toString();
//       m.set(key, num(m.get(key)) + f.amount);
//     }
//     return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
//   }, [flowsFiltered]);

//   return (
//     <div className="school-anal">
//       {/* саб-вкладки */}
//       <div className="school-anal__tabs">
//         <button
//           className={`school-anal__tab ${activeTab === "sales" ? "is-active" : ""}`}
//           onClick={() => setActiveTab("sales")}
//         >
//           Продажи
//         </button>
//         <button
//           className={`school-anal__tab ${activeTab === "inventory" ? "is-active" : ""}`}
//           onClick={() => setActiveTab("inventory")}
//         >
//           Склад
//         </button>
//         <button
//           className={`school-anal__tab ${activeTab === "taxonomy" ? "is-active" : ""}`}
//           onClick={() => setActiveTab("taxonomy")}
//         >
//           Бренды/Категории
//         </button>
//         <button
//           className={`school-anal__tab ${activeTab === "cashbox" ? "is-active" : ""}`}
//           onClick={() => setActiveTab("cashbox")}
//         >
//           Касса
//         </button>
//       </div>

//       {(activeTab === "sales" || activeTab === "cashbox") && (
//         <div className="school-anal__controls">
//           <div className="school-anal__presets">
//             <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
//             <button onClick={() => quickPreset("lastMonth")}>Прошлый месяц</button>
//             <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
//             <button onClick={() => quickPreset("thisYear")}>Весь год</button>
//           </div>
//           <div className="school-anal__range">
//             <label className="school-anal__label">
//               С
//               <input
//                 type="date"
//                 className="school-anal__input"
//                 value={startDate}
//                 onChange={(e) => setStartDate(e.target.value)}
//               />
//             </label>
//             <label className="school-anal__label">
//               До
//               <input
//                 type="date"
//                 className="school-anal__input"
//                 value={endDate}
//                 onChange={(e) => setEndDate(e.target.value)}
//               />
//             </label>

//             <div className="school-anal__seg">
//               <button
//                 className={granularity === "day" ? "is-active" : ""}
//                 onClick={() => setGranularity("day")}
//               >
//                 Дни
//               </button>
//               <button
//                 className={granularity === "month" ? "is-active" : ""}
//                 onClick={() => setGranularity("month")}
//               >
//                 Месяцы
//               </button>
//               <button
//                 className={granularity === "year" ? "is-active" : ""}
//                 onClick={() => setGranularity("year")}
//               >
//                 Годы
//               </button>
//             </div>

//             {activeTab === "cashbox" && (
//               <label className="school-anal__label">
//                 Касса
//                 <select
//                   className="school-anal__input"
//                   value={boxId}
//                   onChange={(e) => setBoxId(e.target.value)}
//                 >
//                   <option value="all">Все кассы</option>
//                   {boxes.map((b) => (
//                     <option key={b.id || b.uuid} value={b.id || b.uuid}>
//                       {b.department_name || b.name || (b.id || b.uuid)}
//                     </option>
//                   ))}
//                 </select>
//               </label>
//             )}
//           </div>
//         </div>
//       )}

//       {/* SALES */}
//       {activeTab === "sales" && (
//         <>
//           <div className="school-anal__kpis">
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Число продаж</div>
//               <div className="school-anal__kpi-value">
//                 {nfInt.format(salesTotals.count)}
//               </div>
//             </div>
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Выручка</div>
//               <div className="school-anal__kpi-value">
//                 {nfMoney.format(num(salesTotals.revenue))}
//               </div>
//             </div>
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Средний чек</div>
//               <div className="school-anal__kpi-value">
//                 {nfMoney.format(num(salesTotals.avg))}
//               </div>
//             </div>
//           </div>

//           <div className="school-anal__card">
//             {salesLoading ? (
//               <div className="school-anal__note">Загрузка истории продаж…</div>
//             ) : salesError ? (
//               <div className="school-anal__error">Ошибка: {String(salesError)}</div>
//             ) : (
//               <>
//                 <div className="school-anal__card-title">
//                   Динамика выручки (
//                   {granularity === "day"
//                     ? "дни"
//                     : granularity === "month"
//                     ? "месяцы"
//                     : "годы"}
//                   )
//                 </div>
//                 <Sparkline values={salesSeries.values} />
//                 <div className="school-anal__legend">
//                   {salesSeries.labels.map((l, i) => (
//                     <span className="school-anal__legend-item" key={i}>
//                       {l}
//                     </span>
//                   ))}
//                 </div>
//               </>
//             )}
//           </div>

//           <div className="school-anal__card">
//             <div className="school-anal__card-title">Последние продажи</div>
//             {salesFiltered.length ? (
//               <div className="school-anal__table-wrap">
//                 <table className="school-anal__table">
//                   <thead>
//                     <tr>
//                       <th>#</th>
//                       <th>Пользователь</th>
//                       <th>Сумма</th>
//                       <th>Статус</th>
//                       <th>Дата</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {salesFiltered.slice(0, 10).map((r, i) => (
//                       <tr key={r?.id ?? i}>
//                         <td>{i + 1}</td>
//                         <td>{r?.user_display || "—"}</td>
//                         <td>{nfMoney.format(num(r?.total))}</td>
//                         <td>{r?.status || "—"}</td>
//                         <td>
//                           {r?.created_at
//                             ? new Date(r.created_at).toLocaleString()
//                             : "—"}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             ) : (
//               <div className="school-anal__note">Нет продаж в выбранном периоде.</div>
//             )}
//           </div>
//         </>
//       )}

//       {/* INVENTORY */}
//       {activeTab === "inventory" && (
//         <>
//           <div className="school-anal__kpis">
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Всего SKU</div>
//               <div className="school-anal__kpi-value">
//                 {nfInt.format(products.length)}
//               </div>
//             </div>
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Стоимость склада</div>
//               <div className="school-anal__kpi-value">
//                 {inventoryKPIs.stockValueByCost != null
//                   ? nfMoney.format(inventoryKPIs.stockValueByCost)
//                   : nfMoney.format(inventoryKPIs.stockValueByPrice)}
//               </div>
//             </div>
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Низкие остатки (≤5)</div>
//               <div className="school-anal__kpi-value">
//                 {nfInt.format(inventoryKPIs.lowStock)}
//               </div>
//             </div>
//           </div>

//           <div className="school-anal__grid">
//             <div className="school-anal__card">
//               <div className="school-anal__card-title">
//                 Топ-10 категорий по кол-ву SKU
//               </div>
//               <ul className="school-anal__bars">
//                 {topCategories.length ? (
//                   topCategories.map(([name, count], i) => {
//                     const max = topCategories[0][1] || 1;
//                     const width = clamp(Math.round((count / max) * 100), 5, 100);
//                     return (
//                       <li className="school-anal__bar" key={i}>
//                         <span className="school-anal__bar-name" title={name}>
//                           {name}
//                         </span>
//                         <span className="school-anal__bar-track">
//                           <span
//                             className="school-anal__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="school-anal__bar-value">
//                           {nfInt.format(count)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="school-anal__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>

//             <div className="school-anal__card">
//               <div className="school-anal__card-title">
//                 Топ-10 с минимальными остатками
//               </div>
//               <ul className="school-anal__list">
//                 {lowStockList.length ? (
//                   lowStockList.map((p, i) => (
//                     <li className="school-anal__row" key={p?.id ?? i}>
//                       <span
//                         className="school-anal__row-name"
//                         title={p?.name || "—"}
//                       >
//                         {p?.name || "—"}
//                       </span>
//                       <span className="school-anal__row-qty">
//                         Остаток: {nfInt.format(num(p?.quantity))}
//                       </span>
//                     </li>
//                   ))
//                 ) : (
//                   <li className="school-anal__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>
//           </div>

//           <div className="school-anal__card">
//             <div className="school-anal__card-title">ABC по стоимости запаса</div>
//             <div className="school-anal__abc">
//               <div className="school-anal__abc-badge school-anal__abc-badge--a">
//                 A: {nfInt.format(abcStats.A)}
//               </div>
//               <div className="school-anal__abc-badge school-anal__abc-badge--b">
//                 B: {nfInt.format(abcStats.B)}
//               </div>
//               <div className="school-anal__abc-badge school-anal__abc-badge--c">
//                 C: {nfInt.format(abcStats.C)}
//               </div>
//             </div>
//             <ul className="school-anal__list">
//               {abcStats.list.length ? (
//                 abcStats.list.map((it, i) => (
//                   <li className="school-anal__row" key={it.id ?? i}>
//                     <span className="school-anal__row-name" title={it.name}>
//                       {it.name}
//                     </span>
//                     <span className="school-anal__row-qty">
//                       {it.tag} · {nfMoney.format(it.value)}
//                     </span>
//                   </li>
//                 ))
//               ) : (
//                 <li className="school-anal__empty">Нет данных</li>
//               )}
//             </ul>
//             <p className="school-anal__note">
//               * Если есть <code>cost_price</code>, используем его. Иначе считаем по{" "}
//               <code>price</code>.
//             </p>
//           </div>
//         </>
//       )}

//       {/* TAXONOMY */}
//       {activeTab === "taxonomy" && (
//         <div className="school-anal__grid">
//           <div className="school-anal__card">
//             <div className="school-anal__card-title">
//               Бренды{" "}
//               <span className="school-anal__muted">
//                 (всего: {nfInt.format(brandStats.total)})
//               </span>
//             </div>
//             <ul className="school-anal__bars">
//               {brandStats.top.length ? (
//                 brandStats.top.map(([name, count], i) => {
//                   const max = brandStats.top[0][1] || 1;
//                   const width = clamp(Math.round((count / max) * 100), 5, 100);
//                   return (
//                     <li className="school-anal__bar" key={i}>
//                       <span className="school-anal__bar-name" title={name}>
//                         {name}
//                       </span>
//                       <span className="school-anal__bar-track">
//                         <span
//                           className="school-anal__bar-fill"
//                           style={{ width: `${width}%` }}
//                         />
//                       </span>
//                       <span className="school-anal__bar-value">
//                         {nfInt.format(count)}
//                       </span>
//                     </li>
//                   );
//                 })
//               ) : (
//                 <li className="school-anal__empty">Нет данных</li>
//               )}
//             </ul>
//           </div>

//           <div className="school-anal__card">
//             <div className="school-anal__card-title">
//               Категории{" "}
//               <span className="school-anal__muted">
//                 (всего: {nfInt.format(categoryStats.total)})
//               </span>
//             </div>
//             <ul className="school-anal__bars">
//               {categoryStats.top.length ? (
//                 categoryStats.top.map(([name, count], i) => {
//                   const max = categoryStats.top[0][1] || 1;
//                   const width = clamp(Math.round((count / max) * 100), 5, 100);
//                   return (
//                     <li className="school-anal__bar" key={i}>
//                       <span className="school-anal__bar-name" title={name}>
//                         {name}
//                       </span>
//                       <span className="school-anal__bar-track">
//                         <span
//                           className="school-anal__bar-fill"
//                           style={{ width: `${width}%` }}
//                         />
//                       </span>
//                       <span className="school-anal__bar-value">
//                         {nfInt.format(count)}
//                       </span>
//                     </li>
//                   );
//                 })
//               ) : (
//                 <li className="school-anal__empty">Нет данных</li>
//               )}
//             </ul>
//           </div>
//         </div>
//       )}

//       {/* CASHBOX */}
//       {activeTab === "cashbox" && (
//         <>
//           <div className="school-anal__kpis">
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Приход</div>
//               <div className="school-anal__kpi-value">
//                 {nfMoney.format(cashTotals.income)}
//               </div>
//             </div>
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Расход</div>
//               <div className="school-anal__kpi-value">
//                 {nfMoney.format(cashTotals.expense)}
//               </div>
//             </div>
//             <div className="school-anal__kpi">
//               <div className="school-anal__kpi-label">Сальдо</div>
//               <div className="school-anal__kpi-value">
//                 {nfMoney.format(cashTotals.net)}
//               </div>
//             </div>
//           </div>

//           <div className="school-anal__grid">
//             <div className="school-anal__card">
//               <div className="school-anal__card-title">
//                 Динамика чистого потока (
//                 {granularity === "day"
//                   ? "дни"
//                   : granularity === "month"
//                   ? "месяцы"
//                   : "годы"}
//                 )
//               </div>
//               {cashLoading ? (
//                 <div className="school-anal__note">Загрузка операций…</div>
//               ) : cashError ? (
//                 <div className="school-anal__error">{cashError}</div>
//               ) : (
//                 <>
//                   <Sparkline values={cashSeries.netVals} />
//                   <div className="school-anal__legend">
//                     {cashSeries.labels.map((l, i) => (
//                       <span className="school-anal__legend-item" key={i}>
//                         {l}
//                       </span>
//                     ))}
//                   </div>
//                 </>
//               )}
//             </div>

//             <div className="school-anal__card">
//               <div className="school-anal__card-title">Срез по кассам</div>
//               <div className="school-anal__table-wrap">
//                 <table className="school-anal__table">
//                   <thead>
//                     <tr>
//                       <th>Касса</th>
//                       <th>Приход</th>
//                       <th>Расход</th>
//                       <th>Сальдо</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {perBox.length ? (
//                       perBox.map((r) => (
//                         <tr key={r.id}>
//                           <td>{r.name}</td>
//                           <td>{nfMoney.format(r.income)}</td>
//                           <td>{nfMoney.format(r.expense)}</td>
//                           <td>{nfMoney.format(r.net)}</td>
//                         </tr>
//                       ))
//                     ) : (
//                       <tr>
//                         <td colSpan={4} className="school-anal__empty">
//                           Нет данных
//                         </td>
//                       </tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>

//             <div className="school-anal__card">
//               <div className="school-anal__card-title">Топ-10 статей расхода</div>
//               <ul className="school-anal__bars">
//                 {topExpenseByTitle.length ? (
//                   topExpenseByTitle.map(([title, sum], i) => {
//                     const max = topExpenseByTitle[0][1] || 1;
//                     const width = clamp(Math.round((sum / max) * 100), 5, 100);
//                     return (
//                       <li className="school-anal__bar" key={i}>
//                         <span className="school-anal__bar-name" title={title}>
//                           {title}
//                         </span>
//                         <span className="school-anal__bar-track">
//                           <span
//                             className="school-anal__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="school-anal__bar-value">
//                           {nfMoney.format(sum)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="school-anal__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>
//           </div>

//           <div className="school-anal__card school-anal__card--scroll">
//             <div className="school-anal__card-title">Последние операции</div>
//             <div className="school-anal__table-wrap">
//               <table className="school-anal__table">
//                 <thead>
//                   <tr>
//                     <th>Тип</th>
//                     <th>Статья</th>
//                     <th>Сумма</th>
//                     <th>Касса</th>
//                     <th>Дата</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {cashLoading ? (
//                     <tr>
//                       <td colSpan={5}>Загрузка…</td>
//                     </tr>
//                   ) : flowsFiltered.length ? (
//                     flowsFiltered
//                       .slice()
//                       .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
//                       .slice(0, 50)
//                       .map((f, i) => (
//                         <tr key={f.id ?? i}>
//                           <td>{f.type === "income" ? "Приход" : "Расход"}</td>
//                           <td>{f.title}</td>
//                           <td>{nfMoney.format(f.amount)}</td>
//                           <td>{f.cashboxName || "—"}</td>
//                           <td>
//                             {f.created_at
//                               ? new Date(f.created_at).toLocaleString()
//                               : "—"}
//                           </td>
//                         </tr>
//                       ))
//                   ) : (
//                     <tr>
//                       <td colSpan={5} className="school-anal__empty">
//                         Нет операций
//                       </td>
//                     </tr>
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           {cashLoading && (
//             <div className="school-anal__loading">Обновляем операции…</div>
//           )}
//         </>
//       )}

//       {(productsLoading || salesLoading) && activeTab !== "cashbox" && (
//         <div className="school-anal__loading">Обновляем данные…</div>
//       )}
//     </div>
//   );
// };

// /* =========================================================
//    HOST
//    ========================================================= */
// const SchoolInvoices = () => {
//   const [tab, setTab] = useState("invoices"); // invoices | cashbox | analytics
//   return (
//     <div className="school-tabs">
//       <div className="school-tabs__bar">
//         <button
//           className={`school-tabs__btn ${tab === "invoices" ? "is-active" : ""}`}
//           onClick={() => setTab("invoices")}
//         >
//           Отчёты (Курсы)
//         </button>
//         <button
//           className={`school-tabs__btn ${tab === "cashbox" ? "is-active" : ""}`}
//           onClick={() => setTab("cashbox")}
//         >
//           Касса
//         </button>
//         <button
//           className={`school-tabs__btn ${tab === "analytics" ? "is-active" : ""}`}
//           onClick={() => setTab("analytics")}
//         >
//           Продажа-склад
//         </button>
//       </div>

//       <div className="school-tabs__panel">
//         {tab === "invoices" && <InvoicesTab />}
//         {tab === "cashbox" && <CashboxTab />}
//         {tab === "analytics" && <AnalyticsTab />}
//       </div>
//     </div>
//   );
// };

// export default SchoolInvoices;


// // src/components/Education/Invoices.jsx
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FaSearch,
//   FaSync,
//   FaMoneyBillWave,
//   FaClock,
//   FaHashtag,
//   FaSave,
// } from "react-icons/fa";
// import "./Invoices.scss";
// import api from "../../../../api";

// /* ====== Redux (Аналитика продаж/склада) ====== */
// import { useDispatch, useSelector } from "react-redux";
// import { historySellProduct } from "../../../../store/creators/saleThunk";
// import {
//   fetchProductsAsync,
//   fetchBrandsAsync,
//   fetchCategoriesAsync,
// } from "../../../../store/creators/productCreators";
// import { useSale } from "../../../../store/slices/saleSlice";

// /* ===== endpoints ===== */
// const EP_STUDENTS = "/education/students/";
// const EP_COURSES = "/education/courses/";
// const EP_GROUPS = "/education/groups/";
// const EP_LESSONS = "/education/lessons/";
// const EP_EMPLOYEES = "/users/employees/";
// const EP_TEACHER_RATES = "/education/teacher-rates/";

// /* ===== helpers (общие) ===== */
// const asArray = (data) =>
//   Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

// const listFrom = (r) => r?.data?.results || r?.data || [];
// const dec = (v) => Number(String(v ?? "0").replace(",", "."));
// const money = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;
// const pad2 = (n) => String(n).padStart(2, "0");
// const endOfMonthISO = (year, month) =>
//   new Date(year, month, 0).toISOString().slice(0, 10);
// const sameMonth = (iso, year, month) => {
//   if (!iso) return false;
//   const d = new Date(iso);
//   return d.getFullYear() === year && d.getMonth() + 1 === month;
// };

// /* ===== tiny sparkline ===== */
// const Sparkline = ({ values = [], width = 520, height = 140 }) => {
//   if (!values.length) {
//     return <div className="school-anal__sparkline-empty">Нет данных</div>;
//   }
//   const pad = 8;
//   const W = width - pad * 2;
//   const H = height - pad * 2;

//   const min = Math.min(...values);
//   const max = Math.max(...values);
//   const pts = values.map((v, i) => {
//     const x = pad + (i * W) / Math.max(1, values.length - 1);
//     const ratio = max === min ? 0.5 : (v - min) / (max - min);
//     const y = pad + (1 - ratio) * H;
//     return [x, y];
//   });
//   const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");

//   return (
//     <svg className="school-anal__sparkline" viewBox={`0 0 ${width} ${height}`} role="img">
//       <polyline
//         fill="none"
//         stroke="var(--border)"
//         strokeWidth="1"
//         points={`${pad},${height - pad} ${width - pad},${height - pad}`}
//       />
//       <path d={d} fill="none" stroke="var(--text)" strokeWidth="2" />
//       {pts.map(([x, y], i) => (
//         <circle key={i} cx={x} cy={y} r="2.2" fill="var(--text)" />
//       ))}
//     </svg>
//   );
// };

// /* =========================================================
//    ВКЛАДКА 1: СЧЕТА/АНАЛИТИКА ПО УЧЕБЕ
//    ========================================================= */
// const InvoicesTab = () => {
//   /* период: только месяц */
//   const now = new Date();
//   const YEARS = [2025, 2026];
//   const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
//   const defaultYear = YEARS.includes(now.getFullYear()) ? now.getFullYear() : 2025;

//   const [year, setYear] = useState(defaultYear);
//   const [month, setMonth] = useState(now.getMonth() + 1);
//   const periodLabel = `${year}-${pad2(month)}`;
//   const periodEndISO = useMemo(() => endOfMonthISO(year, month), [year, month]);

//   /* фильтры */
//   const [courseId, setCourseId] = useState("");
//   const [groupId, setGroupId] = useState("");
//   const [teacherId, setTeacherId] = useState("");
//   const [qText, setQText] = useState("");

//   /* data */
//   const [students, setStudents] = useState([]);
//   const [courses, setCourses] = useState([]);
//   const [groups, setGroups] = useState([]);
//   const [lessons, setLessons] = useState([]);
//   const [teachers, setTeachers] = useState([]);

//   /* state */
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   /* зарплата: режим и ставки (сервер) */
//   const [rateMode, setRateMode] = useState("hour"); // hour | lesson | month
//   const [teacherRates, setTeacherRates] = useState({}); // { [teacherId]: { id?, rate } }
//   const [ratesSaving, setRatesSaving] = useState(false);
//   const [ratesError, setRatesError] = useState("");

//   /* normalize */
//   const normStudent = (s = {}) => ({
//     id: s.id,
//     name: s.name ?? "",
//     phone: s.phone ?? "",
//     status: s.status ?? "active",
//     groupId: s.group ?? "",
//     groupName: s.group_name ?? "",
//     discount: dec(s.discount),
//     createdAtISO: s.created_at
//       ? String(s.created_at)
//       : new Date().toISOString().slice(0, 10),
//     createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
//   });
//   const normCourse = (c = {}) => ({
//     id: c.id,
//     name: c.title ?? "",
//     price: dec(c.price_per_month),
//   });
//   const normGroup = (g = {}) => ({
//     id: g.id,
//     name: g.name ?? "",
//     courseId: g.course ?? "",
//     courseName: g.course_title ?? "",
//   });
//   const isTimeStr = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));
//   const normLesson = (l = {}) => ({
//     id: l.id,
//     groupId: l.group ?? "",
//     date: l.date ?? "",
//     time: isTimeStr(l.time) ? l.time : "",
//     duration: Number(l.duration ?? 0),
//     teacherId: l.teacher ?? "",
//   });
//   const normEmployeeAsTeacher = (e = {}) => {
//     const first = e.first_name ?? "";
//     const last = e.last_name ?? "";
//     const display = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//     return { id: e.id, name: display };
//   };

//   /* load all */
//   const loadAll = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const [st, cr, gr, ls, em] = await Promise.all([
//         api.get(EP_STUDENTS),
//         api.get(EP_COURSES),
//         api.get(EP_GROUPS),
//         api.get(EP_LESSONS),
//         api.get(EP_EMPLOYEES),
//       ]);
//       setStudents(asArray(st.data).map(normStudent));
//       setCourses(asArray(cr.data).map(normCourse));
//       setGroups(asArray(gr.data).map(normGroup));
//       setLessons(asArray(ls.data).map(normLesson));
//       setTeachers(asArray(em.data).map(normEmployeeAsTeacher));
//     } catch (e) {
//       console.error(e);
//       setError("Не удалось загрузить данные для аналитики.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadAll();
//   }, [loadAll]);

//   useEffect(() => {
//     setGroupId("");
//   }, [courseId]);

//   /* === teacher rates API === */
//   const loadTeacherRates = useCallback(async () => {
//     setRatesError("");
//     try {
//       const res = await api.get(EP_TEACHER_RATES, {
//         params: { period: periodLabel, mode: rateMode, page_size: 1000 },
//       });
//       const arr = asArray(res.data);
//       const map = {};
//       arr.forEach((r) => {
//         const tId = r.teacher || r.teacher_id || r.teacherId;
//         if (!tId) return;
//         map[tId] = { id: r.id, rate: dec(r.rate) };
//       });
//       setTeacherRates(map);
//     } catch (e) {
//       console.error(e);
//       setTeacherRates({});
//       setRatesError("Не удалось загрузить ставки преподавателей.");
//     }
//   }, [periodLabel, rateMode]);

//   useEffect(() => {
//     loadTeacherRates();
//   }, [loadTeacherRates]);

//   const updateTeacherRate = (id, value) => {
//     const num = value === "" ? "" : Number(value);
//     setTeacherRates((prev) => ({
//       ...prev,
//       [id]: { id: prev[id]?.id, rate: value === "" ? "" : (Number.isFinite(num) ? num : prev[id]?.rate || 0) },
//     }));
//   };

//   const persistRates = async () => {
//     setRatesSaving(true);
//     setRatesError("");
//     try {
//       const tasks = Object.entries(teacherRates).map(async ([teacherId, rec]) => {
//         const rateNum = Number(rec?.rate ?? 0);
//         if (!Number.isFinite(rateNum) || rateNum < 0) return;
//         const payload = {
//           teacher: teacherId,
//           period: periodLabel,
//           mode: rateMode,
//           rate: String(rateNum),
//         };
//         if (rec?.id) {
//           await api.put(`${EP_TEACHER_RATES}${rec.id}/`, payload);
//         } else {
//           await api.post(EP_TEACHER_RATES, payload);
//         }
//       });
//       await Promise.allSettled(tasks);
//       await loadTeacherRates();
//     } catch (e) {
//       console.error(e);
//       setRatesError("Не удалось сохранить ставки.");
//     } finally {
//       setRatesSaving(false);
//     }
//   };

//   /* активные студенты по фильтрам и периоду */
//   const baseStudents = useMemo(() => {
//     return students.filter((s) => {
//       if (s.status !== "active") return false;
//       if (new Date(s.createdAtISO) > new Date(periodEndISO)) return false;

//       if (courseId) {
//         const g = groups.find((x) => String(x.id) === String(s.groupId));
//         if (!g || String(g.courseId) !== String(courseId)) return false;
//       }
//       if (groupId && String(s.groupId) !== String(groupId)) return false;

//       return true;
//     });
//   }, [students, groups, courseId, groupId, periodEndISO]);

//   /* строки по ученикам */
//   const rows = useMemo(() => {
//     const out = [];
//     baseStudents.forEach((st) => {
//       const grp = groups.find((g) => String(g.id) === String(st.groupId));
//       const crs = grp ? courses.find((c) => String(c.id) === String(grp.courseId)) : null;
//       const price = Number(crs?.price || 0);
//       if (!price) return;

//       const discount = Number(st.discount || 0);
//       const amount = Math.max(0, price - discount);

//       out.push({
//         id: `${st.id}-${periodLabel}`,
//         studentId: st.id,
//         studentName: st.name,
//         phone: st.phone,
//         courseId: crs?.id || grp?.courseId || "",
//         courseName: crs?.name || grp?.courseName || "—",
//         groupId: grp?.id || "",
//         groupName: grp?.name || st.groupName || "—",
//         price,
//         discount,
//         amount,
//         createdAt: st.createdAt,
//       });
//     });
//     return out;
//   }, [baseStudents, groups, courses, periodLabel]);

//   /* поиск по ученикам */
//   const filteredRows = useMemo(() => {
//     const t = qText.toLowerCase().trim();
//     if (!t) return rows;
//     return rows.filter((r) =>
//       [r.studentName, r.phone, r.courseName, r.groupName]
//         .filter(Boolean)
//         .some((v) => String(v).toLowerCase().includes(t))
//     );
//   }, [rows, qText]);

//   /* сводные по ученикам */
//   const totals = useMemo(() => {
//     const amount = filteredRows.reduce((acc, x) => acc + Number(x.amount || 0), 0);
//     const count = filteredRows.length;
//     return { amount, students: count, avg: count ? amount / count : 0 };
//   }, [filteredRows]);

//   const byCourse = useMemo(() => {
//     const map = new Map();
//     filteredRows.forEach((r) => {
//       const k = r.courseId || r.courseName;
//       if (!map.has(k)) map.set(k, { name: r.courseName, amount: 0, count: 0 });
//       const v = map.get(k);
//       v.amount += Number(r.amount || 0);
//       v.count += 1;
//     });
//     return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
//   }, [filteredRows]);

//   const byGroup = useMemo(() => {
//     const map = new Map();
//     filteredRows.forEach((r) => {
//       const k = r.groupId || `${r.courseName}/${r.groupName}`;
//       if (!map.has(k))
//         map.set(k, {
//           name: r.groupName,
//           amount: 0,
//           count: 0,
//           courseName: r.courseName,
//         });
//       const v = map.get(k);
//       v.amount += Number(r.amount || 0);
//       v.count += 1;
//     });
//     return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
//   }, [filteredRows]);

//   const maxCourseAmount = Math.max(1, ...byCourse.map((c) => c.amount));
//   const maxGroupAmount = Math.max(1, ...byGroup.map((g) => g.amount));

//   /* ===== ЗАРПЛАТА ПРЕПОДАВАТЕЛЕЙ ===== */
//   const lessonsInPeriod = useMemo(() => {
//     return lessons.filter((l) => {
//       if (!sameMonth(l.date, year, month)) return false;

//       const grp = groups.find((g) => String(g.id) === String(l.groupId));
//       if (courseId && (!grp || String(grp.courseId) !== String(courseId))) return false;
//       if (groupId && String(l.groupId) !== String(groupId)) return false;
//       if (teacherId && String(l.teacherId) !== String(teacherId)) return false;

//       return true;
//     });
//   }, [lessons, groups, year, month, courseId, groupId, teacherId]);

//   const teacherStats = useMemo(() => {
//     const activeStudentsByGroup = new Map();
//     baseStudents.forEach((s) => {
//       const arr = activeStudentsByGroup.get(s.groupId) || [];
//       arr.push(s);
//       activeStudentsByGroup.set(s.groupId, arr);
//     });

//     const byTeacher = new Map();
//     lessonsInPeriod.forEach((l) => {
//       if (!l.teacherId) return;
//       const tId = l.teacherId;
//       if (!byTeacher.has(tId)) {
//         const teacherName =
//           teachers.find((t) => String(t.id) === String(tId))?.name || "—";
//         byTeacher.set(tId, {
//           id: tId,
//           name: teacherName,
//           lessons: 0,
//           minutes: 0,
//           groups: new Set(),
//           students: new Set(),
//         });
//       }
//       const bucket = byTeacher.get(tId);
//       bucket.lessons += 1;
//       bucket.minutes += Number(l.duration || 0);
//       if (l.groupId) {
//         bucket.groups.add(String(l.groupId));
//         const studs = activeStudentsByGroup.get(l.groupId) || [];
//         studs.forEach((s) => bucket.students.add(String(s.id)));
//       }
//     });

//     const out = Array.from(byTeacher.values()).map((t) => {
//       const hours = t.minutes / 60;
//       const effRate = Number(teacherRates[t.id]?.rate ?? 0) || 0;
//       let amount = 0;
//       if (rateMode === "lesson") amount = t.lessons * effRate;
//       else if (rateMode === "hour") amount = hours * effRate;
//       else amount = effRate; // month — фикс за месяц
//       return {
//         id: t.id,
//         name: t.name,
//         lessons: t.lessons,
//         minutes: t.minutes,
//         hours,
//         groupsCount: t.groups.size,
//         studentsCount: t.students.size,
//         rate: effRate,
//         amount,
//       };
//     });

//     return out.sort((a, b) => b.amount - a.amount);
//   }, [lessonsInPeriod, teachers, baseStudents, teacherRates, rateMode]);

//   const payrollTotals = useMemo(() => {
//     const amount = teacherStats.reduce((acc, x) => acc + x.amount, 0);
//     const lessonsCnt = teacherStats.reduce((acc, x) => acc + x.lessons, 0);
//     const hoursCnt = teacherStats.reduce((acc, x) => acc + x.hours, 0);
//     return { amount, lessonsCnt, hoursCnt };
//   }, [teacherStats]);

//   return (
//     <div className="school-invoices">
//       {/* Header */}
//       <div className="school-invoices__header">
//         <div>
//           <h2 className="school-invoices__title">Счета · Аналитика</h2>
//           <p className="school-invoices__subtitle">
//             Период: <b>{periodLabel}</b>
//           </p>
//         </div>

//         {/* Toolbar */}
//         <div className="school-invoices__toolbar">
//           <div className="school-invoices__filters">
//             <select
//               className="school-invoices__input"
//               value={year}
//               onChange={(e) => setYear(Number(e.target.value))}
//               title="Год"
//               aria-label="Год"
//             >
//               {YEARS.map((y) => (
//                 <option key={y} value={y}>
//                   {y}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={month}
//               onChange={(e) => setMonth(Number(e.target.value))}
//               title="Месяц"
//               aria-label="Месяц"
//             >
//               {MONTHS.map((m) => (
//                 <option key={m} value={m}>
//                   {pad2(m)}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={courseId}
//               onChange={(e) => setCourseId(e.target.value)}
//               title="Курс"
//               aria-label="Курс"
//             >
//               <option value="">Все курсы</option>
//               {courses.map((c) => (
//                 <option key={c.id} value={c.id}>
//                   {c.name}
//                 </option>
//               ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={groupId}
//               onChange={(e) => setGroupId(e.target.value)}
//               title="Группа"
//               aria-label="Группа"
//               disabled={!courseId}
//             >
//               <option value="">Все группы</option>
//               {groups
//                 .filter((g) => String(g.courseId) === String(courseId))
//                 .map((g) => (
//                   <option key={g.id} value={g.id}>
//                     {g.name}
//                   </option>
//                 ))}
//             </select>

//             <select
//               className="school-invoices__input"
//               value={teacherId}
//               onChange={(e) => setTeacherId(e.target.value)}
//               title="Преподаватель"
//               aria-label="Преподаватель"
//             >
//               <option value="">Все преподаватели</option>
//               {teachers
//                 .slice()
//                 .sort((a, b) => a.name.localeCompare(b.name, "ru"))
//                 .map((t) => (
//                   <option key={t.id} value={t.id}>
//                     {t.name}
//                   </option>
//                 ))}
//             </select>
//           </div>

//           <div className="school-invoices__right">
//             <div className="school-invoices__search">
//               <FaSearch className="school-invoices__search-icon" aria-hidden />
//               <input
//                 className="school-invoices__search-input"
//                 placeholder="Поиск: ученик / телефон / курс / группа"
//                 value={qText}
//                 onChange={(e) => setQText(e.target.value)}
//                 aria-label="Поиск"
//               />
//             </div>

//             <button
//               className="school-invoices__btn school-invoices__btn--secondary"
//               onClick={() => {
//                 loadAll();
//                 loadTeacherRates();
//               }}
//               title="Обновить"
//               aria-label="Обновить"
//             >
//               <FaSync /> <span className="school-invoices__btnText">Обновить</span>
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* States */}
//       {loading && <div className="school-invoices__alert">Загрузка…</div>}
//       {!!error && !loading && (
//         <div className="school-invoices__alert">{error}</div>
//       )}

//       {/* Content */}
//       {!loading && !error && (
//         <>
//           {/* KPIs */}
//           <div className="school-invoices__kpis">
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">₮</div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Начислено за период</div>
//                 <div className="school-invoices__kpiValue">
//                   {money(totals.amount)}
//                 </div>
//               </div>
//             </div>

//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">👥</div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Активных учащихся</div>
//                 <div className="school-invoices__kpiValue">{totals.students}</div>
//               </div>
//             </div>

//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">Ø</div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Средний чек</div>
//                 <div className="school-invoices__kpiValue">{money(totals.avg)}</div>
//               </div>
//             </div>
//           </div>

//           {/* По курсам */}
//           <h3 className="school-invoices__sectionTitle">Курсы · сумма и ученики</h3>
//           <div className="school-invoices__list">
//             {byCourse.map((c, idx) => (
//               <div key={`${c.name}-${idx}`} className="school-invoices__card">
//                 <div className="school-invoices__card-left">
//                   <div className="school-invoices__avatar" aria-hidden>
//                     {(c.name || "•").charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="school-invoices__name-row">
//                       <p className="school-invoices__name">{c.name || "—"}</p>
//                       <span className="school-invoices__chip">{c.count} уч.</span>
//                     </div>
//                     <div className="school-invoices__meta">
//                       <span>
//                         Сумма: <b>{money(c.amount)}</b>
//                       </span>
//                     </div>
//                     <div className="school-invoices__bar">
//                       <div
//                         className="school-invoices__barFill"
//                         style={{ width: `${(c.amount / maxCourseAmount) * 100}%` }}
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//             {byCourse.length === 0 && (
//               <div className="school-invoices__empty">
//                 Нет данных по курсам за выбранный период.
//               </div>
//             )}
//           </div>

//           {/* По группам */}
//           <h3 className="school-invoices__sectionTitle">Группы · сумма и ученики</h3>
//           <div className="school-invoices__list">
//             {byGroup.map((g, idx) => (
//               <div key={`${g.name}-${idx}`} className="school-invoices__card">
//                 <div className="school-invoices__card-left">
//                   <div className="school-invoices__avatar" aria-hidden>
//                     {(g.name || "•").charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="school-invoices__name-row">
//                       <p className="school-invoices__name">
//                         {g.name || "—"}{" "}
//                         <span className="school-invoices__muted">
//                           · {g.courseName || "—"}
//                         </span>
//                       </p>
//                       <span className="school-invoices__chip">{g.count} уч.</span>
//                     </div>
//                     <div className="school-invoices__meta">
//                       <span>
//                         Сумма: <b>{money(g.amount)}</b>
//                       </span>
//                     </div>
//                     <div className="school-invoices__bar">
//                       <div
//                         className="school-invoices__barFill"
//                         style={{ width: `${(g.amount / maxGroupAmount) * 100}%` }}
//                       />
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//             {byGroup.length === 0 && (
//               <div className="school-invoices__empty">
//                 Нет данных по группам за выбранный период.
//               </div>
//             )}
//           </div>

//           {/* ===== ЗАРПЛАТА ===== */}
//           <h3 className="school-invoices__sectionTitle">Зарплата преподавателей</h3>

//           <div className="school-invoices__filters" style={{ marginBottom: 12 }}>
//             <select
//               className="school-invoices__input"
//               value={rateMode}
//               onChange={(e) => setRateMode(e.target.value)}
//               title="Режим начисления"
//               aria-label="Режим начисления"
//             >
//               <option value="hour">По часам</option>
//               <option value="lesson">За урок</option>
//               <option value="month">Фикс за месяц</option>
//             </select>

//             <button
//               className="school-invoices__btn school-invoices__btn--secondary"
//               onClick={persistRates}
//               title="Сохранить персональные ставки"
//               disabled={ratesSaving}
//             >
//               <FaSave />{" "}
//               <span className="school-invoices__btnText">
//                 {ratesSaving ? "Сохранение…" : "Сохранить ставки"}
//               </span>
//             </button>
//             {!!ratesError && <span className="school-invoices__alert" style={{ marginLeft: 10 }}>{ratesError}</span>}
//           </div>

//           <div className="school-invoices__kpis" style={{ marginTop: 8 }}>
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">
//                 <FaMoneyBillWave />
//               </div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Итого фонд ЗП</div>
//                 <div className="school-invoices__kpiValue">
//                   {money(payrollTotals.amount)}
//                 </div>
//               </div>
//             </div>
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">
//                 <FaHashtag />
//               </div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Уроков за период</div>
//                 <div className="school-invoices__kpiValue">
//                   {payrollTotals.lessonsCnt}
//                 </div>
//               </div>
//             </div>
//             <div className="school-invoices__kpiCard">
//               <div className="school-invoices__kpiIcon">
//                 <FaClock />
//               </div>
//               <div className="school-invoices__kpiBody">
//                 <div className="school-invoices__kpiLabel">Часов за период</div>
//                 <div className="school-invoices__kpiValue">
//                   {payrollTotals.hoursCnt.toFixed(1)}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="school-invoices__list">
//             {teacherStats.map((t) => (
//               <div key={t.id} className="school-invoices__card">
//                 <div className="school-invoices__card-left">
//                   <div className="school-invoices__avatar" aria-hidden>
//                     {(t.name || "•").charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="school-invoices__name-row">
//                       <p className="school-invoices__name">{t.name || "—"}</p>
//                       <span className="school-invoices__chip">
//                         {rateMode === "hour"
//                           ? "часовая"
//                           : rateMode === "lesson"
//                           ? "за урок"
//                           : "фикс"}
//                         : {t.rate ? money(t.rate) : "—"}
//                       </span>
//                     </div>

//                     <div className="school-invoices__meta" style={{ gap: 12 }}>
//                       <span>
//                         Уроков: <b>{t.lessons}</b>
//                       </span>
//                       <span>
//                         Часы: <b>{t.hours.toFixed(1)}</b>
//                       </span>
//                       <span>
//                         Групп: <b>{t.groupsCount}</b>
//                       </span>
//                       <span>
//                         Ученики: <b>{t.studentsCount}</b>
//                       </span>
//                     </div>

//                     <div className="school-invoices__bar">
//                       <div
//                         className="school-invoices__barFill"
//                         style={{
//                           width: `${
//                             teacherStats[0]?.amount
//                               ? (t.amount / teacherStats[0].amount) * 100
//                               : 0
//                           }%`,
//                         }}
//                       />
//                     </div>
//                   </div>
//                 </div>

//                 <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//                   <div className="school-invoices__kpiValue" style={{ fontSize: 18 }}>
//                     {money(t.amount)}
//                   </div>
//                   <input
//                     className="school-invoices__input"
//                     type="number"
//                     min="0"
//                     step="50"
//                     value={teacherRates[t.id]?.rate ?? ""}
//                     onChange={(e) => updateTeacherRate(t.id, e.target.value)}
//                     placeholder={
//                       rateMode === "hour"
//                         ? "ставка, сом/час"
//                         : rateMode === "lesson"
//                         ? "ставка, сом/урок"
//                         : "фикс, сом/мес"
//                     }
//                     title="Персональная ставка"
//                     style={{ width: 160 }}
//                   />
//                 </div>
//               </div>
//             ))}

//             {teacherStats.length === 0 && (
//               <div className="school-invoices__empty">
//                 Нет уроков/преподавателей за выбранный месяц и фильтры.
//               </div>
//             )}
//           </div>
//         </>
//       )}

//       {(useSelector((s) => s.product?.loading) || useSale().loading) && (
//         <div className="school-invoices__loading">Обновляем данные…</div>
//       )}
//     </div>
//   );
// };

// /* =========================================================
//    ВКЛАДКА 2: КАССА — только список и детали (без «Оплата»)
//    ========================================================= */
// // (оставлено без изменений; код большой и уже рабочий из твоего сообщения)
// const CashboxTab = () => {
//   // ... полностью твой код CashboxTab без изменений ...
//   // Чтобы не раздувать ответ, оставь существующую реализацию без правок.
//   return <div className="school-cbox">/* CashboxTab как у тебя */</div>;
// };

// /* =========================================================
//    ВКЛАДКА 3: АНАЛИТИКА (продажи/склад/бренды/категории/касса)
//    ========================================================= */
// // (оставлено без изменений; см. твой исходный AnalyticsTab)
// const AnalyticsTab = () => {
//   // ... полностью твой код AnalyticsTab без изменений ...
//   return <div className="school-anal">/* AnalyticsTab как у тебя */</div>;
// };

// /* =========================================================
//    HOST
//    ========================================================= */
// const SchoolInvoices = () => {
//   const [tab, setTab] = useState("invoices"); // invoices | cashbox | analytics
//   return (
//     <div className="school-tabs">
//       <div className="school-tabs__bar">
//         <button
//           className={`school-tabs__btn ${tab === "invoices" ? "is-active" : ""}`}
//           onClick={() => setTab("invoices")}
//         >
//           Отчёты-Уроки
//         </button>
//         <button
//           className={`school-tabs__btn ${tab === "cashbox" ? "is-active" : ""}`}
//           onClick={() => setTab("cashbox")}
//         >
//           Касса
//         </button>
//         <button
//           className={`school-tabs__btn ${tab === "analytics" ? "is-active" : ""}`}
//           onClick={() => setTab("analytics")}
//         >
//           Продажа-склад
//         </button>
//       </div>

//       <div className="school-tabs__panel">
//         {tab === "invoices" && <InvoicesTab />}
//         {tab === "cashbox" && <CashboxTab />}
//         {tab === "analytics" && <AnalyticsTab />}
//       </div>
//     </div>
//   );
// };

// export default SchoolInvoices;




// src/components/Education/Invoices.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaSync,
  FaMoneyBillWave,
  FaClock,
  FaHashtag,
  FaSave,
} from "react-icons/fa";
import "./Invoices.scss";
import api from "../../../../api";

/* ====== Redux (Аналитика продаж/склада) ====== */
import { useDispatch, useSelector } from "react-redux";
import { historySellProduct } from "../../../../store/creators/saleThunk";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../../store/creators/productCreators";
import { useSale } from "../../../../store/slices/saleSlice";

/* ===== endpoints ===== */
const EP_STUDENTS = "/education/students/";
const EP_COURSES = "/education/courses/";
const EP_GROUPS = "/education/groups/";
const EP_LESSONS = "/education/lessons/";
const EP_EMPLOYEES = "/users/employees/";
const EP_TEACHER_RATES = "/education/teacher-rates/";

/* ===== helpers (общие) ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const listFrom = (r) => r?.data?.results || r?.data || [];
const dec = (v) => Number(String(v ?? "0").replace(",", "."));
const money = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;
const pad2 = (n) => String(n).padStart(2, "0");
const endOfMonthISO = (year, month) =>
  new Date(year, month, 0).toISOString().slice(0, 10);
const sameMonth = (iso, year, month) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
};

/* ===== tiny sparkline ===== */
const Sparkline = ({ values = [], width = 520, height = 140 }) => {
  if (!values.length) {
    return <div className="school-anal__sparkline-empty">Нет данных</div>;
  }
  const pad = 8;
  const W = width - pad * 2;
  const H = height - pad * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = pad + (i * W) / Math.max(1, values.length - 1);
    const ratio = max === min ? 0.5 : (v - min) / (max - min);
    const y = pad + (1 - ratio) * H;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");

  return (
    <svg className="school-anal__sparkline" viewBox={`0 0 ${width} ${height}`} role="img">
      <polyline
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        points={`${pad},${height - pad} ${width - pad},${height - pad}`}
      />
      <path d={d} fill="none" stroke="var(--text)" strokeWidth="2" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="var(--text)" />
      ))}
    </svg>
  );
};

/* =========================================================
   ВКЛАДКА 1: ОТЧЁТЫ-УРОКИ (твой "второй код")
   ========================================================= */
const InvoicesTab = () => {
  /* период: только месяц */
  const now = new Date();
  const YEARS = [2025, 2026];
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  const defaultYear = YEARS.includes(now.getFullYear()) ? now.getFullYear() : 2025;

  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const periodLabel = `${year}-${pad2(month)}`;
  const periodEndISO = useMemo(() => endOfMonthISO(year, month), [year, month]);

  /* фильтры */
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [qText, setQText] = useState("");

  /* data */
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);

  /* state */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* зарплата: режим и ставки (сервер) */
  const [rateMode, setRateMode] = useState("hour"); // hour | lesson | month
  const [teacherRates, setTeacherRates] = useState({}); // { [teacherId]: { id?, rate } }
  const [ratesSaving, setRatesSaving] = useState(false);
  const [ratesError, setRatesError] = useState("");

  /* normalize */
  const normStudent = (s = {}) => ({
    id: s.id,
    name: s.name ?? "",
    phone: s.phone ?? "",
    status: s.status ?? "active",
    groupId: s.group ?? "",
    groupName: s.group_name ?? "",
    discount: dec(s.discount),
    createdAtISO: s.created_at
      ? String(s.created_at)
      : new Date().toISOString().slice(0, 10),
    createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
  });
  const normCourse = (c = {}) => ({
    id: c.id,
    name: c.title ?? "",
    price: dec(c.price_per_month),
  });
  const normGroup = (g = {}) => ({
    id: g.id,
    name: g.name ?? "",
    courseId: g.course ?? "",
    courseName: g.course_title ?? "",
  });
  const isTimeStr = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));
  const normLesson = (l = {}) => ({
    id: l.id,
    groupId: l.group ?? "",
    date: l.date ?? "",
    time: isTimeStr(l.time) ? l.time : "",
    duration: Number(l.duration ?? 0),
    teacherId: l.teacher ?? "",
  });
  const normEmployeeAsTeacher = (e = {}) => {
    const first = e.first_name ?? "";
    const last = e.last_name ?? "";
    const display = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
    return { id: e.id, name: display };
  };

  /* load all */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [st, cr, gr, ls, em] = await Promise.all([
        api.get(EP_STUDENTS),
        api.get(EP_COURSES),
        api.get(EP_GROUPS),
        api.get(EP_LESSONS),
        api.get(EP_EMPLOYEES),
      ]);
      setStudents(asArray(st.data).map(normStudent));
      setCourses(asArray(cr.data).map(normCourse));
      setGroups(asArray(gr.data).map(normGroup));
      setLessons(asArray(ls.data).map(normLesson));
      setTeachers(asArray(em.data).map(normEmployeeAsTeacher));
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные для аналитики.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setGroupId("");
  }, [courseId]);

  /* === teacher rates API === */
  const loadTeacherRates = useCallback(async () => {
    setRatesError("");
    try {
      const res = await api.get(EP_TEACHER_RATES, {
        params: { period: periodLabel, mode: rateMode, page_size: 1000 },
      });
      const arr = asArray(res.data);
      const map = {};
      arr.forEach((r) => {
        const tId = r.teacher || r.teacher_id || r.teacherId;
        if (!tId) return;
        map[tId] = { id: r.id, rate: dec(r.rate) };
      });
      setTeacherRates(map);
    } catch (e) {
      console.error(e);
      setTeacherRates({});
      setRatesError("Не удалось загрузить ставки преподавателей.");
    }
  }, [periodLabel, rateMode]);

  useEffect(() => {
    loadTeacherRates();
  }, [loadTeacherRates]);

  const updateTeacherRate = (id, value) => {
    const numVal = value === "" ? "" : Number(value);
    setTeacherRates((prev) => ({
      ...prev,
      [id]: {
        id: prev[id]?.id,
        rate: value === "" ? "" : (Number.isFinite(numVal) ? numVal : prev[id]?.rate || 0),
      },
    }));
  };

  const persistRates = async () => {
    setRatesSaving(true);
    setRatesError("");
    try {
      const tasks = Object.entries(teacherRates).map(async ([teacherId, rec]) => {
        const rateNum = Number(rec?.rate ?? 0);
        if (!Number.isFinite(rateNum) || rateNum < 0) return;
        const payload = {
          teacher: teacherId,
          period: periodLabel,
          mode: rateMode,
          rate: String(rateNum),
        };
        if (rec?.id) {
          await api.put(`${EP_TEACHER_RATES}${rec.id}/`, payload);
        } else {
          await api.post(EP_TEACHER_RATES, payload);
        }
      });
      await Promise.allSettled(tasks);
      await loadTeacherRates();
    } catch (e) {
      console.error(e);
      setRatesError("Не удалось сохранить ставки.");
    } finally {
      setRatesSaving(false);
    }
  };

  /* активные студенты по фильтрам и периоду */
  const baseStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== "active") return false;
      if (new Date(s.createdAtISO) > new Date(periodEndISO)) return false;

      if (courseId) {
        const g = groups.find((x) => String(x.id) === String(s.groupId));
        if (!g || String(g.courseId) !== String(courseId)) return false;
      }
      if (groupId && String(s.groupId) !== String(groupId)) return false;

      return true;
    });
  }, [students, groups, courseId, groupId, periodEndISO]);

  /* строки по ученикам */
  const rows = useMemo(() => {
    const out = [];
    baseStudents.forEach((st) => {
      const grp = groups.find((g) => String(g.id) === String(st.groupId));
      const crs = grp ? courses.find((c) => String(c.id) === String(grp.courseId)) : null;
      const price = Number(crs?.price || 0);
      if (!price) return;

      const discount = Number(st.discount || 0);
      const amount = Math.max(0, price - discount);

      out.push({
        id: `${st.id}-${periodLabel}`,
        studentId: st.id,
        studentName: st.name,
        phone: st.phone,
        courseId: crs?.id || grp?.courseId || "",
        courseName: crs?.name || grp?.courseName || "—",
        groupId: grp?.id || "",
        groupName: grp?.name || st.groupName || "—",
        price,
        discount,
        amount,
        createdAt: st.createdAt,
      });
    });
    return out;
  }, [baseStudents, groups, courses, periodLabel]);

  /* поиск по ученикам */
  const filteredRows = useMemo(() => {
    const t = qText.toLowerCase().trim();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.studentName, r.phone, r.courseName, r.groupName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    );
  }, [rows, qText]);

  /* сводные по ученикам */
  const totals = useMemo(() => {
    const amount = filteredRows.reduce((acc, x) => acc + Number(x.amount || 0), 0);
    const count = filteredRows.length;
    return { amount, students: count, avg: count ? amount / count : 0 };
  }, [filteredRows]);

  const byCourse = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((r) => {
      const k = r.courseId || r.courseName;
      if (!map.has(k)) map.set(k, { name: r.courseName, amount: 0, count: 0 });
      const v = map.get(k);
      v.amount += Number(r.amount || 0);
      v.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredRows]);

  const byGroup = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((r) => {
      const k = r.groupId || `${r.courseName}/${r.groupName}`;
      if (!map.has(k))
        map.set(k, {
          name: r.groupName,
          amount: 0,
          count: 0,
          courseName: r.courseName,
        });
      const v = map.get(k);
      v.amount += Number(r.amount || 0);
      v.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredRows]);

  const maxCourseAmount = Math.max(1, ...byCourse.map((c) => c.amount));
  const maxGroupAmount = Math.max(1, ...byGroup.map((g) => g.amount));

  /* ===== ЗАРПЛАТА ПРЕПОДАВАТЕЛЕЙ ===== */
  const lessonsInPeriod = useMemo(() => {
    return lessons.filter((l) => {
      if (!sameMonth(l.date, year, month)) return false;

      const grp = groups.find((g) => String(g.id) === String(l.groupId));
      if (courseId && (!grp || String(grp.courseId) !== String(courseId))) return false;
      if (groupId && String(l.groupId) !== String(groupId)) return false;
      if (teacherId && String(l.teacherId) !== String(teacherId)) return false;

      return true;
    });
  }, [lessons, groups, year, month, courseId, groupId, teacherId]);

  const teacherStats = useMemo(() => {
    const activeStudentsByGroup = new Map();
    baseStudents.forEach((s) => {
      const arr = activeStudentsByGroup.get(s.groupId) || [];
      arr.push(s);
      activeStudentsByGroup.set(s.groupId, arr);
    });

    const byTeacher = new Map();
    lessonsInPeriod.forEach((l) => {
      if (!l.teacherId) return;
      const tId = l.teacherId;
      if (!byTeacher.has(tId)) {
        const teacherName =
          teachers.find((t) => String(t.id) === String(tId))?.name || "—";
        byTeacher.set(tId, {
          id: tId,
          name: teacherName,
          lessons: 0,
          minutes: 0,
          groups: new Set(),
          students: new Set(),
        });
      }
      const bucket = byTeacher.get(tId);
      bucket.lessons += 1;
      bucket.minutes += Number(l.duration || 0);
      if (l.groupId) {
        bucket.groups.add(String(l.groupId));
        const studs = activeStudentsByGroup.get(l.groupId) || [];
        studs.forEach((s) => bucket.students.add(String(s.id)));
      }
    });

    const out = Array.from(byTeacher.values()).map((t) => {
      const hours = t.minutes / 60;
      const effRate = Number(teacherRates[t.id]?.rate ?? 0) || 0;
      let amount = 0;
      if (rateMode === "lesson") amount = t.lessons * effRate;
      else if (rateMode === "hour") amount = hours * effRate;
      else amount = effRate; // month — фикс за месяц
      return {
        id: t.id,
        name: t.name,
        lessons: t.lessons,
        minutes: t.minutes,
        hours,
        groupsCount: t.groups.size,
        studentsCount: t.students.size,
        rate: effRate,
        amount,
      };
    });

    return out.sort((a, b) => b.amount - a.amount);
  }, [lessonsInPeriod, teachers, baseStudents, teacherRates, rateMode]);

  const payrollTotals = useMemo(() => {
    const amount = teacherStats.reduce((acc, x) => acc + x.amount, 0);
    const lessonsCnt = teacherStats.reduce((acc, x) => acc + x.lessons, 0);
    const hoursCnt = teacherStats.reduce((acc, x) => acc + x.hours, 0);
    return { amount, lessonsCnt, hoursCnt };
  }, [teacherStats]);

  return (
    <div className="school-invoices">
      {/* Header */}
      <div className="school-invoices__header">
        <div>
          <h2 className="school-invoices__title">Счета · Аналитика</h2>
          <p className="school-invoices__subtitle">
            Период: <b>{periodLabel}</b>
          </p>
        </div>

        {/* Toolbar */}
        <div className="school-invoices__toolbar">
          <div className="school-invoices__filters">
            <select
              className="school-invoices__input"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              title="Год"
              aria-label="Год"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              className="school-invoices__input"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              title="Месяц"
              aria-label="Месяц"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {pad2(m)}
                </option>
              ))}
            </select>

            <select
              className="school-invoices__input"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              title="Курс"
              aria-label="Курс"
            >
              <option value="">Все курсы</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="school-invoices__input"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              title="Группа"
              aria-label="Группа"
              disabled={!courseId}
            >
              <option value="">Все группы</option>
              {groups
                .filter((g) => String(g.courseId) === String(courseId))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>

            <select
              className="school-invoices__input"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              title="Преподаватель"
              aria-label="Преподаватель"
            >
              <option value="">Все преподаватели</option>
              {teachers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, "ru"))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="school-invoices__right">
            <div className="school-invoices__search">
              <FaSearch className="school-invoices__search-icon" aria-hidden />
              <input
                className="school-invoices__search-input"
                placeholder="Поиск: ученик / телефон / курс / группа"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                aria-label="Поиск"
              />
            </div>

            <button
              className="school-invoices__btn school-invoices__btn--secondary"
              onClick={() => {
                loadAll();
                loadTeacherRates();
              }}
              title="Обновить"
              aria-label="Обновить"
            >
              <FaSync /> <span className="school-invoices__btnText">Обновить</span>
            </button>
          </div>
        </div>
      </div>

      {/* States */}
      {loading && <div className="school-invoices__alert">Загрузка…</div>}
      {!!error && !loading && (
        <div className="school-invoices__alert">{error}</div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* KPIs */}
          <div className="school-invoices__kpis">
            <div className="school-invoices__kpiCard">
              <div className="school-invoices__kpiIcon">₮</div>
              <div className="school-invoices__kpiBody">
                <div className="school-invoices__kpiLabel">Начислено за период</div>
                <div className="school-invoices__kpiValue">
                  {money(totals.amount)}
                </div>
              </div>
            </div>

            <div className="school-invoices__kpiCard">
              <div className="school-invoices__kpiIcon">👥</div>
              <div className="school-invoices__kpiBody">
                <div className="school-invoices__kpiLabel">Активных учащихся</div>
                <div className="school-invoices__kpiValue">{totals.students}</div>
              </div>
            </div>

            <div className="school-invoices__kpiCard">
              <div className="school-invoices__kpiIcon">Ø</div>
              <div className="school-invoices__kpiBody">
                <div className="school-invoices__kpiLabel">Средний чек</div>
                <div className="school-invoices__kpiValue">{money(totals.avg)}</div>
              </div>
            </div>
          </div>

          {/* По курсам */}
          <h3 className="school-invoices__sectionTitle">Курсы · сумма и ученики</h3>
          <div className="school-invoices__list">
            {byCourse.map((c, idx) => (
              <div key={`${c.name}-${idx}`} className="school-invoices__card">
                <div className="school-invoices__card-left">
                  <div className="school-invoices__avatar" aria-hidden>
                    {(c.name || "•").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="school-invoices__name-row">
                      <p className="school-invoices__name">{c.name || "—"}</p>
                      <span className="school-invoices__chip">{c.count} уч.</span>
                    </div>
                    <div className="school-invoices__meta">
                      <span>
                        Сумма: <b>{money(c.amount)}</b>
                      </span>
                    </div>
                    <div className="school-invoices__bar">
                      <div
                        className="school-invoices__barFill"
                        style={{ width: `${(c.amount / maxCourseAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {byCourse.length === 0 && (
              <div className="school-invoices__empty">
                Нет данных по курсам за выбранный период.
              </div>
            )}
          </div>

          {/* По группам */}
          <h3 className="school-invoices__sectionTitle">Группы · сумма и ученики</h3>
          <div className="school-invoices__list">
            {byGroup.map((g, idx) => (
              <div key={`${g.name}-${idx}`} className="school-invoices__card">
                <div className="school-invoices__card-left">
                  <div className="school-invoices__avatar" aria-hidden>
                    {(g.name || "•").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="school-invoices__name-row">
                      <p className="school-invoices__name">
                        {g.name || "—"}{" "}
                        <span className="school-invoices__muted">
                          · {g.courseName || "—"}
                        </span>
                      </p>
                      <span className="school-invoices__chip">{g.count} уч.</span>
                    </div>
                    <div className="school-invoices__meta">
                      <span>
                        Сумма: <b>{money(g.amount)}</b>
                      </span>
                    </div>
                    <div className="school-invoices__bar">
                      <div
                        className="school-invoices__barFill"
                        style={{ width: `${(g.amount / maxGroupAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {byGroup.length === 0 && (
              <div className="school-invoices__empty">
                Нет данных по группам за выбранный период.
              </div>
            )}
          </div>

          {/* ===== ЗАРПЛАТА ===== */}
          <h3 className="school-invoices__sectionTitle">Зарплата преподавателей</h3>

          <div className="school-invoices__filters" style={{ marginBottom: 12 }}>
            <select
              className="school-invoices__input"
              value={rateMode}
              onChange={(e) => setRateMode(e.target.value)}
              title="Режим начисления"
              aria-label="Режим начисления"
            >
              <option value="hour">По часам</option>
              <option value="lesson">За урок</option>
              <option value="month">Фикс за месяц</option>
            </select>

            <button
              className="school-invoices__btn school-invoices__btn--secondary"
              onClick={persistRates}
              title="Сохранить персональные ставки"
              disabled={ratesSaving}
            >
              <FaSave />{" "}
              <span className="school-invoices__btnText">
                {ratesSaving ? "Сохранение…" : "Сохранить ставки"}
              </span>
            </button>
            {!!ratesError && (
              <span className="school-invoices__alert" style={{ marginLeft: 10 }}>
                {ratesError}
              </span>
            )}
          </div>

          <div className="school-invoices__kpis" style={{ marginTop: 8 }}>
            <div className="school-invoices__kpiCard">
              <div className="school-invoices__kpiIcon">
                <FaMoneyBillWave />
              </div>
              <div className="school-invoices__kpiBody">
                <div className="school-invoices__kpiLabel">Итого фонд ЗП</div>
                <div className="school-invoices__kpiValue">
                  {money(payrollTotals.amount)}
                </div>
              </div>
            </div>
            <div className="school-invoices__kpiCard">
              <div className="school-invoices__kpiIcon">
                <FaHashtag />
              </div>
              <div className="school-invoices__kpiBody">
                <div className="school-invoices__kpiLabel">Уроков за период</div>
                <div className="school-invoices__kpiValue">
                  {payrollTotals.lessonsCnt}
                </div>
              </div>
            </div>
            <div className="school-invoices__kpiCard">
              <div className="school-invoices__kpiIcon">
                <FaClock />
              </div>
              <div className="school-invoices__kpiBody">
                <div className="school-invoices__kpiLabel">Часов за период</div>
                <div className="school-invoices__kpiValue">
                  {payrollTotals.hoursCnt.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          <div className="school-invoices__list">
            {teacherStats.map((t) => (
              <div key={t.id} className="school-invoices__card">
                <div className="school-invoices__card-left">
                  <div className="school-invoices__avatar" aria-hidden>
                    {(t.name || "•").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="school-invoices__name-row">
                      <p className="school-invoices__name">{t.name || "—"}</p>
                      <span className="school-invoices__chip">
                        {rateMode === "hour"
                          ? "часовая"
                          : rateMode === "lesson"
                          ? "за урок"
                          : "фикс"}
                        : {t.rate ? money(t.rate) : "—"}
                      </span>
                    </div>

                    <div className="school-invoices__meta" style={{ gap: 12 }}>
                      <span>
                        Уроков: <b>{t.lessons}</b>
                      </span>
                      <span>
                        Часы: <b>{t.hours.toFixed(1)}</b>
                      </span>
                      <span>
                        Групп: <b>{t.groupsCount}</b>
                      </span>
                      <span>
                        Ученики: <b>{t.studentsCount}</b>
                      </span>
                    </div>

                    <div className="school-invoices__bar">
                      <div
                        className="school-invoices__barFill"
                        style={{
                          width: `${
                            teacherStats[0]?.amount
                              ? (t.amount / teacherStats[0].amount) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className="school-invoices__kpiValue" style={{ fontSize: 18 }}>
                    {money(t.amount)}
                  </div>
                  <input
                    className="school-invoices__input"
                    type="number"
                    min="0"
                    step="50"
                    value={teacherRates[t.id]?.rate ?? ""}
                    onChange={(e) => updateTeacherRate(t.id, e.target.value)}
                    placeholder={
                      rateMode === "hour"
                        ? "ставка, сом/час"
                        : rateMode === "lesson"
                        ? "ставка, сом/урок"
                        : "фикс, сом/мес"
                    }
                    title="Персональная ставка"
                    style={{ width: 160 }}
                  />
                </div>
              </div>
            ))}

            {teacherStats.length === 0 && (
              <div className="school-invoices__empty">
                Нет уроков/преподавателей за выбранный месяц и фильтры.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* =========================================================
   ВКЛАДКА 2: КАССА — список и детали (из твоего исходника)
   ========================================================= */
const CashboxTab = () => {
  const [view, setView] = useState("list"); // list | detail
  const [detailId, setDetailId] = useState(null);

  /* ---------- LIST ---------- */
  const CashboxListInline = ({ onOpen }) => {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");

    const fmtMoney = (v) =>
      (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
      " c";

    const load = async () => {
      try {
        setErr("");
        setLoading(true);
        const { data } = await api.get("/construction/cashboxes/");
        setRows(asArray(data));
      } catch (e) {
        console.error(e);
        setErr("Не удалось загрузить кассы");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      load();
    }, []);

    const filtered = useMemo(() => {
      const t = q.trim().toLowerCase();
      if (!t) return rows;
      return rows.filter((r) =>
        [r.department_name, r.name]
          .filter(Boolean)
          .some((x) => String(x || "").toLowerCase().includes(t))
      );
    }, [rows, q]);

    const onCreate = async () => {
      const title = (name || "").trim();
      if (!title) {
        alert("Введите название кассы");
        return;
      }
      try {
        await api.post("/construction/cashboxes/", { name: title });
        setCreateOpen(false);
        setName("");
        load();
      } catch (e) {
        console.error(e);
        alert("Не удалось создать кассу");
      }
    };

    return (
      <div className="school-cbox">
        <div className="school-cbox__toolbar">
          <div className="school-cbox__toolbar-side">
            <span className="school-cbox__total">Всего: {filtered.length}</span>
          </div>
          <div className="school-cbox__controls">
            <input
              className="school-cbox__search"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="school-cbox__btn" onClick={() => setCreateOpen(true)}>
              Создать кассу
            </button>
          </div>
        </div>

        {err && <div className="school-cbox__error">{err}</div>}

        <div className="school-cbox__table-wrap">
          <table className="school-cbox__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Название</th>
                <th>Приход</th>
                <th>Расход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Загрузка…</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className="school-cbox__row"
                    onClick={() => onOpen(r.id)}
                  >
                    <td>{i + 1}</td>
                    <td>
                      <b>{r.department_name || r.name || "—"}</b>
                    </td>
                    <td>{fmtMoney(r.analytics?.income?.total || 0)}</td>
                    <td>{fmtMoney(r.analytics?.expense?.total || 0)}</td>
                    <td>
                      <button
                        className="school-cbox__btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(r.id);
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="school-cbox__muted">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {createOpen && (
          <div className="school-cbox-modal">
            <div
              className="school-cbox-modal__overlay"
              onClick={() => setCreateOpen(false)}
            />
            <div
              className="school-cbox-modal__content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="school-cbox-modal__header">
                <h3 className="school-cbox-modal__title">Создать кассу</h3>
                <button
                  className="school-cbox-modal__close"
                  onClick={() => setCreateOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="school-cbox-modal__section">
                <label className="school-cbox-modal__label">Название кассы *</label>
                <input
                  className="school-cbox-modal__input"
                  type="text"
                  placeholder="Например: касса №1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="school-cbox-modal__footer">
                <button className="school-cbox__btn" onClick={onCreate}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ---------- DETAIL ---------- */
  const CashboxDetailInline = ({ id, onBack }) => {
    const [box, setBox] = useState(null);
    const [ops, setOps] = useState([]);
    const [tab, setTab] = useState("all");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
    const fmtMoney = (v) =>
      (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
      " c";

    const arrFromAny = (res) => {
      const d = res?.data ?? res ?? [];
      if (Array.isArray(d?.results)) return d.results;
      if (Array.isArray(d)) return d;
      return [];
    };

    const load = async () => {
      setErr("");
      setLoading(true);
      try {
        let detail = null;
        try {
          detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`))
            .data;
        } catch {}
        if (!detail) {
          try {
            detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
              .data;
          } catch {}
        }
        if (!detail) {
          detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
        }
        setBox(detail);

        let flows =
          arrFromAny({ data: detail?.operations }) ||
          arrFromAny({ data: detail?.flows }) ||
          arrFromAny({ data: detail?.transactions });

        if (!flows.length) {
          try {
            const r1 = await api.get(`/construction/cashflows/`, {
              params: { cashbox: id },
            });
            flows = arrFromAny(r1);
          } catch {}
        }
        if (!flows.length && detail?.uuid) {
          try {
            const r2 = await api.get(`/construction/cashflows/`, {
              params: { cashbox: detail.uuid },
            });
            flows = arrFromAny(r2);
          } catch {}
        }

        const mapped = (flows || []).map((x, i) => {
          const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
          let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
          if (type !== "income" && type !== "expense")
            type = amt >= 0 ? "income" : "expense";
          return {
            id: x.id || x.uuid || `${i}`,
            type,
            title:
              x.title ||
              x.name ||
              x.description ||
              x.note ||
              (type === "income" ? "Приход" : "Расход"),
            amount: Math.abs(amt),
            created_at:
              x.created_at ||
              x.created ||
              x.date ||
              x.timestamp ||
              x.createdAt ||
              null,
          };
        });

        setOps(mapped);
      } catch (e) {
        console.error(e);
        setErr("Не удалось загрузить детали кассы");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      if (id) load();
    }, [id]);

    const shown = useMemo(() => {
      if (tab === "income") return ops.filter((o) => o.type === "income");
      if (tab === "expense") return ops.filter((o) => o.type === "expense");
      return ops;
    }, [ops, tab]);

    return (
      <div className="school-cbox">
        <div className="school-cbox__header">
          <div className="school-cbox__tabs">
            <button className="school-cbox__tab" onClick={onBack}>
              ← Назад
            </button>
            <span className="school-cbox__tab is-active">
              {box?.department_name || box?.name || "Касса"}
            </span>
          </div>
        </div>

        <div className="school-cbox__seg">
          <button
            className={`school-cbox__seg-btn ${tab === "expense" ? "is-active" : ""}`}
            onClick={() => setTab("expense")}
          >
            Расход
          </button>
          <button
            className={`school-cbox__seg-btn ${tab === "income" ? "is-active" : ""}`}
            onClick={() => setTab("income")}
          >
            Приход
          </button>
          <button
            className={`school-cbox__seg-btn ${tab === "all" ? "is-active" : ""}`}
            onClick={() => setTab("all")}
          >
            Все
          </button>
          <div className="school-cbox__seg-grow" />
        </div>

        <div className="school-cbox__table-wrap">
          <table className="school-cbox__table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Наименование</th>
                <th>Сумма</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Загрузка…</td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={4} className="school-cbox__error">
                    {err}
                  </td>
                </tr>
              ) : shown.length ? (
                shown.map((o) => (
                  <tr key={o.id}>
                    <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                    <td>{o.title}</td>
                    <td>{fmtMoney(o.amount)}</td>
                    <td>{when(o.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="school-cbox__muted">
                    Нет операций
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="school-cbox">
      {view === "list" && (
        <CashboxListInline
          onOpen={(id) => {
            setDetailId(id);
            setView("detail");
          }}
        />
      )}
      {view === "detail" && (
        <CashboxDetailInline id={detailId} onBack={() => setView("list")} />
      )}
    </div>
  );
};

/* =========================================================
   ВКЛАДКА 3: АНАЛИТИКА (продажи/склад/бренды/категории/касса)
   — как в твоём исходнике
   ========================================================= */
const AnalyticsTab = () => {
  const dispatch = useDispatch();

  const { history = [], loading: salesLoading, error: salesError } = useSale();
  const {
    list: products = [],
    brands = [],
    categories = [],
    loading: productsLoading,
  } = useSelector((s) => s.product || {});

  const [activeTab, setActiveTab] = useState("sales"); // sales | inventory | taxonomy | cashbox
  const [startDate, setStartDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [granularity, setGranularity] = useState("month"); // day | month | year

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const lan =
    (typeof localStorage !== "undefined" && localStorage.getItem("i18nextLng")) ||
    "ru";
  const nfMoney = useMemo(() => {
    try {
      return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
        style: "currency",
        currency: "KGS",
        maximumFractionDigits: 0,
      });
    } catch {
      return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
    }
  }, [lan]);
  const nfInt = useMemo(
    () => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"),
    [lan]
  );

  const parseISO = (s) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const keyByGranularity = (date, g) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    if (g === "day") return `${y}-${m}-${d}`;
    if (g === "year") return `${y}`;
    return `${y}-${m}`;
  };
  const inRange = (d) => {
    const sd = parseISO(startDate);
    const ed = parseISO(endDate);
    if (!d || !sd || !ed) return false;
    const from = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, 0, 0);
    const to = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59);
    return d >= from && d <= to;
  };
  const quickPreset = (preset) => {
    const now = new Date();
    if (preset === "thisMonth") {
      const sd = new Date(now.getFullYear(), now.getMonth(), 1);
      const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "lastMonth") {
      const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ed = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "ytd") {
      const sd = new Date(now.getFullYear(), 0, 1);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
      setGranularity("month");
    }
    if (preset === "thisYear") {
      const sd = new Date(now.getFullYear(), 0, 1);
      const ed = new Date(now.getFullYear(), 11, 31);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("month");
    }
  };

  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
  }, [dispatch]);

  /* SALES */
  const salesFiltered = useMemo(
    () => (history || []).filter((r) => inRange(parseISO(r?.created_at))),
    [history, startDate, endDate]
  );

  const salesTotals = useMemo(() => {
    const count = salesFiltered.length;
    const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
    return { count, revenue, avg: count ? revenue / count : 0 };
  }, [salesFiltered]);

  const salesSeries = useMemo(() => {
    const bucket = new Map();
    for (const r of salesFiltered) {
      const d = parseISO(r?.created_at);
      if (!d) continue;
      const key = keyByGranularity(d, granularity);
      bucket.set(key, num(bucket.get(key)) + num(r?.total));
    }
    const keys = sortKeysAsc(Array.from(bucket.keys()));
    return { labels: keys, values: keys.map((k) => Math.round(num(bucket.get(k)))) };
  }, [salesFiltered, granularity]);

  /* INVENTORY */
  const LOW_STOCK_THRESHOLD = 5;

  const inventoryKPIs = useMemo(() => {
    const totalSkus = products.length;
    const lowStock = products.filter((p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD).length;

    const stockValueByPrice = products.reduce(
      (acc, p) => acc + num(p?.price) * num(p?.quantity),
      0
    );

    const stockValueByCost =
      products.some((p) => "cost_price" in p)
        ? products.reduce((acc, p) => acc + num(p?.cost_price) * num(p?.quantity), 0)
        : null;

    return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
  }, [products]);

  const topCategories = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [products]);

  const lowStockList = useMemo(
    () => [...products].sort((a, b) => num(a?.quantity) - num(b?.quantity)).slice(0, 10),
    [products]
  );

  const abcStats = useMemo(() => {
    if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
    const items = products.map((p) => {
      const value =
        "cost_price" in p ? num(p.cost_price) * num(p.quantity) : num(p.price) * num(p.quantity);
      return { id: p.id, name: p.name, value };
    });
    items.sort((a, b) => b.value - a.value);
    const total = items.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    let A = 0,
      B = 0,
      C = 0;
    const tagged = items.map((it) => {
      acc += it.value;
      const share = acc / total;
      let tag = "C";
      if (share <= 0.8) tag = "A";
      else if (share <= 0.95) tag = "B";
      if (tag === "A") A += 1;
      else if (tag === "B") B += 1;
      else C += 1;
      return { ...it, tag };
    });
    return { A, B, C, list: tagged.slice(0, 10) };
  }, [products]);

  /* TAXONOMY */
const brandStats = useMemo(() => {
  const m = new Map();
  products.forEach((p) => {
    const key = p?.brand || p?.brand_name || "Без бренда";
    m.set(key, num(m.get(key)) + 1);
  });
  const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);

  // total — из brands из стора (если есть), иначе считаем по парам
  const total = (Array.isArray(brands) ? brands.length : 0) || pairs.length;

  return { total, top: pairs.slice(0, 10) };
}, [products, brands]);


  const categoryStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { total: categories.length || pairs.length, top: pairs.slice(0, 10) };
  }, [products, categories]);

  /* CASHBOX analytics */
  const [boxes, setBoxes] = useState([]);
  const [flows, setFlows] = useState([]);
  const [boxId, setBoxId] = useState("all");
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState("");

  useEffect(() => {
    if (activeTab !== "cashbox" || boxes.length) return;
    (async () => {
      try {
        const res = await api.get("/construction/cashboxes/", {
          params: { page_size: 1000 },
        });
        setBoxes(listFrom(res));
      } catch (e) {
        console.error(e);
        setBoxes([]);
      }
    })();
  }, [activeTab, boxes.length]);

  const loadFlows = async () => {
    setCashError("");
    setCashLoading(true);
    try {
      const params = { page_size: 1000 };
      if (boxId !== "all") params.cashbox = boxId;
      const r = await api.get("/construction/cashflows/", { params });
      const raw = listFrom(r) || [];
      const normalized = raw.map((x, i) => {
        const amt = num(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense")
          type = amt >= 0 ? "income" : "expense";
        const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
        const cashboxName =
          x.cashbox?.department_name || x.cashbox?.name || x.cashbox_name || null;
        return {
          id: x.id || x.uuid || `${i}`,
          type,
          amount: Math.abs(amt),
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          created_at:
            x.created_at || x.created || x.date || x.timestamp || x.createdAt || null,
          cashboxId,
          cashboxName,
        };
      });
      setFlows(normalized);
    } catch (e) {
      console.error(e);
      setCashError("Не удалось загрузить операции кассы");
      setFlows([]);
    } finally {
      setCashLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "cashbox") loadFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, boxId, startDate, endDate, granularity]);

  const flowsFiltered = useMemo(
    () => flows.filter((f) => {
      const d = parseISO(f.created_at);
      return d && inRange(d);
    }),
    [flows, startDate, endDate]
  );

  const cashTotals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const f of flowsFiltered) {
      if (f.type === "income") income += f.amount;
      else expense += f.amount;
    }
    return { income, expense, net: income - expense };
  }, [flowsFiltered]);

  const cashSeries = useMemo(() => {
    const inc = new Map();
    const exp = new Map();
    for (const f of flowsFiltered) {
      const d = parseISO(f.created_at);
      if (!d) continue;
      const k = keyByGranularity(d, granularity);
      if (f.type === "income") inc.set(k, num(inc.get(k)) + f.amount);
      else exp.set(k, num(exp.get(k)) + f.amount);
    }
    const keys = sortKeysAsc(Array.from(new Set([...inc.keys(), ...exp.keys()])));
    const incomeVals = keys.map((k) => Math.round(num(inc.get(k))));
    const expenseVals = keys.map((k) => Math.round(num(exp.get(k))));
    const netVals = keys.map((_, i) =>
      Math.round(num(incomeVals[i]) - num(expenseVals[i]))
    );
    return { labels: keys, incomeVals, expenseVals, netVals };
  }, [flowsFiltered, granularity]);

  const perBox = useMemo(() => {
    const map = new Map();
    for (const f of flowsFiltered) {
      const id = f.cashboxId || "—";
      const name =
        f.cashboxName ||
        boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
        boxes.find((b) => (b.id || b.uuid) === id)?.name ||
        "—";
      const cur = map.get(id) || { name, income: 0, expense: 0 };
      if (f.type === "income") cur.income += f.amount;
      else cur.expense += f.amount;
      map.set(id, cur);
    }
    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [flowsFiltered, boxes]);

  const topExpenseByTitle = useMemo(() => {
    const m = new Map();
    for (const f of flowsFiltered) {
      if (f.type !== "expense") continue;
      const key = (f.title || "Расход").toString();
      m.set(key, num(m.get(key)) + f.amount);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [flowsFiltered]);

  return (
    <div className="school-anal">
      {/* саб-вкладки */}
      <div className="school-anal__tabs">
        <button
          className={`school-anal__tab ${activeTab === "sales" ? "is-active" : ""}`}
          onClick={() => setActiveTab("sales")}
        >
          Продажи
        </button>
        <button
          className={`school-anal__tab ${activeTab === "inventory" ? "is-active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          Склад
        </button>
        <button
          className={`school-anal__tab ${activeTab === "taxonomy" ? "is-active" : ""}`}
          onClick={() => setActiveTab("taxonomy")}
        >
          Бренды/Категории
        </button>
        <button
          className={`school-anal__tab ${activeTab === "cashbox" ? "is-active" : ""}`}
          onClick={() => setActiveTab("cashbox")}
        >
          Касса
        </button>
      </div>

      {(activeTab === "sales" || activeTab === "cashbox") && (
        <div className="school-anal__controls">
          <div className="school-anal__presets">
            <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
            <button onClick={() => quickPreset("lastMonth")}>Прошлый месяц</button>
            <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
            <button onClick={() => quickPreset("thisYear")}>Весь год</button>
          </div>
          <div className="school-anal__range">
            <label className="school-anal__label">
              С
              <input
                type="date"
                className="school-anal__input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="school-anal__label">
              До
              <input
                type="date"
                className="school-anal__input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>

            <div className="school-anal__seg">
              <button
                className={granularity === "day" ? "is-active" : ""}
                onClick={() => setGranularity("day")}
              >
                Дни
              </button>
              <button
                className={granularity === "month" ? "is-active" : ""}
                onClick={() => setGranularity("month")}
              >
                Месяцы
              </button>
              <button
                className={granularity === "year" ? "is-active" : ""}
                onClick={() => setGranularity("year")}
              >
                Годы
              </button>
            </div>

            {activeTab === "cashbox" && (
              <label className="school-anal__label">
                Касса
                <select
                  className="school-anal__input"
                  value={boxId}
                  onChange={(e) => setBoxId(e.target.value)}
                >
                  <option value="all">Все кассы</option>
                  {boxes.map((b) => (
                    <option key={b.id || b.uuid} value={b.id || b.uuid}>
                      {b.department_name || b.name || (b.id || b.uuid)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {/* SALES */}
      {activeTab === "sales" && (
        <>
          <div className="school-anal__kpis">
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Число продаж</div>
              <div className="school-anal__kpi-value">
                {nfInt.format(salesTotals.count)}
              </div>
            </div>
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Выручка</div>
              <div className="school-anal__kpi-value">
                {nfMoney.format(num(salesTotals.revenue))}
              </div>
            </div>
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Средний чек</div>
              <div className="school-anal__kpi-value">
                {nfMoney.format(num(salesTotals.avg))}
              </div>
            </div>
          </div>

          <div className="school-anal__card">
            {salesLoading ? (
              <div className="school-anal__note">Загрузка истории продаж…</div>
            ) : salesError ? (
              <div className="school-anal__error">Ошибка: {String(salesError)}</div>
            ) : (
              <>
                <div className="school-anal__card-title">
                  Динамика выручки (
                  {granularity === "day"
                    ? "дни"
                    : granularity === "month"
                    ? "месяцы"
                    : "годы"}
                  )
                </div>
                <Sparkline values={salesSeries.values} />
                <div className="school-anal__legend">
                  {salesSeries.labels.map((l, i) => (
                    <span className="school-anal__legend-item" key={i}>
                      {l}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="school-anal__card">
            <div className="school-anal__card-title">Последние продажи</div>
            {salesFiltered.length ? (
              <div className="school-anal__table-wrap">
                <table className="school-anal__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Пользователь</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesFiltered.slice(0, 10).map((r, i) => (
                      <tr key={r?.id ?? i}>
                        <td>{i + 1}</td>
                        <td>{r?.user_display || "—"}</td>
                        <td>{nfMoney.format(num(r?.total))}</td>
                        <td>{r?.status || "—"}</td>
                        <td>
                          {r?.created_at
                            ? new Date(r.created_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="school-anal__note">Нет продаж в выбранном периоде.</div>
            )}
          </div>
        </>
      )}

      {/* INVENTORY */}
      {activeTab === "inventory" && (
        <>
          <div className="school-anal__kpis">
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Всего SKU</div>
              <div className="school-anal__kpi-value">
                {nfInt.format(products.length)}
              </div>
            </div>
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Стоимость склада</div>
              <div className="school-anal__kpi-value">
                {inventoryKPIs.stockValueByCost != null
                  ? nfMoney.format(inventoryKPIs.stockValueByCost)
                  : nfMoney.format(inventoryKPIs.stockValueByPrice)}
              </div>
            </div>
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Низкие остатки (≤5)</div>
              <div className="school-anal__kpi-value">
                {nfInt.format(inventoryKPIs.lowStock)}
              </div>
            </div>
          </div>

          <div className="school-anal__grid">
            <div className="school-anal__card">
              <div className="school-anal__card-title">
                Топ-10 категорий по кол-ву SKU
              </div>
              <ul className="school-anal__bars">
                {topCategories.length ? (
                  topCategories.map(([name, count], i) => {
                    const max = topCategories[0][1] || 1;
                    const width = clamp(Math.round((count / max) * 100), 5, 100);
                    return (
                      <li className="school-anal__bar" key={i}>
                        <span className="school-anal__bar-name" title={name}>
                          {name}
                        </span>
                        <span className="school-anal__bar-track">
                          <span
                            className="school-anal__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="school-anal__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="school-anal__empty">Нет данных</li>
                )}
              </ul>
            </div>

            <div className="school-anal__card">
              <div className="school-anal__card-title">
                Топ-10 с минимальными остатками
              </div>
              <ul className="school-anal__list">
                {lowStockList.length ? (
                  lowStockList.map((p, i) => (
                    <li className="school-anal__row" key={p?.id ?? i}>
                      <span
                        className="school-anal__row-name"
                        title={p?.name || "—"}
                      >
                        {p?.name || "—"}
                      </span>
                      <span className="school-anal__row-qty">
                        Остаток: {nfInt.format(num(p?.quantity))}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="school-anal__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="school-anal__card">
            <div className="school-anal__card-title">ABC по стоимости запаса</div>
            <div className="school-anal__abc">
              <div className="school-anal__abc-badge school-anal__abc-badge--a">
                A: {nfInt.format(abcStats.A)}
              </div>
              <div className="school-anal__abc-badge school-anal__abc-badge--b">
                B: {nfInt.format(abcStats.B)}
              </div>
              <div className="school-anal__abc-badge school-anal__abc-badge--c">
                C: {nfInt.format(abcStats.C)}
              </div>
            </div>
            <ul className="school-anal__list">
              {abcStats.list.length ? (
                abcStats.list.map((it, i) => (
                  <li className="school-anal__row" key={it.id ?? i}>
                    <span className="school-anal__row-name" title={it.name}>
                      {it.name}
                    </span>
                    <span className="school-anal__row-qty">
                      {it.tag} · {nfMoney.format(it.value)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="school-anal__empty">Нет данных</li>
              )}
            </ul>
            <p className="school-anal__note">
              * Если есть <code>cost_price</code>, используем его. Иначе считаем по{" "}
              <code>price</code>.
            </p>
          </div>
        </>
      )}

      {/* TAXONOMY */}
      {activeTab === "taxonomy" && (
        <div className="school-anal__grid">
          <div className="school-anal__card">
            <div className="school-anal__card-title">
              Бренды{" "}
              <span className="school-anal__muted">
                (всего: {nfInt.format(brandStats.total)})
              </span>
            </div>
            <ul className="school-anal__bars">
              {brandStats.top.length ? (
                brandStats.top.map(([name, count], i) => {
                  const max = brandStats.top[0][1] || 1;
                  const width = clamp(Math.round((count / max) * 100), 5, 100);
                  return (
                    <li className="school-anal__bar" key={i}>
                      <span className="school-anal__bar-name" title={name}>
                        {name}
                      </span>
                      <span className="school-anal__bar-track">
                        <span
                          className="school-anal__bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="school-anal__bar-value">
                        {nfInt.format(count)}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="school-anal__empty">Нет данных</li>
              )}
            </ul>
          </div>

          <div className="school-anal__card">
            <div className="school-anal__card-title">
              Категории{" "}
              <span className="school-anal__muted">
                (всего: {nfInt.format(categoryStats.total)})
              </span>
            </div>
            <ul className="school-anal__bars">
              {categoryStats.top.length ? (
                categoryStats.top.map(([name, count], i) => {
                  const max = categoryStats.top[0][1] || 1;
                  const width = clamp(Math.round((count / max) * 100), 5, 100);
                  return (
                    <li className="school-anal__bar" key={i}>
                      <span className="school-anal__bar-name" title={name}>
                        {name}
                      </span>
                      <span className="school-anal__bar-track">
                        <span
                          className="school-anal__bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="school-anal__bar-value">
                        {nfInt.format(count)}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="school-anal__empty">Нет данных</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* CASHBOX */}
      {activeTab === "cashbox" && (
        <>
          <div className="school-anal__kpis">
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Приход</div>
              <div className="school-anal__kpi-value">
                {nfMoney.format(cashTotals.income)}
              </div>
            </div>
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Расход</div>
              <div className="school-anal__kpi-value">
                {nfMoney.format(cashTotals.expense)}
              </div>
            </div>
            <div className="school-anal__kpi">
              <div className="school-anal__kpi-label">Сальдо</div>
              <div className="school-anal__kpi-value">
                {nfMoney.format(cashTotals.net)}
              </div>
            </div>
          </div>

          <div className="school-anal__grid">
            <div className="school-anal__card">
              <div className="school-anal__card-title">
                Динамика чистого потока (
                {granularity === "day"
                  ? "дни"
                  : granularity === "month"
                  ? "месяцы"
                  : "годы"}
                )
              </div>
              {cashLoading ? (
                <div className="school-anal__note">Загрузка операций…</div>
              ) : cashError ? (
                <div className="school-anal__error">{cashError}</div>
              ) : (
                <>
                  <Sparkline values={cashSeries.netVals} />
                  <div className="school-anal__legend">
                    {cashSeries.labels.map((l, i) => (
                      <span className="school-anal__legend-item" key={i}>
                        {l}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="school-anal__card">
              <div className="school-anal__card-title">Срез по кассам</div>
              <div className="school-anal__table-wrap">
                <table className="school-anal__table">
                  <thead>
                    <tr>
                      <th>Касса</th>
                      <th>Приход</th>
                      <th>Расход</th>
                      <th>Сальдо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perBox.length ? (
                      perBox.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{nfMoney.format(r.income)}</td>
                          <td>{nfMoney.format(r.expense)}</td>
                          <td>{nfMoney.format(r.net)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="school-anal__empty">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="school-anal__card">
              <div className="school-anal__card-title">Топ-10 статей расхода</div>
              <ul className="school-anal__bars">
                {topExpenseByTitle.length ? (
                  topExpenseByTitle.map(([title, sum], i) => {
                    const max = topExpenseByTitle[0][1] || 1;
                    const width = clamp(Math.round((sum / max) * 100), 5, 100);
                    return (
                      <li className="school-anal__bar" key={i}>
                        <span className="school-anal__bar-name" title={title}>
                          {title}
                        </span>
                        <span className="school-anal__bar-track">
                          <span
                            className="school-anal__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="school-anal__bar-value">
                          {nfMoney.format(sum)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="school-anal__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="school-anal__card school-anal__card--scroll">
            <div className="school-anal__card-title">Последние операции</div>
            <div className="school-anal__table-wrap">
              <table className="school-anal__table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Статья</th>
                    <th>Сумма</th>
                    <th>Касса</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {cashLoading ? (
                    <tr>
                      <td colSpan={5}>Загрузка…</td>
                    </tr>
                  ) : flowsFiltered.length ? (
                    flowsFiltered
                      .slice()
                      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                      .slice(0, 50)
                      .map((f, i) => (
                        <tr key={f.id ?? i}>
                          <td>{f.type === "income" ? "Приход" : "Расход"}</td>
                          <td>{f.title}</td>
                          <td>{nfMoney.format(f.amount)}</td>
                          <td>{f.cashboxName || "—"}</td>
                          <td>
                            {f.created_at
                              ? new Date(f.created_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="school-anal__empty">
                        Нет операций
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {cashLoading && (
            <div className="school-anal__loading">Обновляем операции…</div>
          )}
        </>
      )}

      {(productsLoading || salesLoading) && activeTab !== "cashbox" && (
        <div className="school-anal__loading">Обновляем данные…</div>
      )}
    </div>
  );
};

/* =========================================================
   HOST
   ========================================================= */
const SchoolInvoices = () => {
  const [tab, setTab] = useState("invoices"); // invoices | cashbox | analytics
  return (
    <div className="school-tabs">
      <div className="school-tabs__bar">
        <button
          className={`school-tabs__btn ${tab === "invoices" ? "is-active" : ""}`}
          onClick={() => setTab("invoices")}
        >
          Отчёты-Уроки
        </button>
        <button
          className={`school-tabs__btn ${tab === "cashbox" ? "is-active" : ""}`}
          onClick={() => setTab("cashbox")}
        >
          Касса
        </button>
        <button
          className={`school-tabs__btn ${tab === "analytics" ? "is-active" : ""}`}
          onClick={() => setTab("analytics")}
        >
          Продажа-склад
        </button>
      </div>

      <div className="school-tabs__panel">
        {tab === "invoices" && <InvoicesTab />}
        {tab === "cashbox" && <CashboxTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
};

export default SchoolInvoices;
