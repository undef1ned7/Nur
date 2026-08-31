import React from "react";
import { VIEW_MODES } from "../constants";
import "./WarehouseListSkeleton.scss";

const TABLE_ROWS = 8;
const CARD_ITEMS = 6;

const WarehouseTableSkeleton = () => (
  <div
    className="warehouse-list-skeleton warehouse-list-skeleton--table overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
    aria-hidden="true"
  >
    <table className="warehouse-table w-full min-w-[1100px]">
      <thead>
        <tr>
          {Array.from({ length: 9 }).map((_, index) => (
            <th key={index}>
              <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--sm" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: TABLE_ROWS }).map((_, rowIndex) => (
          <tr key={rowIndex} className="warehouse-list-skeleton__row">
            <td>
              <div className="warehouse-list-skeleton__box warehouse-list-skeleton__box--checkbox" />
            </td>
            <td>
              <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--xs" />
            </td>
            <td>
              <div className="warehouse-list-skeleton__name">
                <div className="warehouse-list-skeleton__box warehouse-list-skeleton__box--image" />
                <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--lg" />
              </div>
            </td>
            {Array.from({ length: 6 }).map((__, cellIndex) => (
              <td key={cellIndex}>
                <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--md" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const WarehouseCardsSkeleton = () => (
  <div
    className="warehouse-list-skeleton warehouse-list-skeleton--cards"
    aria-hidden="true"
  >
    <div className="warehouse-list-skeleton__cards-toolbar">
      <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--md" />
      <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--sm" />
    </div>
    <div className="warehouse-list-skeleton__cards-grid">
      {Array.from({ length: CARD_ITEMS }).map((_, index) => (
        <div key={index} className="warehouse-list-skeleton__card">
          <div className="warehouse-list-skeleton__box warehouse-list-skeleton__box--card-image" />
          <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--lg" />
          <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--md" />
          <div className="warehouse-list-skeleton__bar warehouse-list-skeleton__bar--sm" />
        </div>
      ))}
    </div>
  </div>
);

const WarehouseListSkeleton = ({ viewMode = VIEW_MODES.TABLE }) =>
  viewMode === VIEW_MODES.CARDS ? (
    <WarehouseCardsSkeleton />
  ) : (
    <WarehouseTableSkeleton />
  );

export default React.memo(WarehouseListSkeleton);
