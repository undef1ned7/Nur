import { useUser } from "../../../../store/slices/userSlice";
import { isOwnerOrAdmin } from "../Warehouses/partnership/partnershipHelpers";

/**
 * Партнёрство (обмен товаром, инкассация, аналитика партнёров) — только
 * владелец и админ. Бэк обязан проверять то же самое (docs/warehouse/stock-partnership.md, П1).
 */
const PartnerAnalyticsOwnerGate = ({ children }) => {
  const { profile } = useUser();

  if (!isOwnerOrAdmin(profile)) {
    return (
      <div className="warehouse-analytics">
        <div className="warehouse-analytics__error">
          Раздел партнёрства доступен только владельцу и администратору.
        </div>
      </div>
    );
  }

  return children;
};

export default PartnerAnalyticsOwnerGate;
