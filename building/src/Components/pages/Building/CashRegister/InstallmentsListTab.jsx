import React, { useState } from "react";
import Modal from "@/Components/common/Modal/Modal";
import { asCurrency } from "../shared/constants";
import InstallmentPaymentsModal from "../Treaty/InstallmentPaymentsModal";
import InstallmentPaymentCreateModal from "../Treaty/InstallmentPaymentCreateModal";

const STATUS_LABELS = {
  planned: "Запланирован",
  paid: "Оплачен",
};

/**
 * Вкладка «Список рассрочки» на странице договора (касса).
 * Отображает таблицу взносов и открывает модалки просмотра/создания платежей.
 */
export default function InstallmentsListTab({ treaty, onPaymentSuccess }) {
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [createPaymentModalOpen, setCreatePaymentModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);

  const installments = Array.isArray(treaty?.installments)
    ? treaty.installments
    : [];

  const openPayments = (installment) => {
    setSelectedInstallment(installment);
    setPaymentsModalOpen(true);
  };

  const openCreatePayment = (installment) => {
    setSelectedInstallment(installment);
    setCreatePaymentModalOpen(true);
  };

  const handleClosePayments = () => {
    setPaymentsModalOpen(false);
    setSelectedInstallment(null);
  };

  const handleCloseCreatePayment = () => {
    setCreatePaymentModalOpen(false);
    setSelectedInstallment(null);
  };

  const handleDownloadPdf = () => {
    if (installments.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) {
      return;
    }
    const title = treaty?.title || treaty?.number || "Договор";
    const amountTotal = treaty?.amount ?? "";
    const clientName = treaty?.client_display || treaty?.client_name || "—";
    const rows = installments.map((it, idx) => {
      const total = Number(it.amount || 0);
      const paid = Number(it.paid_amount || 0);
      const remain = Number.isFinite(total - paid) ? Math.max(0, total - paid) : 0;
      const status = it.status ?? (remain <= 0 ? "paid" : "planned");
      const statusLabel = status === "paid" ? "Оплачен" : "Запланирован";
      const statusClass = status === "paid" ? "status-paid" : "status-planned";
      return `
      <tr>
        <td>${it.order ?? idx + 1}</td>
        <td>${it.due_date || "—"}</td>
        <td>${Number(it.amount || 0).toFixed(2)}</td>
        <td>${Number(it.paid_amount || 0).toFixed(2)}</td>
        <td>${remain.toFixed(2)}</td>
        <td class="${statusClass}">${statusLabel}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>График рассрочки - ${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .info { margin-top: 8px; color: #374151; font-size: 14px; }
    h2 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 13px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    .status-paid { color: #166534; font-weight: 500; }
    .status-planned { color: #92400e; font-weight: 500; }
  </style>
</head>
<body>
  <h1>График рассрочки по договору</h1>
  <div class="info">Наименование: <b>${title}</b></div>
  <div class="info">Клиент: <b>${clientName}</b></div>
  <div class="info">Сумма договора: <b>${amountTotal}</b></div>
  <h2>Платежи (оплачено и остатки)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Дата платежа</th>
        <th>Сумма</th>
        <th>Оплачено</th>
        <th>Остаток</th>
        <th>Статус</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!treaty) {
    return (
      <div className="building-page__muted" style={{ padding: 24 }}>
        Нет данных о договоре.
      </div>
    );
  }

  if (installments.length === 0) {
    return (
      <div className="building-page__card" style={{ padding: 24 }}>
        <h3 className="building-page__cardTitle" style={{ marginBottom: 16 }}>
          График рассрочки
        </h3>
        <div className="building-page__muted">
          По этому договору нет графика рассрочки.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="building-page__card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 24px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h3 className="building-page__cardTitle" style={{ margin: 0 }}>
            График рассрочки
          </h3>
          <button
            type="button"
            className="building-btn"
            onClick={handleDownloadPdf}
          >
            Скачать PDF
          </button>
        </div>
        <div className="warehouse-table-container w-full">
          <table className="warehouse-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Дата платежа</th>
                <th>Сумма</th>
                <th>Оплачено</th>
                <th>Остаток</th>
                <th>Статус</th>
                <th style={{ width: 200 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((it, idx) => {
                const total = Number(it.amount || 0);
                const paid = Number(it.paid_amount || 0);
                const remain = Number.isFinite(total - paid)
                  ? Math.max(0, total - paid)
                  : 0;
                const status = it.status ?? (remain <= 0 ? "paid" : "planned");
                const isPaid = status === "paid";
                return (
                  <tr key={it.id ?? it.uuid ?? idx}>
                    <td>{it.order ?? idx + 1}</td>
                    <td>{it.due_date || "—"}</td>
                    <td>{asCurrency(it.amount)}</td>
                    <td>{asCurrency(it.paid_amount)}</td>
                    <td>{remain.toFixed(2)}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          backgroundColor: isPaid ? "#dcfce7" : "#fef3c7",
                          color: isPaid ? "#166534" : "#92400e",
                        }}
                      >
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </td>
                    <td>
                      {!isPaid && remain > 0 ? (
                        <button
                          type="button"
                          className="building-btn building-btn--primary"
                          style={{ marginRight: 8 }}
                          onClick={() => openCreatePayment(it)}
                        >
                          Оплатить
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="building-btn"
                        onClick={() => openPayments(it)}
                      >
                        Платежи
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <InstallmentPaymentsModal
        open={paymentsModalOpen}
        onClose={handleClosePayments}
        installment={selectedInstallment}
        treaty={treaty}
      />

      <InstallmentPaymentCreateModal
        open={createPaymentModalOpen}
        onClose={handleCloseCreatePayment}
        installment={selectedInstallment}
        treaty={treaty}
        onSuccess={() => {
          handleCloseCreatePayment();
          onPaymentSuccess?.();
        }}
      />
    </>
  );
}
