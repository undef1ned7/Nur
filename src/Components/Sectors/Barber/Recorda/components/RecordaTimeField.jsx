// RecordaTimeField.jsx
import React, { useMemo } from "react";
import "../Recorda.scss";
import { defaultWorkBounds, minsOf, pad } from "./RecordaUtils";

const RecordaTimeField = ({ value, onChange, invalid, workBounds }) => {
  const bounds = workBounds || defaultWorkBounds();
  const startMin = bounds.startMin;
  const endMin = bounds.endMin;
  const endHour = Math.floor(endMin / 60);
  const endMinute = endMin % 60;

  const [h, m] = (value || bounds.work_start || "09:00")
    .split(":")
    .map((v) => parseInt(v || 0, 10));

  const hours = useMemo(() => {
    const list = [];
    for (let hour = Math.floor(startMin / 60); hour <= endHour; hour += 1) {
      list.push(hour);
    }
    return list;
  }, [startMin, endHour]);

  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const setHM = (H, M) => {
    let hh = H;
    let mm = M;
    const total = hh * 60 + mm;

    if (total < startMin) {
      hh = Math.floor(startMin / 60);
      mm = startMin % 60;
    } else if (total > endMin) {
      hh = endHour;
      mm = endMinute;
    }

    onChange(`${pad(hh)}:${pad(mm)}`);
  };

  return (
    <div className={`br-time ${invalid ? "is-invalid-input" : ""}`}>
      <select
        className="br-time__h"
        value={pad(h || Math.floor(startMin / 60))}
        onChange={(e) => setHM(parseInt(e.target.value, 10), m || 0)}
      >
        {hours.map((H) => (
          <option key={H} value={pad(H)}>
            {pad(H)}
          </option>
        ))}
      </select>
      <span className="br-time__sep">:</span>
      <select
        className="br-time__m"
        value={pad(
          minsOf(`${pad(h)}:${pad(m)}`) >= endMin && h === endHour
            ? endMinute
            : Number.isNaN(m)
            ? 0
            : m,
        )}
        onChange={(e) =>
          setHM(h || Math.floor(startMin / 60), parseInt(e.target.value, 10))
        }
      >
        {minutes.map((M) => (
          <option key={M} value={pad(M)}>
            {pad(M)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RecordaTimeField;
