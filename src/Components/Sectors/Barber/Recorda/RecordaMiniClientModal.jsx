// // RecordaMiniClientModal.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { FaTimes } from "react-icons/fa";
// import "./Recorda.scss";
// import api from "../../../../api";
// import {
//   norm,
//   normalizePhone,
//   normalizeName,
//   isValidPhone,
// } from "./RecordaUtils";

// const RecordaMiniClientModal = ({
//   isOpen,
//   onClose,
//   clients,
//   onClientsChange,
//   onSelectClient,
// }) => {
//   const [miniName, setMiniName] = useState("");
//   const [miniPhone, setMiniPhone] = useState("");
//   const [miniSaving, setMiniSaving] = useState(false);
//   const [miniAlerts, setMiniAlerts] = useState([]);
//   const [miniErrs, setMiniErrs] = useState({});

//   // ✅ хуки всегда вызываются, даже если isOpen=false
//   useEffect(() => {
//     if (!isOpen) return;
//     setMiniName("");
//     setMiniPhone("");
//     setMiniSaving(false);
//     setMiniAlerts([]);
//     setMiniErrs({});
//   }, [isOpen]);

//   const nameNorm = useMemo(() => {
//     if (!isOpen) return "";
//     return normalizeName(norm(miniName));
//   }, [isOpen, miniName]);

//   const phoneDigits = useMemo(() => {
//     if (!isOpen) return "";
//     return normalizePhone(norm(miniPhone));
//   }, [isOpen, miniPhone]);

//   const suggestions = useMemo(() => {
//     if (!isOpen) return [];

//     const hasQuery = !!nameNorm || !!phoneDigits;
//     if (!hasQuery) return [];

//     const arr = (clients || []).filter((c) => {
//       const cName = normalizeName(norm(c?.name));
//       const cPhone = normalizePhone(norm(c?.phone));
//       const byName = nameNorm ? cName.includes(nameNorm) : false;
//       const byPhone = phoneDigits ? cPhone.includes(phoneDigits) : false;
//       return byName || byPhone;
//     });

//     return arr.slice(0, 8);
//   }, [isOpen, clients, nameNorm, phoneDigits]);

//   const closeMini = () => {
//     if (!miniSaving) onClose?.();
//   };

//   const pickExisting = (c) => {
//     if (!c?.id) return;
//     onSelectClient?.(String(c.id));
//     onClose?.();
//   };

//   const saveMini = async (e) => {
//     e?.preventDefault?.();

//     setMiniSaving(true);
//     setMiniAlerts([]);
//     setMiniErrs({});

//     const name = norm(miniName);
//     const phone = norm(miniPhone);

//     const alerts = [];
//     const errs = {};

//     if (!name) {
//       errs.name = true;
//       alerts.push("Укажите ФИО.");
//     }

//     // ✅ телефон НЕ обязателен
//     // проверяем только если пользователь реально что-то ввёл
//     if (phone) {
//       if (!isValidPhone(phone)) {
//         errs.phone = true;
//         alerts.push("Телефон должен содержать минимум 10 цифр.");
//       }
//     }

//     // локальный дубль: по телефону (если ввели) или по имени
//     const dupLocal = (clients || []).find((c) => {
//       const samePhone = phone
//         ? normalizePhone(c?.phone) === normalizePhone(phone)
//         : false;
//       const sameName = normalizeName(c?.name) === normalizeName(name);
//       return samePhone || sameName;
//     });

//     if (!errs.name && !errs.phone && dupLocal) {
//       errs.name = true;
//       errs.phone = true;
//       alerts.push("Клиент уже существует — выберите его из списка.");
//     }

//     if (alerts.length) {
//       setMiniErrs(errs);
//       setMiniAlerts(alerts);
//       setMiniSaving(false);
//       return;
//     }

//     try {
//       const payload = {
//         full_name: name,
//         // ✅ если не ввели — отправляем null
//         phone: phone ? phone : null,
//         status: "active",
//         notes: null,
//         company: localStorage.getItem("company"),
//       };

//       const { data } = await api.post("/barbershop/clients/", payload);
//       const newId = data?.id;

//       const cl = await api.get("/barbershop/clients/");
//       const arr = Array.isArray(cl.data?.results)
//         ? cl.data.results
//         : Array.isArray(cl.data)
//         ? cl.data
//         : [];

//       const cls = arr
//         .map((c) => ({
//           id: c.id,
//           name: c.full_name || c.name || "",
//           phone: c.phone || c.phone_number || "",
//           status: c.status || "active",
//         }))
//         .sort((a, b) => a.name.localeCompare(b.name, "ru"));

//       onClientsChange?.(cls);

//       if (newId) onSelectClient?.(String(newId));
//       onClose?.();
//     } catch (e2) {
//       const d = e2?.response?.data;
//       const msgs = [];
//       if (typeof d === "string") {
//         msgs.push(d);
//       } else if (d && typeof d === "object") {
//         Object.values(d).forEach((v) =>
//           msgs.push(String(Array.isArray(v) ? v[0] : v))
//         );
//       }
//       if (!msgs.length) msgs.push("Не удалось создать клиента.");
//       setMiniAlerts(msgs);
//       console.error("Create client error:", e2);
//     } finally {
//       setMiniSaving(false);
//     }
//   };

//   // ✅ return null ТОЛЬКО после хуков
//   if (!isOpen) return null;

//   return (
//     <div
//       className="barberrecorda__overlay barberrecorda__overlay--inner"
//       onClick={closeMini}
//     >
//       <div
//         className="barberrecorda__mini"
//         onClick={(e) => e.stopPropagation()}
//         role="dialog"
//         aria-modal="true"
//       >
//         <div className="barberrecorda__miniHeader">
//           <h4 className="barberrecorda__miniTitle">Новый клиент</h4>
//           <button
//             type="button"
//             className="barberrecorda__iconBtn"
//             onClick={closeMini}
//             aria-label="Закрыть"
//           >
//             <FaTimes />
//           </button>
//         </div>

//         {miniAlerts.length > 0 && (
//           <div className="barberrecorda__alert barberrecorda__alert--inModal barberrecorda__alert--danger">
//             {miniAlerts.length === 1 ? (
//               miniAlerts[0]
//             ) : (
//               <ul className="barberrecorda__alertList">
//                 {miniAlerts.map((m, i) => (
//                   <li key={i}>{m}</li>
//                 ))}
//               </ul>
//             )}
//           </div>
//         )}

//         <form
//           className="barberrecorda__miniForm"
//           onSubmit={saveMini}
//           noValidate
//         >
//           <label
//             className={`barberrecorda__field ${
//               miniErrs.name ? "is-invalid" : ""
//             }`}
//           >
//             <span className="barberrecorda__label">ФИО</span>
//             <input
//               className="barberrecorda__input"
//               value={miniName}
//               onChange={(e) => setMiniName(e.target.value)}
//               placeholder="Фамилия Имя Отчество"
//               autoFocus
//               required
//             />

//             {suggestions.length > 0 && (
//               <div className="barberrecorda__suggestList">
//                 {suggestions.map((c) => (
//                   <button
//                     key={c.id}
//                     type="button"
//                     className="barberrecorda__suggestItem"
//                     onClick={() => pickExisting(c)}
//                     title="Выбрать существующего клиента"
//                   >
//                     <span className="barberrecorda__suggestName">
//                       {c.name || "Без имени"}
//                     </span>
//                     {c.phone ? (
//                       <span className="barberrecorda__suggestPhone">
//                         {c.phone}
//                       </span>
//                     ) : null}
//                   </button>
//                 ))}
//               </div>
//             )}
//           </label>

//           <label
//             className={`barberrecorda__field ${
//               miniErrs.phone ? "is-invalid" : ""
//             }`}
//           >
//             <span className="barberrecorda__label">Телефон</span>
//             <input
//               className="barberrecorda__input"
//               value={miniPhone}
//               onChange={(e) => setMiniPhone(e.target.value)}
//               placeholder="+996 ..."
//               inputMode="tel"
//               // ✅ НЕ required
//             />
//           </label>

//           <div className="barberrecorda__footer">
//             <span className="barberrecorda__spacer" />
//             <button
//               type="button"
//               className="barberrecorda__btn barberrecorda__btn--secondary"
//               onClick={closeMini}
//               disabled={miniSaving}
//             >
//               Отмена
//             </button>
//             <button
//               type="submit"
//               className="barberrecorda__btn barberrecorda__btn--primary"
//               disabled={miniSaving}
//             >
//               {miniSaving ? "Создание…" : "Создать"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default RecordaMiniClientModal;




// RecordaMiniClientModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import "./Recorda.scss";
import api from "../../../../api";
import { norm, normalizePhone, normalizeName, isValidPhone } from "./RecordaUtils";

const RecordaMiniClientModal = ({
  isOpen,
  onClose,
  clients,
  onClientsChange,
  onSelectClient,
}) => {
  const [miniName, setMiniName] = useState("");
  const [miniPhone, setMiniPhone] = useState("");
  const [miniSaving, setMiniSaving] = useState(false);
  const [miniAlerts, setMiniAlerts] = useState([]);
  const [miniErrs, setMiniErrs] = useState({});

  // ✅ управление: где фокус (чтобы подсказки работали только на ФИО)
  const [isNameActive, setIsNameActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setMiniName("");
    setMiniPhone("");
    setMiniSaving(false);
    setMiniAlerts([]);
    setMiniErrs({});
    setIsNameActive(true);
  }, [isOpen]);

  const nameNorm = useMemo(() => {
    if (!isOpen) return "";
    return normalizeName(norm(miniName));
  }, [isOpen, miniName]);

  // phoneDigits нужен для валидации/дублей, но НЕ для подсказок
  const phoneDigits = useMemo(() => {
    if (!isOpen) return "";
    return normalizePhone(norm(miniPhone));
  }, [isOpen, miniPhone]);

  // ✅ ПОДСКАЗКИ ТОЛЬКО ПО ФИО (телефон вообще не участвует)
  const suggestions = useMemo(() => {
    if (!isOpen) return [];
    if (!isNameActive) return [];

    const q = nameNorm;
    if (!q) return [];

    const arr = (clients || []).filter((c) => {
      const cName = normalizeName(norm(c?.name));
      return cName.includes(q);
    });

    return arr.slice(0, 8);
  }, [isOpen, clients, nameNorm, isNameActive]);

  const closeMini = () => {
    if (!miniSaving) onClose?.();
  };

  const pickExisting = (c) => {
    if (!c?.id) return;
    onSelectClient?.(String(c.id));
    onClose?.();
  };

  const saveMini = async (e) => {
    e?.preventDefault?.();

    setMiniSaving(true);
    setMiniAlerts([]);
    setMiniErrs({});

    const name = norm(miniName);
    const phone = norm(miniPhone);

    const alerts = [];
    const errs = {};

    if (!name) {
      errs.name = true;
      alerts.push("Укажите ФИО.");
    }

    // ✅ телефон НЕ обязателен — проверяем только если ввели
    if (phone) {
      if (!isValidPhone(phone)) {
        errs.phone = true;
        alerts.push("Телефон должен содержать минимум 10 цифр.");
      }
    }

    // ✅ дубль: по телефону (если ввели) или по имени
    const dupLocal = (clients || []).find((c) => {
      const samePhone = phone
        ? normalizePhone(c?.phone) === normalizePhone(phone)
        : false;
      const sameName = normalizeName(c?.name) === normalizeName(name);
      return samePhone || sameName;
    });

    if (!errs.name && !errs.phone && dupLocal) {
      errs.name = true;
      errs.phone = true;
      alerts.push("Клиент уже существует — выберите его по ФИО.");
    }

    if (alerts.length) {
      setMiniErrs(errs);
      setMiniAlerts(alerts);
      setMiniSaving(false);
      return;
    }

    try {
      const payload = {
        full_name: name,
        phone: phone ? phone : null,
        status: "active",
        notes: null,
        company: localStorage.getItem("company"),
      };

      const { data } = await api.post("/barbershop/clients/", payload);
      const newId = data?.id;

      const cl = await api.get("/barbershop/clients/");
      const arr = Array.isArray(cl.data?.results)
        ? cl.data.results
        : Array.isArray(cl.data)
        ? cl.data
        : [];

      const cls = arr
        .map((c) => ({
          id: c.id,
          name: c.full_name || c.name || "",
          phone: c.phone || c.phone_number || "",
          status: c.status || "active",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      onClientsChange?.(cls);

      if (newId) onSelectClient?.(String(newId));
      onClose?.();
    } catch (e2) {
      const d = e2?.response?.data;
      const msgs = [];

      if (typeof d === "string") {
        msgs.push(d);
      } else if (d && typeof d === "object") {
        Object.values(d).forEach((v) =>
          msgs.push(String(Array.isArray(v) ? v[0] : v))
        );
      }

      if (!msgs.length) msgs.push("Не удалось создать клиента.");
      setMiniAlerts(msgs);
      console.error("Create client error:", e2);
    } finally {
      setMiniSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="barberrecorda__overlay barberrecorda__overlay--inner"
      onClick={closeMini}
    >
      <div
        className="barberrecorda__mini"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="barberrecorda__miniHeader">
          <h4 className="barberrecorda__miniTitle">Новый клиент</h4>
          <button
            type="button"
            className="barberrecorda__iconBtn"
            onClick={closeMini}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        {miniAlerts.length > 0 && (
          <div className="barberrecorda__alert barberrecorda__alert--inModal barberrecorda__alert--danger">
            {miniAlerts.length === 1 ? (
              miniAlerts[0]
            ) : (
              <ul className="barberrecorda__alertList">
                {miniAlerts.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form className="barberrecorda__miniForm" onSubmit={saveMini} noValidate>
          <label
            className={`barberrecorda__field ${miniErrs.name ? "is-invalid" : ""}`}
          >
            <span className="barberrecorda__label">ФИО</span>
            <input
              className="barberrecorda__input"
              value={miniName}
              onChange={(e) => setMiniName(e.target.value)}
              onFocus={() => setIsNameActive(true)}
              placeholder="Фамилия Имя Отчество"
              autoFocus
              required
              autoComplete="off"
              name="mini-client-name"
            />

            {suggestions.length > 0 && (
              <div
                className="barberrecorda__suggestList"
                // ✅ чтобы клик по варианту не ломался из-за blur/focus
                onMouseDown={(e) => e.preventDefault()}
              >
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="barberrecorda__suggestItem"
                    onClick={() => pickExisting(c)}
                    title="Выбрать существующего клиента"
                  >
                    <span className="barberrecorda__suggestName">
                      {c.name || "Без имени"}
                    </span>
                    {c.phone ? (
                      <span className="barberrecorda__suggestPhone">{c.phone}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label
            className={`barberrecorda__field ${miniErrs.phone ? "is-invalid" : ""}`}
          >
            <span className="barberrecorda__label">Телефон</span>
            <input
              className="barberrecorda__input"
              value={miniPhone}
              onChange={(e) => setMiniPhone(e.target.value)}
              onFocus={() => setIsNameActive(false)} // ✅ телефон закрывает подсказки
              placeholder="+996 ..."
              inputMode="tel"
              autoComplete="off"
              name="mini-client-phone"
            />
          </label>

          <div className="barberrecorda__footer">
            <span className="barberrecorda__spacer" />
            <button
              type="button"
              className="barberrecorda__btn barberrecorda__btn--secondary"
              onClick={closeMini}
              disabled={miniSaving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="barberrecorda__btn barberrecorda__btn--primary"
              disabled={miniSaving}
            >
              {miniSaving ? "Создание…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordaMiniClientModal;
