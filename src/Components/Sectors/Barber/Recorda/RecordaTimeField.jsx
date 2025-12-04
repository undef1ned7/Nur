// RecordaTimeField.jsx
import React from "react";
import "./Recorda.scss";
import { OPEN_HOUR, CLOSE_HOUR, pad } from "./RecordaUtils";

const RecordaTimeField = ({ value, onChange, invalid }) => {
  const [h, m] = (value || `${pad(OPEN_HOUR)}:00`)
    .split(":")
    .map((v) => parseInt(v || 0, 10));

  const hours = Array.from(
    { length: CLOSE_HOUR - OPEN_HOUR + 1 },
    (_, i) => OPEN_HOUR + i
  );
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const setHM = (H, M) => {
    let hh = Math.min(Math.max(H, OPEN_HOUR), CLOSE_HOUR);
    let mm = Math.min(Math.max(M, 0), 59);
    if (hh === CLOSE_HOUR) mm = 0;
    onChange(`${pad(hh)}:${pad(mm)}`);
  };

  return (
    <div className={`br-time ${invalid ? "is-invalid-input" : ""}`}>
      <select
        className="br-time__h"
        value={pad(h || OPEN_HOUR)}
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
        value={pad(h === CLOSE_HOUR ? 0 : Number.isNaN(m) ? 0 : m)}
        onChange={(e) =>
          setHM(h || OPEN_HOUR, parseInt(e.target.value, 10))
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
