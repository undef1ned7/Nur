import { useState } from "react";
import { X } from "lucide-react";
import barcodeImage from "../../barcode (2).gif";

const SellModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isTabSelected, setIsTabSelected] = useState(true);

  const tabs = [
    {
      label: "Сканировать",
      content: (
        <div className="scan" onClick={() => setActiveTab(null)}>
          <div className="scan__content">
            <img src={barcodeImage} alt="" />
          </div>
        </div>
      ),
      option: "scan",
    },
    {
      label: "Вручную",
      content: (
        <>
          <form>
            <input
              type="text"
              placeholder="штрих код"
              className="add-modal__input"
            />
          </form>
        </>
      ),
      option: "manually",
    },
  ];

  const products = [
    { id: 1, name: "Товар1", amount: 2, price: 75 },
    { id: 2, name: "Товар2", amount: 2, price: 75 },
    { id: 3, name: "Товар3", amount: 2, price: 75 },
  ];

  const handleTabClick = (index) => {
    setActiveTab(index);
    setIsTabSelected(true);
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа товара</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {tabs.map((tab, index) => {
          return (
            <button
              key={index}
              className={`add-modal__button  ${
                activeTab === index && isTabSelected
                  ? "add-modal__button-active"
                  : ""
              }`}
              onClick={() => handleTabClick(index)}
            >
              {tab.label}
            </button>
          );
        })}
        {isTabSelected && activeTab !== null && (
          <div className="add-modal__container">{tabs[activeTab].content}</div>
        )}

        {products.length !== 0 && (
          <div className="receipt">
            <h2 className="receipt__title">Приход</h2>
            {products.map((product) => (
              <div className="receipt__item" key={product.id}>
                <p className="receipt__item-name">
                  {product.id}. {product.name}
                </p>
                <p className="receipt__item-price">
                  {product.amount} x {product.price} ≡{" "}
                  {product.amount * product.price}
                </p>
              </div>
            ))}
            <div className="receipt__total">
              <b>ИТОГО</b>
              <b>
                ≡{" "}
                {products
                  .reduce((acc, rec) => {
                    return acc + rec.amount * rec.price;
                  }, 0)
                  .toFixed(2)}
              </b>
            </div>
            <div className="receipt__row">
              <button className="receipt__row-btn">Печать чека</button>
              <button className="receipt__row-btn">Без чека</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellModal;
