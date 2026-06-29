import React, { useMemo } from "react";
import { Check, X, Printer, Pencil, Trash2, Ban } from "lucide-react";
import "./MoneyDocumentCards.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

/** 02.04.2026:00:35:20 */
const fmtDate = (v) => {
  if (v == null || v === "") return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}:${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const statusLabel = (s) =>
  s === "POSTED"
    ? "Проведён"
    : s === "DRAFT"
      ? "Черновик"
      : s === "REJECTED"
        ? "Отказан"
        : (s ?? "—");

const MoneyDocumentCard = React.memo(
  ({
    doc,
    rowNumber,
    onPost,
    onUnpost,
    onReject,
    onEdit,
    onDelete,
    onPrintKo1,
    postingId,
    printingId,
  }) => {
    const isDraft = doc.status === "DRAFT";
    const isRejected = doc.status === "REJECTED";
    const canEditDelete = isDraft || isRejected;
    const isBusy = postingId === doc.id;
    const isPrinting = printingId === doc.id;

    return (
      <div className="money-document-card">
        <div className="money-document-card__top">
          <div className="money-document-card__main">
            <div className="money-document-card__number">
              №{rowNumber} · {doc.number ?? "—"}
            </div>
            <div className="money-document-card__date">
              {fmtDate(doc.date ?? doc.created_at)}
            </div>
            <div className="money-document-card__counterparty">
              {doc.counterparty_display_name ?? "—"}
            </div>
            <div className="money-document-card__category">
              {doc.payment_category_title ?? "—"}
            </div>
          </div>
        </div>
        <div className="money-document-card__bottom">
          <div className="money-document-card__amount">
            {fmtMoney(doc.amount)}
          </div>
          <span
            className={`money-document-card__status money-document-card__status--${doc.status === "POSTED" ? "posted" : "draft"}`}
          >
            {statusLabel(doc.status)}
          </span>
          <div
            className="money-document-card__actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="money-document-card__btn money-document-card__btn--print"
              onClick={() => onPrintKo1(doc)}
              disabled={isPrinting}
              title="Печать КО-1"
              aria-label="Печать КО-1"
            >
              <Printer size={16} />
            </button>
            {isDraft && (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--post"
                onClick={() => onPost(doc)}
                disabled={isBusy}
                title="Провести документ"
                aria-label="Провести документ"
              >
                <Check size={16} />
              </button>
            )}
            {!isDraft && !isRejected && (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--unpost"
                onClick={() => onUnpost(doc)}
                disabled={isBusy}
                title="Отменить проведение"
                aria-label="Отменить проведение"
              >
                <X size={16} />
              </button>
            )}
            {!isDraft && !isRejected && onReject && (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--reject"
                onClick={() => onReject(doc)}
                disabled={isBusy}
                title="Отказать"
                aria-label="Отказать"
              >
                <Ban size={16} />
              </button>
            )}
            {canEditDelete && onEdit && (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--edit"
                onClick={() => onEdit(doc)}
                disabled={isBusy}
                title="Редактировать"
                aria-label="Редактировать"
              >
                <Pencil size={16} />
              </button>
            )}
            {canEditDelete && onDelete && (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--delete"
                onClick={() => onDelete(doc)}
                disabled={isBusy}
                title="Удалить"
                aria-label="Удалить"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        {doc.comment && (
          <div className="money-document-card__comment">{doc.comment}</div>
        )}
      </div>
    );
  },
);

MoneyDocumentCard.displayName = "MoneyDocumentCard";

const MoneyDocumentCards = ({
  documents,
  loading,
  getRowNumber,
  onPost,
  onUnpost,
  onReject,
  onEdit,
  onDelete,
  onPrintKo1,
  postingId,
  printingId,
}) => {
  const documentsData = useMemo(
    () =>
      documents.map((doc, index) => ({
        doc,
        rowNumber: getRowNumber(index, documents.length),
      })),
    [documents, getRowNumber],
  );

  if (loading && documents.length === 0) {
    return <div className="money-document-cards__loading">Загрузка...</div>;
  }

  if (documents.length === 0 && !loading) {
    return <div className="money-document-cards__empty">Нет документов</div>;
  }

  return (
    <div className="money-document-cards">
      {loading && documents.length > 0 && (
        <div className="money-document-cards__overlay">
          <span>Загрузка...</span>
        </div>
      )}
      <div className="money-document-cards__grid">
        {documentsData.map(({ doc, rowNumber }) => (
          <MoneyDocumentCard
            key={doc.id}
            doc={doc}
            rowNumber={rowNumber}
            onPost={onPost}
            onUnpost={onUnpost}
            onReject={onReject}
            onEdit={onEdit}
            onDelete={onDelete}
            onPrintKo1={onPrintKo1}
            postingId={postingId}
            printingId={printingId}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(MoneyDocumentCards);
