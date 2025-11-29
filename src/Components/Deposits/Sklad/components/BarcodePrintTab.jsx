import { useMemo, useState } from "react";
import "./BarcodePrintTab.scss";

/**
 * Компонент таба для печати штрих-кодов
 */
const BarcodePrintTab = ({ products, loading, searchTerm, onSearchChange }) => {
  const [printingIds, setPrintingIds] = useState(new Set());

  // Фильтрация товаров по поиску
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const search = searchTerm?.trim().toLowerCase() || "";
    if (!search) return products;
    return products.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      return name.includes(search) || barcode.includes(search);
    });
  }, [products, searchTerm]);

  // Функция печати штрих-кода
  const handlePrintBarcode = async (product) => {
    if (!product.barcode) {
      alert("У товара отсутствует штрих-код");
      return;
    }

    setPrintingIds((prev) => new Set(prev).add(product.id));

    try {
      // Создаем окно для печати
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Пожалуйста, разрешите всплывающие окна для печати");
        setPrintingIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
        return;
      }

      // Генерируем HTML для печати штрих-кода
      const barcodeHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Штрих-код: ${product.name}</title>
            <style>
              @media print {
                @page {
                  size: 50mm 30mm;
                  margin: 5mm;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
              }
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 10px;
                text-align: center;
              }
              .barcode-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
              }
              .barcode-value {
                font-size: 14px;
                font-weight: bold;
                letter-spacing: 2px;
              }
              .product-name {
                font-size: 10px;
                max-width: 200px;
                word-wrap: break-word;
              }
              .barcode-image {
                margin: 5px 0;
              }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          </head>
          <body>
            <div class="barcode-container">
              <div class="product-name">${product.name || "Товар"}</div>
              <svg id="barcode" class="barcode-image"></svg>
              <div class="barcode-value">${product.barcode}</div>
            </div>
            <script>
              JsBarcode("#barcode", "${product.barcode}", {
                format: "CODE128",
                width: 2,
                height: 50,
                displayValue: false
              });
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(barcodeHtml);
      printWindow.document.close();
    } catch (error) {
      console.error("Ошибка при печати штрих-кода:", error);
      alert("Не удалось распечатать штрих-код");
    } finally {
      setPrintingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="barcode-print-tab">
        <div className="barcode-print-tab__loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="barcode-print-tab">
      <div className="barcode-print-tab__header">
        <div className="barcode-print-tab__search-wrapper">
          <input
            type="text"
            placeholder="Поиск по названию или штрих-коду"
            value={searchTerm || ""}
            onChange={onSearchChange}
            className="barcode-print-tab__search"
          />
        </div>
      </div>

      <div className="barcode-print-tab__content">
        {filteredProducts.length === 0 ? (
          <div className="barcode-print-tab__empty">
            <div className="barcode-print-tab__empty-icon">📦</div>
            <div className="barcode-print-tab__empty-text">
              Товары не найдены
            </div>
          </div>
        ) : (
          <div className="barcode-print-tab__grid">
            {filteredProducts.map((product) => (
              <div key={product.id} className="barcode-print-tab__card">
                <div className="barcode-print-tab__card-header">
                  <div className="barcode-print-tab__barcode-label">
                    Штрих-код:
                  </div>
                  <div className="barcode-print-tab__barcode-value">
                    {product.barcode || "—"}
                  </div>
                </div>
                <div className="barcode-print-tab__card-body">
                  <button
                    className="barcode-print-tab__print-btn"
                    onClick={() => handlePrintBarcode(product)}
                    disabled={printingIds.has(product.id) || !product.barcode}
                    title={
                      !product.barcode
                        ? "У товара отсутствует штрих-код"
                        : "Распечатать штрих-код"
                    }
                  >
                    {printingIds.has(product.id) ? (
                      <>
                        <span className="barcode-print-tab__spinner"></span>
                        Печать...
                      </>
                    ) : (
                      <>
                        <span className="barcode-print-tab__print-icon">
                          🖨️
                        </span>
                        Распечатать штрих-код
                      </>
                    )}
                  </button>
                  <div className="barcode-print-tab__product-name">
                    {product.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodePrintTab;
