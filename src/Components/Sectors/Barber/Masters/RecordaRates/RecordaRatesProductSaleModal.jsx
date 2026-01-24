// RecordaRatesProductSaleModal.jsx
import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { RRSelect } from "./RecordaRatesSelect";
import { fmtInt, fmtMoney, toNum } from "./RecordaRates.utils";

const ProductSaleModal = ({
  open,
  onClose,
  employeeId,
  employeeName,
  employees,
  products,
  payouts,
  loading,
  error,
  saving,
  onCreate,
  periodLabel,
}) => {
  const [tab, setTab] = useState("list");
  const [form, setForm] = useState({
    employee: "",
    product: "",
    percent: "",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;

    setTab("list");
    setLocalError("");

    const defaultEmployee =
      String(employeeId || "") ||
      (employees.length ? String(employees[0].id) : "");

    const firstProduct = products && products.length ? products[0] : null;
    const defaultProductId = firstProduct ? String(firstProduct.id) : "";

    setForm({
      employee: defaultEmployee,
      product: defaultProductId,
      percent: "",
    });
  }, [open, employeeId, employees, products]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedProduct =
    products.find((p) => String(p.id) === String(form.product)) || null;
  const productPrice = selectedProduct ? Number(selectedProduct.price || 0) : 0;

  const percentNum = Math.min(
    100,
    Math.max(0, toNum(form.percent || 0) || 0)
  );
  const payoutPreview = Math.round((productPrice * percentNum) / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!form.product || !form.employee) {
      setLocalError("Выберите товар и сотрудника.");
      return;
    }
    if (!percentNum) {
      setLocalError("Укажите процент.");
      return;
    }
    if (!productPrice) {
      setLocalError("У выбранного товара не задана цена.");
      return;
    }

    try {
      await onCreate({
        employeeId: form.employee,
        productId: form.product,
        percent: percentNum,
        price: productPrice,
      });
      setForm((prev) => ({ ...prev, percent: "" }));
      setTab("list");
    } catch {
      setLocalError("Не удалось сохранить продажу товара.");
    }
  };

  return (
    <div
      className="barberrecordarates__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="barberrecordarates__modal" onClick={(e) => e.stopPropagation()}>
        <div className="barberrecordarates__modalHead">
          <h4 className="barberrecordarates__modalTitle">
            Товарные продажи — {periodLabel} — {employeeName}
          </h4>
          <button
            type="button"
            className="barberrecordarates__iconBtn"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="barberrecordarates__productTabs">
          <button
            type="button"
            className={`barberrecordarates__productTab ${
              tab === "list" ? "barberrecordarates__productTab--active" : ""
            }`}
            onClick={() => setTab("list")}
          >
            Список
          </button>
          <button
            type="button"
            className={`barberrecordarates__productTab ${
              tab === "sale" ? "barberrecordarates__productTab--active" : ""
            }`}
            onClick={() => setTab("sale")}
          >
            Продажа
          </button>
        </div>

        {(error || localError) && (
          <div className="barberrecordarates__alert">
            {localError || error}
          </div>
        )}

        {tab === "list" ? (
          <div className="barberrecordarates__tableWrap barberrecordarates__tableWrap--modal">
            <table className="barberrecordarates__table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Товар</th>
                  <th>Сотрудник</th>
                  <th>Цена</th>
                  <th>Процент</th>
                  <th>К выплате</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="barberrecordarates__muted" colSpan={6}>
                      Загрузка…
                    </td>
                  </tr>
                ) : payouts.length === 0 ? (
                  <tr>
                    <td className="barberrecordarates__muted" colSpan={6}>
                      Нет продаж по товарам.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.dateFormatted}</td>
                      <td>{p.product_name}</td>
                      <td>{p.employee_name}</td>
                      <td>{fmtMoney(p.price)}</td>
                      <td>{`${p.percent}%`}</td>
                      <td>
                        <b>{fmtMoney(p.payout_amount)}</b>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <form
            className="barberrecordarates__productForm"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            <div className="barberrecordarates__productRow">
              <div className="barberrecordarates__productField">
                <span className="barberrecordarates__productLabel">Товар</span>
                <RRSelect
                  value={form.product}
                  onChange={(val) => handleChange("product", val)}
                  options={
                    products.length
                      ? products.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} — ${fmtMoney(p.price)}`,
                        }))
                      : [{ value: "", label: "Нет товаров" }]
                  }
                  placeholder="Выберите товар"
                />
              </div>

              <div className="barberrecordarates__productField">
                <span className="barberrecordarates__productLabel">Сотрудник</span>
                <RRSelect
                  value={form.employee}
                  onChange={(val) => handleChange("employee", val)}
                  options={employees.map((e) => ({
                    value: String(e.id),
                    label: e.name,
                  }))}
                  placeholder="Сотрудник"
                />
              </div>
            </div>

            <div className="barberrecordarates__productRow">
              <div className="barberrecordarates__productField">
                <span className="barberrecordarates__productLabel">Процент %</span>
                <input
                  className="barberrecordarates__productInput"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.percent}
                  onChange={(e) => handleChange("percent", e.target.value)}
                  placeholder="0-100"
                  required
                />
              </div>

              <div className="barberrecordarates__productField">
                <span className="barberrecordarates__productLabel">
                  Сумма сотруднику
                </span>
                <input
                  className="barberrecordarates__productInput"
                  type="text"
                  value={payoutPreview ? fmtInt(payoutPreview) : 0}
                  readOnly
                  disabled
                />
              </div>
            </div>

            <div className="barberrecordarates__productFooter">
              <button
                type="submit"
                className="barberrecordarates__btn barberrecordarates__btn--primary"
                disabled={saving || loading}
              >
                {saving ? "Сохранение…" : "Сохранить продажу"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProductSaleModal;
