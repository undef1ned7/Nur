import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getAgentSaleDetail, agentSaleReturn } from "../../../../api/agentSales";

const kindTranslate = {
  new: "Новая",
  paid: "Оплачена",
  canceled: "Возвращена",
  debt: "Долг",
};

const ProductionSellDetail = ({ onClose, id, onReturnSuccess }) => {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError("");
    getAgentSaleDetail(id)
      .then((data) => {
        if (!cancelled) setSale(data);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg =
            err?.response?.data?.detail ||
            err?.message ||
            "Не удалось загрузить продажу";
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleReturn = async () => {
    if (!id || !sale) return;
    const status = (sale.status || "").toLowerCase();
    if (status !== "paid" && status !== "debt") {
      setError("Возврат возможен только для оплаченных или долговых продаж.");
      return;
    }
    if (!window.confirm("Выполнить возврат? Статус продажи станет «Возвращена».")) return;
    setError("");
    setReturning(true);
    try {
      await agentSaleReturn(id);
      onReturnSuccess?.();
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Не удалось выполнить возврат";
      setError(msg);
    } finally {
      setReturning(false);
    }
  };

  const canReturn = sale && ["paid", "debt"].includes((sale.status || "").toLowerCase());

  return (
    <div className="sellDetail add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ width: "700px" }}>
        <div className="add-modal__header">
          <h3>Детали продажи</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="sellDetail__content">
          {loading && <p>Загрузка...</p>}
          {error && (
            <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>
          )}
          {!loading && sale && (
            <>
              <div className="sell__box">
                <p className="receipt__title">
                  Клиент: {sale.client_name ?? "—"}
                </p>
                <p className="receipt__title">
                  Статус: {kindTranslate[sale.status] || sale.status}
                </p>
                <p className="receipt__title">
                  Дата:{" "}
                  {sale.created_at
                    ? new Date(sale.created_at).toLocaleString("ru-RU")
                    : "—"}
                </p>
              </div>

              <div className="receipt">
                {(sale.items || []).map((product, idx) => (
                  <div className="receipt__item" key={idx}>
                    <p className="receipt__item-name">
                      {idx + 1}. {product.product_name ?? product.name ?? "—"}
                    </p>
                    <div>
                      <p className="receipt__item-price">
                        {product.quantity} × {product.unit_price} ={" "}
                        {(
                          Number(product.quantity || 0) *
                          Number(product.unit_price || 0)
                        ).toFixed(2)}{" "}
                        сом
                      </p>
                    </div>
                  </div>
                ))}

                <div className="receipt__total">
                  <b>ИТОГО</b>
                  <div
                    style={{
                      gap: "10px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {sale.discount_total != null && (
                      <p>Скидка {Number(sale.discount_total).toFixed(2)}</p>
                    )}
                    {sale.tax_total != null && (
                      <p>Налог {Number(sale.tax_total).toFixed(2)}</p>
                    )}
                    <b>{Number(sale.total || 0).toFixed(2)} сом</b>
                  </div>
                </div>

                <div className="receipt__row">
                  {canReturn && (
                    <button
                      type="button"
                      className="receipt__row-btn"
                      onClick={handleReturn}
                      disabled={returning}
                    >
                      {returning ? "Возврат..." : "Возврат"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionSellDetail;
