import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal/Modal";
import api from "../../../../../api";
import Pagination from "./Pagination";
import PurchaseBatchTable from "./PurchaseBatchTable";
import ReceiptDetailModal from "./ReceiptDetailModal";
import { formatBatchMoney } from "./purchaseBatchUtils";

const DEFAULT_LIMIT = 20;

const parseListResponse = (response) => {
  const data = response?.data;
  const results = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  const count = Number(data?.count) || results.length;
  const meta =
    data?.meta && typeof data.meta === "object" ? data.meta : {};
  const totalAmount =
    meta.total_amount != null && meta.total_amount !== ""
      ? meta.total_amount
      : null;

  return {
    results,
    count,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    totalAmount,
  };
};

const PurchaseBatchHistoryModal = ({ open, productId, productName, onClose }) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batches, setBatches] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [totalAmount, setTotalAmount] = useState(null);
  const [receiptSeed, setReceiptSeed] = useState(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / limit)),
    [count, limit],
  );

  const handleClose = () => {
    setPage(1);
    setError("");
    onClose?.();
  };

  const loadBatches = useCallback(async () => {
    if (!productId) return;
    try {
      setLoading(true);
      setError("");
      const { data: response } = await api.get(
        `/main/products/${encodeURIComponent(String(productId))}/purchase-batches/`,
        { params: { page, limit } },
      );
      const parsed = parseListResponse({ data: response });
      setBatches(parsed.results);
      setCount(parsed.count);
      setNext(parsed.next);
      setPrevious(parsed.previous);
      setTotalAmount(parsed.totalAmount);
    } catch (err) {
      console.error("Ошибка загрузки истории партий:", err);
      setBatches([]);
      setCount(0);
      setNext(null);
      setPrevious(null);
      setTotalAmount(null);
      setError("Не удалось загрузить историю закупок.");
    } finally {
      setLoading(false);
    }
  }, [productId, page, limit]);

  useEffect(() => {
    if (!open || !productId) return;
    void loadBatches();
  }, [open, productId, loadBatches]);

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

  const title = productName
    ? `История закупок: ${productName}`
    : "История закупок";

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={title}
        className="purchase-batch-history-modal"
        contentClassName="purchase-batch-history-modal__content"
      >
        {totalAmount != null && (
          <div className="purchase-batch-history__summary">
            Сумма всех партий:{" "}
            <strong>{formatBatchMoney(totalAmount)}</strong>
          </div>
        )}

        {error ? (
          <div className="purchase-batch-history__error">{error}</div>
        ) : null}

        <PurchaseBatchTable
          batches={batches}
          loading={loading}
          emptyMessage="Партии закупок не найдены"
          onReceiptClick={handleReceiptClick}
        />

        {!loading && !error && totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            count={count}
            countLabel="партий"
            loading={loading}
            hasNextPage={Boolean(next)}
            hasPrevPage={Boolean(previous)}
            onPageChange={setPage}
          />
        )}
      </Modal>

      {receiptSeed && (
        <ReceiptDetailModal
          receiptSeed={receiptSeed}
          onClose={() => setReceiptSeed(null)}
        />
      )}
    </>
  );
};

export default PurchaseBatchHistoryModal;
