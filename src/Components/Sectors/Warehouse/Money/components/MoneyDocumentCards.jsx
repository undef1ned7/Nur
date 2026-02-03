import React, { useMemo } from "react";
import { Check, X } from "lucide-react";
import "./MoneyDocumentCards.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) + " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("ru-RU");
};

const statusLabel = (s) =>
  s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—";

const MoneyDocumentCard = React.memo(
  ({ doc, rowNumber, onPost, onUnpost, postingId }) => {
    const isDraft = doc.status === "DRAFT";
    const isBusy = postingId === doc.id;

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
          <div className="money-document-card__amount">{fmtMoney(doc.amount)}</div>
          <span
            className={`money-document-card__status money-document-card__status--${doc.status === "POSTED" ? "posted" : "draft"}`}
          >
            {statusLabel(doc.status)}
          </span>
          <div className="money-document-card__actions" onClick={(e) => e.stopPropagation()}>
            {isDraft ? (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--post"
                onClick={() => onPost(doc)}
                disabled={isBusy}
                title="Провести документ"
              >
                <Check size={16} />
                {isBusy ? "…" : "Провести"}
              </button>
            ) : (
              <button
                type="button"
                className="money-document-card__btn money-document-card__btn--unpost"
                onClick={() => onUnpost(doc)}
                disabled={isBusy}
                title="Отменить проведение"
              >
                <X size={16} />
                {isBusy ? "…" : "Отменить"}
              </button>
            )}
          </div>
        </div>
        {doc.comment && (
          <div className="money-document-card__comment">{doc.comment}</div>
        )}
      </div>
    );
  }
);

MoneyDocumentCard.displayName = "MoneyDocumentCard";

const MoneyDocumentCards = ({
  documents,
  loading,
  getRowNumber,
  onPost,
  onUnpost,
  postingId,
}) => {
  const documentsData = useMemo(
    () =>
      documents.map((doc, index) => ({
        doc,
        rowNumber: getRowNumber(index, documents.length),
      })),
    [documents, getRowNumber]
  );

  if (loading && documents.length === 0) {
    return (
      <div className="money-document-cards__loading">
        Загрузка...
      </div>
    );
  }

  if (documents.length === 0 && !loading) {
    return (
      <div className="money-document-cards__empty">
        Нет документов
      </div>
    );
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
            postingId={postingId}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(MoneyDocumentCards);
