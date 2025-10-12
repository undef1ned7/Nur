import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { historySellProductDetail } from "../../../store/creators/saleThunk";
import { useSale } from "../../../store/slices/saleSlice";
import "./sell.scss";
const SellDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { historyDetail: item } = useSale();
  // console.log(1, item);

  useEffect(() => {
    dispatch(historySellProductDetail(id));
  }, [id, dispatch]);

  return (
    <div className="sellDetail">
      <h2 className="sellDetail__title">{item?.user_display}</h2>
      <div className="sellDetail__items">
        {item?.items.map((product, idx) => (
          <div className="receipt__item">
            <p className="receipt__item-name">
              {idx + 1}. {product.product_name}
            </p>
            {product?.barcode_snapshot?.length > 0 && (
              <p>Штрих код: {product.barcode_snapshot}</p>
            )}
            <p className="receipt__item-price">
              {product.quantity} x {product.unit_price} ≡ {product.line_total}
            </p>
          </div>
        ))}
      </div>
      <p>Цена: {item?.total}</p>
    </div>
  );
};

export default SellDetail;
