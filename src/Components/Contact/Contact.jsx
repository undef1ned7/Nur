import React, { useState } from "react";
import Suppliers from "./Suppliers/Suppliers";
import ContactClient from "./ContactClient/ContactClient";
import Implementers from "./Implementers/Implementers";

const Contact = () => {
  const [activeTab, setActiveTab] = useState(1);
  const tabs = [
    {
      label: "Поставщики",
      content: <Suppliers />,
    },
    {
      label: "Клиенты",
      content: <ContactClient />,
    },
    {
      label: "Реализаторы",
      content: <Implementers />,
    },
  ];
  return (
    <section>
      <div className="vitrina__header" style={{ margin: "15px 0" }}>
        <div className="vitrina__tabs">
          {tabs.map((tab, index) => {
            return (
              <span
                className={`vitrina__tab ${
                  index === activeTab && "vitrina__tab--active"
                }`}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </span>
              // <button onClick={() => setActiveTab(index)}>{tab.label}</button>
            );
          })}
        </div>
      </div>
      <div>{tabs[activeTab].content}</div>
    </section>
  );
};

export default Contact;
