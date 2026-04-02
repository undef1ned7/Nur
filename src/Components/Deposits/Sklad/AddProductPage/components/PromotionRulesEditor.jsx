import React from "react";

const MAX_TIERS = 30;

/**
 * Галочка «Акционный товар» (stock) и ступени скидки (promotion_rules_input).
 */
const PromotionRulesEditor = ({
  stock,
  onStockChange,
  tiers,
  onTiersChange,
  errorText,
  compact,
}) => {
  const addTier = () => {
    if (tiers.length >= MAX_TIERS) return;
    onTiersChange([
      ...tiers,
      {
        id: Date.now(),
        position: tiers.length,
        min_amount: "",
        discount_percent: "",
        promo_quantity: "",
      },
    ]);
  };

  const removeTier = (id) => {
    onTiersChange(tiers.filter((t) => t.id !== id));
  };

  const updateTier = (id, field, value) => {
    onTiersChange(
      tiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  };

  const wrap = compact ? "promotion-rules-editor promotion-rules-editor--compact" : "promotion-rules-editor";

  return (
    <div className={wrap}>
      <div className="promotion-rules-editor__checkbox-row">
        <label className="promotion-rules-editor__checkbox">
          <input
            type="checkbox"
            checked={Boolean(stock)}
            onChange={(e) => onStockChange(e.target.checked)}
          />
          <span>Акционный товар</span>
        </label>
        <p className="promotion-rules-editor__hint">
          Скидка по ступеням от суммы строки в чеке (цена × количество). Если
          включено — укажите хотя бы одну ступень.
        </p>
      </div>

      {stock && (
        <div className="promotion-rules-editor__table-wrap">
          <div className="promotion-rules-editor__head">
            <span>Ступени скидки (до {MAX_TIERS})</span>
            <button
              type="button"
              className="promotion-rules-editor__add-btn"
              onClick={addTier}
              disabled={tiers.length >= MAX_TIERS}
            >
              + Ступень
            </button>
          </div>
          {tiers.length === 0 && (
            <p className="promotion-rules-editor__empty">
              Нет ступеней — нажмите «+ Ступень» или включите акцию заново.
            </p>
          )}
          {tiers.length > 0 && (
            <div className="promotion-rules-editor__table">
              <div className="promotion-rules-editor__row promotion-rules-editor__row--header">
                <span>#</span>
                <span>Сумма строки от (сом)</span>
                <span>Скидка %</span>
                <span>Лимит шт. (необяз.)</span>
                <span />
              </div>
              {tiers.map((tier, index) => (
                <div key={tier.id} className="promotion-rules-editor__row">
                  <span className="promotion-rules-editor__idx">{index + 1}</span>
                  <input
                    type="text"
                    className="promotion-rules-editor__input"
                    placeholder="0"
                    value={tier.min_amount}
                    onChange={(e) =>
                      updateTier(tier.id, "min_amount", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className="promotion-rules-editor__input"
                    placeholder="0.01–100"
                    value={tier.discount_percent}
                    onChange={(e) =>
                      updateTier(tier.id, "discount_percent", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className="promotion-rules-editor__input"
                    placeholder="без лимита"
                    value={tier.promo_quantity}
                    onChange={(e) =>
                      updateTier(tier.id, "promo_quantity", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="promotion-rules-editor__remove"
                    onClick={() => removeTier(tier.id)}
                    title="Удалить ступень"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {errorText && (
            <p className="add-product-page__error promotion-rules-editor__error">
              {errorText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(PromotionRulesEditor);
