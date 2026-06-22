import { pdf } from "@react-pdf/renderer";
import { FileText, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAgentSaleInvoiceJson,
  getAgentSaleDetail,
  getAllProductionSaleDetail,
} from "../../../../api/agentSales";
import { useUser } from "../../../../store/slices/userSlice";
import Modal from "../../../common/Modal/Modal";
import ProductionInvoicePdfDocument from "./ProductionInvoicePdfDocument";

const kindTranslate = {
  new: "Новая",
  paid: "Оплачена",
  canceled: "Возвращена",
  debt: "Долг",
};

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateString);
  }
};

const getStatusVariant = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "paid";
  if (s === "canceled" || s === "cancelled") return "canceled";
  if (s === "debt") return "debt";
  return "new";
};

const getLineDiscount = (product) =>
  Number(
    product?.line_discount ??
      product?.line_discount_total ??
      product?.discount_amount ??
      product?.discount_total ??
      0,
  );

const getLineTotal = (product) => {
  const qty = Number(product?.quantity || 0);
  const unitPrice = Number(product?.unit_price || 0);
  const discount = getLineDiscount(product);
  const computed = qty * unitPrice - discount;
  const explicit = Number(product?.line_total);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Math.max(0, computed);
};

const ProductionSellDetail = ({
  onClose,
  id,
  onOpenRefund,
  useGlobalAccess = false,
}) => {
  const { company, profile } = useUser();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError("");
    setSale(null);
    setLoading(true);
    const loadSale = useGlobalAccess
      ? getAllProductionSaleDetail(id)
      : getAgentSaleDetail(id);
    loadSale
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
  }, [id, useGlobalAccess]);

  const handleDownloadInvoice = async () => {
    if (!id) return;
    setError("");
    setDownloadingInvoice(true);
    try {
      const invoiceData = await getAgentSaleInvoiceJson(id);
      if (!invoiceData) {
        throw new Error("Нет данных для генерации накладной");
      }

      const client = sale?.client || {};
      const userDisplayLooksLikeEmail =
        typeof sale?.user_display === "string" &&
        sale.user_display.includes("@");
      const saleItemsMap = {};
      if (Array.isArray(sale?.items)) {
        sale.items.forEach((si) => {
          if (si.id) saleItemsMap[si.id] = si;
        });
      }

      const mergedItems = Array.isArray(invoiceData?.items)
        ? invoiceData.items.map((item) => {
            const saleItem = saleItemsMap[item.id];
            return {
              ...item,
              line_discount:
                saleItem?.line_discount ?? item.line_discount ?? "0",
              quantity: item.qty ?? saleItem?.quantity ?? item.quantity ?? "1",
              line_total:
                item.total != null
                  ? Number(item.total)
                  : (saleItem?.line_total ??
                    Number(item.unit_price) * Number(item.qty || 1)),
            };
          })
        : [];

      const productionInvoiceData = {
        ...invoiceData,
        items: mergedItems,
        sale,
        seller: {
          ...invoiceData?.seller,
          address: invoiceData?.seller?.address || company?.address || null,
          phone: invoiceData?.seller?.phone || company?.phone || null,
          email: invoiceData?.seller?.email || company?.email || null,
          inn: invoiceData?.seller?.inn || company?.inn || null,
        },
        buyer: {
          ...invoiceData?.buyer,
          name:
            client?.full_name ||
            client?.name ||
            invoiceData?.buyer?.full_name ||
            invoiceData?.buyer?.name ||
            sale?.client_name ||
            "—",
          full_name:
            client?.full_name ||
            invoiceData?.buyer?.full_name ||
            invoiceData?.buyer?.name ||
            sale?.client_name ||
            "—",
          phone: client?.phone || invoiceData?.buyer?.phone || null,
          email: client?.email || invoiceData?.buyer?.email || null,
          address: client?.address || invoiceData?.buyer?.address || null,
          inn: client?.inn || invoiceData?.buyer?.inn || null,
          llc: client?.llc || invoiceData?.buyer?.llc || null,
          okpo: client?.okpo || invoiceData?.buyer?.okpo || null,
          bik: client?.bik || invoiceData?.buyer?.bik || null,
          score: client?.score || invoiceData?.buyer?.score || null,
        },
        agent: {
          full_name:
            sale?.salesperson_display ||
            profile?.full_name ||
            profile?.name ||
            "—",
          name:
            sale?.salesperson_display ||
            sale?.user_display ||
            profile?.full_name ||
            profile?.name ||
            "—",
          phone: sale?.salesperson_phone || profile?.phone || null,
          email:
            sale?.salesperson_email ||
            (userDisplayLooksLikeEmail ? sale.user_display : null) ||
            profile?.email ||
            null,
        },
      };

      const blob = await pdf(
        <ProductionInvoicePdfDocument data={productionInvoiceData} />,
      ).toBlob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice_${invoiceData?.document?.number || id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Не удалось скачать накладную";
      setError(msg);
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const statusVariant = getStatusVariant(sale?.status);
  const statusLabel = kindTranslate[sale?.status] || sale?.status || "—";
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const subtotal = Number(sale?.subtotal || 0);
  const discountTotal = Number(sale?.discount_total || 0);
  const taxTotal = Number(sale?.tax_total || 0);
  const total = Number(sale?.total || 0);
  const canReturn =
    sale && ["paid", "debt"].includes((sale.status || "").toLowerCase());

  return (
    <Modal
      open
      onClose={onClose}
      title="Детали продажи"
      className="sellDetailModal"
      contentClassName="sellDetailModal__content"
      wrapperId="production-sell-detail-modal"
    >
      <div className="sellDetail">
        {loading ? (
          <div className="sellDetail__loading">Загрузка данных о продаже...</div>
        ) : error && !sale ? (
          <div className="sellDetail__empty">{error}</div>
        ) : (
          <>
            {error && (
              <div className="sellReturn__error" role="alert">
                {error}
              </div>
            )}

            <div className="sellDetail__meta">
              <div className="sellDetail__metaCard">
                <span className="sellDetail__metaLabel">Клиент</span>
                <span className="sellDetail__metaValue">
                  {sale?.client_name || "Без клиента"}
                </span>
              </div>
              <div className="sellDetail__metaCard">
                <span className="sellDetail__metaLabel">Статус</span>
                <span className={`sellBadge sellBadge--${statusVariant}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="sellDetail__metaCard">
                <span className="sellDetail__metaLabel">Дата</span>
                <span className="sellDetail__metaValue">
                  {formatDateTime(sale?.created_at)}
                </span>
              </div>
            </div>

            <section className="sellDetail__section" aria-label="Позиции продажи">
              <h4 className="sellDetail__sectionTitle">
                Позиции
                <span className="sellDetail__sectionCount">{items.length}</span>
              </h4>

              {items.length === 0 ? (
                <div className="sellDetail__empty">Нет позиций в продаже</div>
              ) : (
                <div className="sellDetail__items">
                  <div className="sellDetail__itemsHead" aria-hidden>
                    <span>Товар</span>
                    <span>Кол-во</span>
                    <span>Цена</span>
                    <span>Сумма</span>
                  </div>
                  {items.map((product, idx) => {
                    const name =
                      product.product_name ?? product.name ?? "—";
                    const qty = Number(product.quantity || 0);
                    const unitPrice = Number(product.unit_price || 0);
                    const lineDiscount = getLineDiscount(product);
                    const lineTotal = getLineTotal(product);

                    return (
                      <div className="sellDetail__item" key={product.id ?? idx}>
                        <div className="sellDetail__itemName">
                          <span className="sellDetail__itemNo">{idx + 1}</span>
                          <span>{name}</span>
                        </div>
                        <div className="sellDetail__itemQty">
                          {qty.toLocaleString("ru-RU", {
                            maximumFractionDigits: 3,
                          })}
                        </div>
                        <div className="sellDetail__itemPrice">
                          {formatMoney(unitPrice)}
                        </div>
                        <div className="sellDetail__itemTotal">
                          <strong>{formatMoney(lineTotal)}</strong>
                          {lineDiscount > 0 && (
                            <span className="sellDetail__itemDiscount">
                              −{formatMoney(lineDiscount)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="sellDetail__totals" aria-label="Итоги продажи">
              {subtotal > 0 && (
                <div className="sellDetail__totalRow">
                  <span>Промежуточный итог</span>
                  <span>{formatMoney(subtotal)} сом</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="sellDetail__totalRow sellDetail__totalRow--discount">
                  <span>Скидка</span>
                  <span>−{formatMoney(discountTotal)} сом</span>
                </div>
              )}
              {taxTotal > 0 && (
                <div className="sellDetail__totalRow">
                  <span>Налог</span>
                  <span>{formatMoney(taxTotal)} сом</span>
                </div>
              )}
              <div className="sellDetail__totalRow sellDetail__totalRow--final">
                <span>Итого к оплате</span>
                <strong>{formatMoney(total)} сом</strong>
              </div>
            </section>

            <div
              className={`sellDetail__actions${canReturn ? " sellDetail__actions--withRefund" : ""}`}
            >
              <button
                type="button"
                className="sellDetail__actionBtn sellDetail__actionBtn--secondary"
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
              >
                <FileText size={18} strokeWidth={2.2} aria-hidden />
                {downloadingInvoice ? "Скачивание..." : "Скачать накладную"}
              </button>
              {canReturn && (
                <button
                  type="button"
                  className="sellDetail__actionBtn sellDetail__actionBtn--refund"
                  onClick={() => onOpenRefund?.(sale)}
                >
                  <RotateCcw size={18} strokeWidth={2.2} aria-hidden />
                  Оформить возврат
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ProductionSellDetail;
