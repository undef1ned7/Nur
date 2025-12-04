import  { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./debts.scss";
import { useDispatch } from "react-redux";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../store/slices/cashSlice";

import {
  listFrom,
  extractApiErr,
  checkNotifications,
  inRange,
  getDebtAmount,
  phoneNorm,
  num,
} from "./helpers";

import { DebtsHeader } from "./components/DebtsHeader";
import { Notifications } from "./components/Notifications";
import { DebtsTable } from "./components/DebtsTable";
import { NewDebtModal } from "./components/NewDebtModal";
import { PayDebtModal } from "./components/PayDebtModal";
import { EditDebtModal } from "./components/EditDebtModal";

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

const Debts = () => {
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [notifications, setNotifications] = useState([]);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formErr, setFormErr] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [payErr, setPayErr] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [eFullName, setEFullName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eDueDate, setEDueDate] = useState("");
  const [editErr, setEditErr] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const { list: cashBoxes } = useCash();
  const [cashbox, setCashbox] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const dispatch = useDispatch();

  const load = async () => {
    try {
      setLoading(true);
      setLoadErr("");
      const data = await fetchDebtsAll();
      setItems(data);

      const newNotifications = checkNotifications(data);
      setNotifications(newNotifications);
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
    dispatch(getCashBoxes());
  }, []);

  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !cashbox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setCashbox(firstCashBoxId);
      }
    }
  }, [cashBoxes, cashbox]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = !s
      ? items
      : items.filter((x) => `${x.name} ${x.phone}`.toLowerCase().includes(s));

    arr = arr.filter((x) => getDebtAmount(x) > 0);

    if (dateFrom || dateTo) {
      arr = arr.filter((x) => inRange(x.created_at, dateFrom, dateTo));
    }
    return [...arr].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }, [items, q, dateFrom, dateTo]);

  const openNew = () => {
    setFullName("");
    setPhone("");
    setAmount("");
    setDueDate("");
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
        amount: String(a),
        due_date: dueDate || null,
      });
      setItems((p) => [created, ...p]);
      setIsNewOpen(false);

      const newNotifications = checkNotifications([created, ...items]);
      setNotifications(newNotifications);
    } catch (e2) {
      console.error(e2);
      setFormErr(extractApiErr(e2, "Не удалось создать долг"));
    } finally {
      setSavingNew(false);
    }
  };

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

    if (!cashbox)
      return setPayErr("Касса не выбрана. Создайте кассу в разделе «Кассы».");

    const baseDebt = getDebtAmount(current);
    const nextAmount = Math.max(0, baseDebt - amt);

    try {
      setSavingPay(true);
      const updated = await updateDebt(payId, { amount: String(nextAmount) });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));

      await dispatch(
        addCashFlows({
          name: current.name
            ? `Возврат долга: ${current.name}`
            : "Возврат долга",
          amount: String(amt),
          type: "income",
          cashbox,
        })
      ).unwrap();

      setPayOpen(false);
    } catch (e2) {
      console.error(e2);
      setPayErr(extractApiErr(e2, "Не удалось обновить сумму долга"));
    } finally {
      setSavingPay(false);
    }
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setEFullName(item.name || "");
    setEPhone(item.phone || "");
    setEAmount(String(item.amount ?? ""));
    setEDueDate(item.due_date || "");
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
        due_date: eDueDate || null,
      });
      const updatedItems = items.map((x) =>
        x.id === updated.id ? updated : x
      );
      setItems(updatedItems);
      setEditOpen(false);

      const newNotifications = checkNotifications(updatedItems);
      setNotifications(newNotifications);
    } catch (e2) {
      console.error(e2);
      setEditErr(extractApiErr(e2, "Не удалось сохранить изменения"));
    } finally {
      setSavingEdit(false);
    }
  };

  const askDelete = (id) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async (id) => {
    try {
      await deleteDebt(id);
      const updatedItems = items.filter((x) => x.id !== id);
      setItems(updatedItems);

      const newNotifications = checkNotifications(updatedItems);
      setNotifications(newNotifications);
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <section className="catalog">
      <DebtsHeader
        q={q}
        setQ={setQ}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onAddClick={openNew}
      />

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

      <Notifications notifications={notifications} />

      <DebtsTable
        loading={loading}
        items={filtered}
        confirmId={confirmId}
        onAskDelete={askDelete}
        onCancelDelete={cancelDelete}
        onDelete={doDelete}
        onOpenPay={openPay}
        onOpenEdit={openEdit}
      />

      <NewDebtModal
        open={isNewOpen}
        fullName={fullName}
        setFullName={setFullName}
        phone={phone}
        setPhone={setPhone}
        amount={amount}
        setAmount={setAmount}
        dueDate={dueDate}
        setDueDate={setDueDate}
        formErr={formErr}
        savingNew={savingNew}
        onClose={() => setIsNewOpen(false)}
        onSubmit={submitNew}
      />

      <PayDebtModal
        open={payOpen}
        payAmt={payAmt}
        setPayAmt={setPayAmt}
        payErr={payErr}
        savingPay={savingPay}
        onClose={() => setPayOpen(false)}
        onSubmit={submitPay}
      />

      <EditDebtModal
        open={editOpen}
        eFullName={eFullName}
        setEFullName={setEFullName}
        ePhone={ePhone}
        setEPhone={setEPhone}
        eAmount={eAmount}
        setEAmount={setEAmount}
        eDueDate={eDueDate}
        setEDueDate={setEDueDate}
        editErr={editErr}
        savingEdit={savingEdit}
        onClose={() => setEditOpen(false)}
        onSubmit={submitEdit}
      />
    </section>
  );
};

export default Debts;
