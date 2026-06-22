import React from "react";

export default function PagePlaceholder({ title, subtitle }) {
  return (
    <div className="building-page">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">{title}</h1>
          <p className="building-page__subtitle">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
