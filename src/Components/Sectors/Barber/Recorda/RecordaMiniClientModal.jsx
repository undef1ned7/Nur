// RecordaMiniClientModal.jsx
import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import "./Recorda.scss";
import api from "../../../../api";
import {
  norm,
  normalizePhone,
  normalizeName,
  isValidPhone,
} from "./RecordaUtils";

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

  if (!isOpen) return null;

  const closeMini = () => {
    if (!miniSaving) onClose();
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
    if (!isValidPhone(phone)) {
      errs.phone = true;
      alerts.push("Телефон должен содержать минимум 10 цифр.");
    }

    const digits = normalizePhone(phone);
    const dupLocal = clients.find(
      (c) =>
        normalizePhone(c.phone) === digits ||
        normalizeName(c.name) === normalizeName(name)
    );

    if (!errs.name && !errs.phone && dupLocal) {
      errs.name = true;
      errs.phone = true;
      alerts.push("Клиент с такими данными уже существует.");
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
        phone,
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

      onClientsChange(cls);
      if (newId) {
        onSelectClient(String(newId));
      }
      onClose();
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
      if (!msgs.length) {
        msgs.push("Не удалось создать клиента.");
      }
      setMiniAlerts(msgs);
    } finally {
      setMiniSaving(false);
    }
  };

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

        <form
          className="barberrecorda__miniForm"
          onSubmit={saveMini}
          noValidate
        >
          <label
            className={`barberrecorda__field ${
              miniErrs.name ? "is-invalid" : ""
            }`}
          >
            <span className="barberrecorda__label">ФИО</span>
            <input
              className="barberrecorda__input"
              value={miniName}
              onChange={(e) => setMiniName(e.target.value)}
              placeholder="Фамилия Имя Отчество"
              autoFocus
              required
            />
          </label>
          <label
            className={`barberrecorda__field ${
              miniErrs.phone ? "is-invalid" : ""
            }`}
          >
            <span className="barberrecorda__label">Телефон</span>
            <input
              className="barberrecorda__input"
              value={miniPhone}
              onChange={(e) => setMiniPhone(e.target.value)}
              placeholder="+996 ..."
              inputMode="tel"
              required
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
