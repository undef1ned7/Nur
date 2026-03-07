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
        <h3 className="building-page__cardTitle" style={{ padding: "16px 24px", margin: 0 }}>
          График рассрочки
        </h3>
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
