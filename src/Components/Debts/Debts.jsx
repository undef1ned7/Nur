// src/components/Debts/Debts.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./debts.scss";

/* ===== helpers ===== */
const money = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(Number(v) || 0)
  ) + " с";

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const phoneNorm = (p) => (p || "").replace(/[^\d+]/g, "");

// ISO -> YYYY-MM-DD
const toYMD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ISO -> YYYY-MM-DD HH:mm
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${toYMD(d)} ${hh}:${mm}`;
};

// ISO попадает в [from; to] где from/to = YYYY-MM-DD
const inRange = (iso, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const from = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : -Infinity;
  const to = toStr ? new Date(`${toStr}T23:59:59.999`).getTime() : +Infinity;
  return t >= from && t <= to;
};

const listFrom = (res) =>
  Array.isArray(res?.data?.results)
    ? res.data.results
    : Array.isArray(res?.data)
    ? res.data
    : [];

const extractApiErr = (e, fallback = "Ошибка запроса") => {
  try {
    const data = e?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return data.join("; ");
    const parts = [];
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
      else parts.push(`${k}: ${String(v)}`);
    }
    return parts.join("; ");
  } catch {
    return fallback;
  }
};

/* ===== API ===== */
async function fetchDebtsAll() {
  let url = "/main/debts/";
  const acc = [];
  let guard = 0;
  while (url && guard < 60) {
    const res = await api.get(url);
    acc.push(...listFrom(res));
    url = res?.data?.next || null;
    guard += 1;
  }
  return acc;
}

async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

async function updateDebt(id, payload) {
  const res = await api.patch(`/main/debts/${id}/`, payload);
  return res.data;
}

async function deleteDebt(id) {
  await api.delete(`/main/debts/${id}/`);
}

/* ===== Component ===== */
const Debts = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // create modal
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [formErr, setFormErr] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // pay modal (уменьшение суммы)
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [payErr, setPayErr] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [eFullName, setEFullName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [editErr, setEditErr] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // delete inline confirm
  const [confirmId, setConfirmId] = useState(null);

  /* load */
  const load = async () => {
    try {
      setLoading(true);
      setLoadErr("");
      const data = await fetchDebtsAll();
      setItems(data);
    } catch (e) {
      console.error(e);
      setLoadErr(extractApiErr(e, "Не удалось загрузить долги"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* filter */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = !s
      ? items
      : items.filter((x) => `${x.name} ${x.phone}`.toLowerCase().includes(s));
    if (dateFrom || dateTo) {
      arr = arr.filter((x) => inRange(x.created_at, dateFrom, dateTo));
    }
    return [...arr].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }, [items, q, dateFrom, dateTo]);

  /* new */
  const openNew = () => {
    setFullName("");
    setPhone("");
    setAmount("");
    setFormErr("");
    setIsNewOpen(true);
  };

  const submitNew = async (e) => {
    e.preventDefault();
    setFormErr("");

    if (!fullName.trim()) return setFormErr("Введите имя");
    const ph = phoneNorm(phone);
    if (!ph) return setFormErr("Введите телефон");
    if (items.some((x) => phoneNorm(x.phone) === ph))
      return setFormErr("Такой номер телефона уже существует");
    const a = num(amount);
    if (!(a > 0)) return setFormErr("Введите сумму долга (> 0)");

    try {
      setSavingNew(true);
      const created = await createDebt({
        name: fullName.trim(),
        phone: ph,
        amount: String(a), // backend decimal string
      });
      setItems((p) => [created, ...p]);
      setIsNewOpen(false);
    } catch (e2) {
      console.error(e2);
      setFormErr(extractApiErr(e2, "Не удалось создать долг"));
    } finally {
      setSavingNew(false);
    }
  };

  /* pay = decrease amount */
  const openPay = (id) => {
    setPayId(id);
    setPayAmt("");
    setPayErr("");
    setPayOpen(true);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    setPayErr("");
    const amt = num(payAmt);
    if (!(amt > 0)) return setPayErr("Введите сумму оплаты (> 0)");

    const current = items.find((x) => x.id === payId);
    if (!current) return setPayErr("Запись не найдена");

    // «долг» показываем по balance если есть, иначе по amount
    const baseDebt = num(
      current.balance != null ? current.balance : current.amount
    );
    const nextAmount = Math.max(0, baseDebt - amt);

    try {
      setSavingPay(true);
      // уменьшаем amount у долга
      const updated = await updateDebt(payId, { amount: String(nextAmount) });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setPayOpen(false);
    } catch (e2) {
      console.error(e2);
      setPayErr(extractApiErr(e2, "Не удалось обновить сумму долга"));
    } finally {
      setSavingPay(false);
    }
  };

  /* edit */
  const openEdit = (item) => {
    setEditId(item.id);
    setEFullName(item.name || "");
    setEPhone(item.phone || "");
    setEAmount(String(item.amount ?? ""));
    setEditErr("");
    setEditOpen(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setEditErr("");

    if (!eFullName.trim()) return setEditErr("Введите имя");
    const ph = phoneNorm(ePhone);
    if (!ph) return setEditErr("Введите телефон");
    if (items.some((x) => x.id !== editId && phoneNorm(x.phone) === ph))
      return setEditErr("Такой номер телефона уже существует");
    const newAmount = num(eAmount);
    if (!(newAmount > 0)) return setEditErr("Введите сумму долга (> 0)");

    try {
      setSavingEdit(true);
      const updated = await updateDebt(editId, {
        name: eFullName.trim(),
        phone: ph,
        amount: String(newAmount),
      });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditOpen(false);
    } catch (e2) {
      console.error(e2);
      setEditErr(extractApiErr(e2, "Не удалось сохранить изменения"));
    } finally {
      setSavingEdit(false);
    }
  };

  /* delete (inline confirm) */
  const askDelete = (id) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async (id) => {
    try {
      await deleteDebt(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <section className="catalog">
      {/* Header controls */}
      <div className="catalog__controls">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="catalog__search"
            placeholder="Поиск по имени/телефону…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Поиск"
          />
          <input
            type="date"
            className="catalog__search"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Дата от (по дате создания)"
          />
          <input
            type="date"
            className="catalog__search"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Дата до (по дате создания)"
          />
        </div>

        <button
          className="catalog__btn catalog__btn--primary"
          onClick={openNew}
        >
          + Добавить долг
        </button>
      </div>

      {loadErr && (
        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#b91c1c",
            borderRadius: 10,
            padding: "8px 10px",
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          {loadErr}
        </div>
      )}

      {/* Table */}
      <div style={{ overflow: "auto" }}>
        <table className="catalog__table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Долг</th>
              <th>Создан</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "#6b7280" }}>
                  Загрузка…
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((x) => (
                <tr key={x.id}>
                  <td data-label="Имя">{x.name}</td>
                  <td data-label="Телефон">{x.phone}</td>
                  <td data-label="Долг">
                    {money(x.balance != null ? x.balance : x.amount)}
                  </td>
                  <td data-label="Создан">{fmtDateTime(x.created_at)}</td>
                  <td data-label="Действия">
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="catalog__btn catalog__btn--secondary"
                        onClick={() => openPay(x.id)}
                        title="Оплатить (уменьшить сумму)"
                      >
                        Оплатить
                      </button>
                      <button
                        className="catalog__btn catalog__btn--secondary"
                        onClick={() => openEdit(x)}
                        title="Изменить"
                      >
                        Изменить
                      </button>

                      {confirmId === x.id ? (
                        <>
                          <button
                            className="catalog__btn catalog__btn--danger"
                            onClick={() => doDelete(x.id)}
                          >
                            Да, удалить
                          </button>
                          <button
                            className="catalog__btn"
                            onClick={cancelDelete}
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <button
                          className="catalog__btn"
                          onClick={() => askDelete(x.id)}
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "#6b7280" }}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Новый долг */}
      {isNewOpen && (
        <div className="catalog__overlay" onClick={() => setIsNewOpen(false)}>
          <div
            className="catalog__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-new-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="catalog__modalTitle" id="debt-new-title">
              Новый долг
            </div>

            {formErr && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: "8px 10px",
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                {formErr}
              </div>
            )}

            <form onSubmit={submitNew}>
              <input
                className="catalog__input"
                placeholder="Имя *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
              <input
                className="catalog__input"
                placeholder="Телефон * (только цифры, уникальный)"
                inputMode="numeric"
                pattern="\d*"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
              <input
                className="catalog__input"
                placeholder="Сумма долга * (только цифры)"
                inputMode="numeric"
                pattern="\d*"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              />

              <div className="catalog__modalActions" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="catalog__btn"
                  onClick={() => setIsNewOpen(false)}
                  disabled={savingNew}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="catalog__btn catalog__btn--primary"
                  disabled={savingNew}
                >
                  {savingNew ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Оплата (уменьшение суммы) */}
      {payOpen && (
        <div className="catalog__overlay" onClick={() => setPayOpen(false)}>
          <div
            className="catalog__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-pay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="catalog__modalTitle" id="debt-pay-title">
              Оплатить (уменьшить долг)
            </div>

            {payErr && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: "8px 10px",
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                {payErr}
              </div>
            )}

            <form onSubmit={submitPay}>
              <input
                className="catalog__input"
                placeholder="Сумма оплаты (только цифры)"
                inputMode="numeric"
                pattern="\d*"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <div className="catalog__modalActions" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="catalog__btn"
                  onClick={() => setPayOpen(false)}
                  disabled={savingPay}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="catalog__btn catalog__btn--primary"
                  disabled={savingPay}
                >
                  {savingPay ? "Провожу…" : "Оплатить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Изменение долга */}
      {editOpen && (
        <div className="catalog__overlay" onClick={() => setEditOpen(false)}>
          <div
            className="catalog__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="catalog__modalTitle" id="debt-edit-title">
              Изменить долг
            </div>

            {editErr && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: "8px 10px",
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                {editErr}
              </div>
            )}

            <form onSubmit={submitEdit}>
              <input
                className="catalog__input"
                placeholder="Имя *"
                value={eFullName}
                onChange={(e) => setEFullName(e.target.value)}
                autoFocus
              />
              <input
                className="catalog__input"
                placeholder="Телефон * (только цифры)"
                inputMode="numeric"
                pattern="\d*"
                value={ePhone}
                onChange={(e) => setEPhone(e.target.value.replace(/\D/g, ""))}
              />
              <input
                className="catalog__input"
                placeholder="Сумма долга * (только цифры)"
                inputMode="numeric"
                pattern="\d*"
                value={eAmount}
                onChange={(e) => setEAmount(e.target.value.replace(/\D/g, ""))}
              />

              <div className="catalog__modalActions" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="catalog__btn"
                  onClick={() => setEditOpen(false)}
                  disabled={savingEdit}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="catalog__btn catalog__btn--primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Сохранение…" : "Сохранить изменения"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Debts;
