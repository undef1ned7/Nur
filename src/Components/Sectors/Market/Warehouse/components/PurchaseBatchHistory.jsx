import React, { useState } from "react";
import { History } from "lucide-react";
import PurchaseBatchTable from "./PurchaseBatchTable";
import PurchaseBatchHistoryModal from "./PurchaseBatchHistoryModal";
import ReceiptDetailModal from "./ReceiptDetailModal";

const PREVIEW_LIMIT = 50;

const PurchaseBatchHistory = ({ productId, productName, batches = [] }) => {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [receiptSeed, setReceiptSeed] = useState(null);

  const previewBatches = Array.isArray(batches) ? batches : [];
  const hasPreview = previewBatches.length > 0;

  const handleReceiptClick = (batch) => {
    if (!batch?.receipt_id) return;
    setReceiptSeed({
      id: batch.receipt_id,
      receipt_id: batch.receipt_id,
      supplier_name: batch.supplier_name,
      created_at: batch.created_at,
      created_by_name: batch.created_by_name,
    });
  };

  return (
    <div className="product-detail__section purchase-batch-history">
      <div className="purchase-batch-history__head">
        <h3 className="product-detail__section-title">История закупок</h3>
        {productId && (
          <button
            type="button"
            className="purchase-batch-history__all-btn"
            onClick={() => setHistoryModalOpen(true)}
          >
            <History size={16} />
            Вся история
          </button>
        )}
      </div>

      <p className="purchase-batch-history__hint">
        Каждое оприходование от поставщика сохраняется отдельной партией. Цена
        закупки в карточке — по последней партии.
      </p>

      <PurchaseBatchTable
        batches={previewBatches}
        emptyMessage="Партии появятся после оприходования от поставщика"
        onReceiptClick={handleReceiptClick}
      />

      {hasPreview && previewBatches.length >= PREVIEW_LIMIT && (
        <p className="purchase-batch-history__footnote">
          Показаны последние {PREVIEW_LIMIT} партий. Откройте «Вся историю» для
          полного списка.
        </p>
      )}

      <PurchaseBatchHistoryModal
        open={historyModalOpen}
        productId={productId}
        productName={productName}
        onClose={() => setHistoryModalOpen(false)}
      />

      {receiptSeed && (
        <ReceiptDetailModal
          receiptSeed={receiptSeed}
          onClose={() => setReceiptSeed(null)}
        />
      )}
    </div>
  );
};

export default PurchaseBatchHistory;
