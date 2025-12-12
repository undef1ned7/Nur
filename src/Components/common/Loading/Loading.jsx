import React from "react";
import "./Loading.scss";

const Loading = ({ message = "Загрузка..." }) => {
  return (
    <div className="loading">
      <div className="loading__spinner"></div>
      <p className="loading__message">{message}</p>
    </div>
  );
};

export default Loading;
