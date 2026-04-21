import { pdf } from "@react-pdf/renderer";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAgentSaleInvoiceJson,
  getAgentSaleDetail,
  getAllProductionSaleDetail,
} from "../../../../api/agentSales";
import { useUser } from "../../../../store/slices/userSlice";
import ProductionInvoicePdfDocument from "./ProductionInvoicePdfDocument";

const kindTranslate = {
  new: "Новая",
  paid: "Оплачена",
  canceled: "Возвращена",
  debt: "Долг",
};

const ProductionSellDetail = ({
  onClose,
  id,
  onReturnSuccess,
  onOpenRefund,
  useGlobalAccess = false,
}) => {
  const { company, profile } = useUser();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [error, setError] = useState("");
  const formatMoney = (value) => Number(value || 0).toFixed(2);
  const itemsDiscountTotal = Array.isArray(sale?.items)
    ? sale.items.reduce(
        (sum, item) =>
          sum +
          Number(
            item?.line_discount ??
              item?.discount_total ??
              item?.line_discount_total ??
              0,
          ),
        0,
      )
    : 0;
  const discountTotal = Number(sale?.discount_total ?? itemsDiscountTotal ?? 0);
  const taxTotal = Number(sale?.tax_total || 0);
  const subtotal = Number(sale?.subtotal || 0);
  const total = Number(sale?.total || 0);
  const hasDiscount = discountTotal > 0;
  const hasTax = taxTotal > 0;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError("");
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
      console.log("=== invoiceData ===", JSON.stringify(invoiceData, null, 2));
      console.log("=== sale ===", JSON.stringify(sale, null, 2));
      if (!invoiceData) {
        throw new Error("Нет данных для генерации накладной");
      }

      const client = sale?.client || {};
      const userDisplayLooksLikeEmail =
        typeof sale?.user_display === "string" &&
        sale.user_display.includes("@");
      // Build a lookup map from sale.items by id for discount data
      const saleItemsMap = {};
      if (Array.isArray(sale?.items)) {
        sale.items.forEach((si) => {
          if (si.id) saleItemsMap[si.id] = si;
        });
      }

      // Merge discount fields from sale.items into invoiceData.items
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

  const canReturn =
    sale && ["paid", "debt"].includes((sale.status || "").toLowerCase());

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
                      {(() => {
                        const qty = Number(product.quantity || 0);
                        const unitPrice = Number(product.unit_price || 0);
                        const lineDiscount = Number(
                          product.line_discount ??
                            product.discount_total ??
                            product.line_discount_total ??
                            0,
                        );
                        const lineBase = qty * unitPrice;
                        const lineTotal = Math.max(0, lineBase - lineDiscount);
                        return (
                          <p className="receipt__item-price">
                            {qty} × {unitPrice.toFixed(2)} ={" "}
                            {lineTotal.toFixed(2)} сом
                          </p>
                        );
                      })()}
                      {Number(
                        product.line_discount ??
                          product.discount_total ??
                          product.line_discount_total ??
                          0,
                      ) > 0 && (
                        <p className="receipt__item-price">
                          Скидка по позиции:{" "}
                          {formatMoney(
                            product.line_discount ??
                              product.discount_total ??
                              product.line_discount_total ??
                              0,
                          )}{" "}
                          сом
                        </p>
                      )}
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
                    {subtotal > 0 && <p>Подытог {formatMoney(subtotal)}</p>}
                    {hasDiscount && <p>Скидка {formatMoney(discountTotal)}</p>}
                    {hasTax && <p>Налог {formatMoney(taxTotal)}</p>}
                    <b>{formatMoney(total)} сом</b>
                  </div>
                </div>

                <div
                  className="receipt__row"
                  style={{ display: "flex", justifyContent: "center", gap: 12 }}
                >
                  <button
                    type="button"
                    className="receipt__row-btn"
                    onClick={handleDownloadInvoice}
                    disabled={downloadingInvoice}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      minWidth: 170,
                    }}
                  >
                    <Download size={16} />
                    {downloadingInvoice ? "Скачивание..." : "Накладная"}
                  </button>
                  {canReturn && (
                    <button
                      type="button"
                      className="receipt__row-btn"
                      onClick={() => onOpenRefund?.(sale)}
                      style={{ minWidth: 170 }}
                    >
                      Возврат
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
