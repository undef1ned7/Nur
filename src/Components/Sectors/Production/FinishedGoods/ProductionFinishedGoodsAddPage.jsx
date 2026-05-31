import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getCashBoxes, useCash } from "../../../../store/slices/cashSlice";
import FinishedGoodsAddModal from "./FinishedGoodsAddModal";
import "./ProductionFinishedGoodsAddPage.scss";

const ProductionFinishedGoodsAddPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const [selectCashBox, setSelectCashBox] = useState("");

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  useEffect(() => {
    if (cashBoxes?.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const goBack = () => navigate("/crm/production/warehouse");

  return (
    <div className="prod-goods-page">
      <div className="prod-goods-page__header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="prod-goods-page__back" onClick={goBack}>
            <ArrowLeft size={16} />
            Назад
          </button>
          <div className="prod-goods-page__title-section">
            <div className="prod-goods-page__icon">
              <Plus size={24} />
            </div>
            <div>
              <h1 className="prod-goods-page__title">Добавление товара</h1>
              <p className="prod-goods-page__subtitle">
                Производство — готовая продукция
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="prod-goods-page__content !p-0">
        <FinishedGoodsAddModal
          isPage
          selectCashBox={selectCashBox}
          onClose={goBack}
          onSaveSuccess={goBack}
        />
      </div>
    </div>
  );
};

export default ProductionFinishedGoodsAddPage;
