import { useState } from "react";
import { useLandingIndustries } from "../../hooks/useLandingIndustries";
import LandingImg from "../../components/LandingImg";
import "./Demo.scss";
import blur1 from "./img/blur1.svg";
import line from "./img/line.svg";

const Demo = () => {
  const { industries, loading: loadingIndustries } = useLandingIndustries();
  const [industryId, setIndustryId] = useState("");

  return (
    <section id="demo" className="demo">
      <div className="demo__container new-container">
        <LandingImg className="demo__blur" src={blur1} alt="" aria-hidden="true" />
        <LandingImg className="demo__blur2" src={blur1} alt="" aria-hidden="true" />
        <div className="demo__left">
          <LandingImg className="demo__line" src={line} alt="" aria-hidden="true" />
          <h1 className="demo__left__title">
            Получите демо <span className="demo-span">NurCRM</span> под ваш
            бизнес
          </h1>
          <p className="demo__left__description">
            Оставьте заявку — мы свяжемся с вами, покажем систему и подберем
            решение под вашу сферу.
          </p>
        </div>
        <form className="demo__form">
          <h2 className="demo__form__title">Оставьте заявку</h2>
          <input
            className="demo__form__inp"
            type="text"
            placeholder="Введите ваше имя"
          />
          <input
            className="demo__form__inp"
            type="tel"
            placeholder="Номер телефона"
          />
          <select
            className="demo__form__inp"
            value={industryId}
            onChange={(e) => setIndustryId(e.target.value)}
            disabled={loadingIndustries}
          >
            <option value="" disabled>
              {loadingIndustries ? "Загрузка сфер…" : "Выберите сферу"}
            </option>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name}
              </option>
            ))}
          </select>
          <button type="submit" className="demo__form__btn">
            Оставить заявку
          </button>
        </form>
      </div>
    </section>
  );
};

export default Demo;
