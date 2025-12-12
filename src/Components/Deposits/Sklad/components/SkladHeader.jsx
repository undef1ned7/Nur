import { Plus, Package, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Компонент заголовка склада с иконкой и кнопками
 */
const SkladHeader = ({
  isBuildingCompany,
  isMarketCompany,
  onShowReceiveModal,
  onShowHistoryModal,
  selectCashBox,
  onSelectCashBox,
  cashBoxes,
  onAdd,
  onSendToScales,
}) => {
  const navigate = useNavigate();

  return (
    <div className="sklad-new">
      <div className="sklad-new__header-row">
        <div className="sklad-new__title-section">
          <div className="sklad-new__icon">
            <Package size={24} />
          </div>
          <div>
            <h1 className="sklad-new__title">Склад</h1>
            <p className="sklad-new__subtitle">
              Управление товарами и запасами
            </p>
          </div>
        </div>

        {/* Кнопки действий справа */}
        <div className="sklad-new__actions">
          {isMarketCompany && (
            <button
              className="sklad-new__export-btn"
              onClick={onSendToScales}
              title="Отправить выбранные товары на весы"
            >
              <Scale size={18} />
              Отправка на весы
            </button>
          )}
          <button
            className="sklad-new__add-btn"
            onClick={() => navigate("/crm/sklad/add-product")}
          >
            <Plus size={18} />
            Добавить товар
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkladHeader;
