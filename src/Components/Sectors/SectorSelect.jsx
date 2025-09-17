import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import s from "./SectorSelect.module.scss";
import { setSector, resetSector } from "../../store/slices/sectorSlice";

const OPTIONS = [
  { id: "barber", title: "Барбершоп", desc: "Запись, услуги, мастера" },
  { id: "hostel", title: "Гостиница", desc: "Комнаты, заезды, гости" },
  { id: "school", title: "Школа", desc: "Ученики, группы, уроки" },
];

export default function SectorSelect() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [sector, setSectorLocal] = useState(
    localStorage.getItem("selectedSector") || ""
  );

  useEffect(() => {
    if (sector) localStorage.setItem("selectedSector", sector);
  }, [sector]);

  const handleSelect = (id) => {
    setSectorLocal(id);
  };

  const handleContinue = () => {
    if (!sector) return;

    dispatch(setSector(sector));

    navigate(`/crm/${sector}`);
  };

  const handleReset = () => {
    dispatch(resetSector());
    setSectorLocal("");
    localStorage.removeItem("selectedSector");
  };

  return (
    <div className={s.wrapper}>
      <h2>Выбор отрасли</h2>
      <p>Выберите сферу — и в меню появятся соответствующие разделы.</p>

      <div className={s.grid}>
        {OPTIONS.map((o) => (
          <div
            key={o.id}
            className={`${s.card} ${sector === o.id ? s.current : ""}`}
            onClick={() => handleSelect(o.id)}
          >
            <h3>{o.title}</h3>
            <p>{o.desc}</p>
          </div>
        ))}
      </div>

      <div className={s.actions}>
        <button className={s.btn} onClick={handleReset}>
          Сбросить
        </button>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleContinue}>
          Продолжить
        </button>
      </div>
    </div>
  );
}
