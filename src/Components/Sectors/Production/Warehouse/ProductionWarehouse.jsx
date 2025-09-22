import React, { useState } from "react";
import FinishedGoods from "../FinishedGoods/FinishedGoods";
import RawMaterialsWarehouse from "../RawMaterialsWarehouse/RawMaterialsWarehouse";

const ProductionWarehouse = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: "Склад готовой продукции",
      content: <FinishedGoods />,
    },
    {
      label: "Склад сырья",
      content: <RawMaterialsWarehouse />,
    },
  ];

  return (
    <section className="warehouseP sklad">
      <div className="vitrina__header" style={{ margin: "15px 0" }}>
        <div className="vitrina__tabs">
          {tabs.map((tab, index) => {
            return (
              <span
                key={index}
                className={`vitrina__tab ${
                  index === activeTab && "vitrina__tab--active"
                }`}
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </span>
            );
          })}
        </div>
      </div>
      <>{tabs[activeTab].content}</>
    </section>
  );
};

export default ProductionWarehouse;
