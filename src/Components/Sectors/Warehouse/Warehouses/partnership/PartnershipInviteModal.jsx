import { useEffect, useMemo, useState } from "react";
import { Send, X } from "lucide-react";
import { searchPartnershipCompanies } from "../../../../../api/warehousePartnership";
import {
  INVITE_MIN_SEARCH_LENGTH,
  INVITE_STATUS_LABEL,
  extractPartnershipError,
  resolveInviteStatus,
} from "./partnershipHelpers";

/**
 * Поиск компании и отправка заявки на партнёрство.
 * Свою компанию, текущих партнёров и компании с открытой заявкой
 * показываем без кнопки «Отправить».
 */
const PartnershipInviteModal = ({
  ownCompanyId,
  partnerIds,
  outgoingPendingIds,
  incomingPendingIds,
  busy,
  onInvite,
  onClose,
}) => {
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = search.trim();
  const canSearch = query.length >= INVITE_MIN_SEARCH_LENGTH;
  const tooShort = query.length > 0 && !canSearch;

  useEffect(() => {
    if (!canSearch) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const list = await searchPartnershipCompanies(query);
        if (!cancelled) setResults(list);
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          setError(extractPartnershipError(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canSearch]);

  // Короткий запрос — выдачу и ошибку прошлого поиска не показываем
  const visibleError = canSearch ? error : "";

  const rows = useMemo(
    () =>
      (canSearch ? results : []).map((c) => ({
        company: c,
        status: resolveInviteStatus(c, {
          ownCompanyId,
          partnerIds,
          outgoingPendingIds,
          incomingPendingIds,
        }),
      })),
    [canSearch, results, ownCompanyId, partnerIds, outgoingPendingIds, incomingPendingIds],
  );

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <div className="warehouse-filter-overlay" onClick={close} role="presentation">
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Заявка на партнёрство"
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Заявка на партнёрство</h3>
          <button
            type="button"
            className="warehouse-filter-modal__close"
            onClick={close}
            disabled={busy}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        <div className="warehouse-filter-modal__content">
          <div className="warehouse-partnership-hint warehouse-partnership-hint--warning">
            Партнёр получит доступ к вашим складам, остаткам, кассам, аналитике
            и истории продаж (историю можно скрыть в настройках партнёра).
            Приглашайте только компании, которым доверяете.
          </div>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label" htmlFor="partnership-invite-search">
              Поиск компании
            </label>
            <input
              id="partnership-invite-search"
              className="warehouse-filter-modal__select"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={busy}
              placeholder={`Минимум ${INVITE_MIN_SEARCH_LENGTH} символа названия`}
              autoFocus
            />
            {tooShort && (
              <p className="warehouse-filter-modal__subtitle">
                Введите минимум {INVITE_MIN_SEARCH_LENGTH} символа
              </p>
            )}
            {canSearch && loading && <p className="warehouse-filter-modal__subtitle">Поиск…</p>}
            {visibleError && (
              <div className="warehouse-partnership-error">{visibleError}</div>
            )}
            {!loading && !visibleError && canSearch && rows.length === 0 && (
              <p className="warehouse-filter-modal__subtitle">Ничего не найдено</p>
            )}
            <ul className="warehouse-partnership-search-list">
              {rows.map(({ company, status }) => (
                <li key={company.id}>
                  <span>{company.name}</span>
                  {status ? (
                    <span className="warehouse-partnership-muted">
                      {INVITE_STATUS_LABEL[status] || status}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="warehouse-partnership-btn warehouse-partnership-btn--approve"
                      onClick={() => onInvite(company, note.trim())}
                      disabled={busy}
                    >
                      <Send size={14} /> Отправить
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label" htmlFor="partnership-invite-note">
              Примечание
            </label>
            <input
              id="partnership-invite-note"
              className="warehouse-filter-modal__select"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={512}
              disabled={busy}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnershipInviteModal;
