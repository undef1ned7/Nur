import { useState } from "react";
import { useLandingIndustries } from "../../hooks/useLandingIndustries";
import { useSubmitApplicationForm } from "../../../../SubmitApplication/useSubmitApplicationForm";
import LandingImg from "../../components/LandingImg";
import "./Demo.scss";
import blur1 from "./img/blur1.svg";
import line from "./img/line.svg";

const Demo = () => {
  const { industries, loading: loadingIndustries } = useLandingIndustries();
  const [industryId, setIndustryId] = useState("");

  const { form, onChange, submit, sending, error, setError, ok } =
    useSubmitApplicationForm({
      onSuccess: () => setIndustryId(""),
    });

  const onFormSubmit = async (e) => {
    e.preventDefault();

    if (!industryId) {
      setError("Выберите сферу");
      return;
    }

    const industry = industries.find(
      (item) => String(item.id) === String(industryId),
    );

    await submit({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      text: industry ? `Сфера: ${industry.name}` : "",
    });
  };

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
        <form className="demo__form" onSubmit={onFormSubmit} noValidate>
          <h2 className="demo__form__title">Оставьте заявку</h2>

          {ok && (
            <div
              className="demo__form__message demo__form__message--success"
              role="status"
            >
              Заявка успешно отправлена
            </div>
          )}

          {!!error && (
            <div
              className="demo__form__message demo__form__message--error"
              role="alert"
            >
              {error}
            </div>
          )}

          <input
            className="demo__form__inp"
            type="text"
            name="full_name"
            placeholder="Введите ваше имя"
            value={form.full_name}
            onChange={onChange}
            required
          />
          <input
            className="demo__form__inp"
            type="tel"
            name="phone"
            placeholder="Номер телефона"
            value={form.phone}
            onChange={onChange}
            inputMode="tel"
            maxLength={20}
            required
          />
          <select
            className="demo__form__inp"
            value={industryId}
            onChange={(e) => setIndustryId(e.target.value)}
            disabled={loadingIndustries}
            required
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
          <button
            type="submit"
            className="demo__form__btn"
            disabled={sending}
          >
            {sending ? "Отправка..." : "Оставить заявку"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default Demo;
