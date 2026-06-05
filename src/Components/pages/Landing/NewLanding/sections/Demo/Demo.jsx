import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLandingIndustries } from "../../hooks/useLandingIndustries";
import { useSubmitApplicationForm } from "../../../../SubmitApplication/useSubmitApplicationForm";
import LandingImg from "../../components/LandingImg";
import "./Demo.scss";
import blur1 from "./img/blur1.svg";
import line from "./img/line.svg";

const Demo = () => {
  const { t } = useTranslation("newLanding");
  const { industries, loading: loadingIndustries } = useLandingIndustries();
  const [industryId, setIndustryId] = useState("");

  const { form, onChange, submit, sending, error, setError, ok } =
    useSubmitApplicationForm({
      onSuccess: () => setIndustryId(""),
    });

  const onFormSubmit = async (e) => {
    e.preventDefault();

    if (!industryId) {
      setError(t("demo.industryRequired"));
      return;
    }

    const industry = industries.find(
      (item) => String(item.id) === String(industryId),
    );

    await submit({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      text: industry
        ? t("demo.industryPrefix", { name: industry.name })
        : "",
    });
  };

  const displayError =
    error === "Ошибка при оставлении запроса" ? t("demo.submitError") : error;

  return (
    <section id="demo" className="demo">
      <div className="demo__container new-container">
        <LandingImg className="demo__blur" src={blur1} alt="" aria-hidden="true" />
        <LandingImg className="demo__blur2" src={blur1} alt="" aria-hidden="true" />
        <div className="demo__left">
          <LandingImg className="demo__line" src={line} alt="" aria-hidden="true" />
          <h1 className="demo__left__title">
            {t("demo.title")}{" "}
            <span className="demo-span">{t("demo.titleHighlight")}</span>{" "}
            {t("demo.titleSuffix")}
          </h1>
          <p className="demo__left__description">{t("demo.description")}</p>
        </div>
        <form className="demo__form" onSubmit={onFormSubmit} noValidate>
          <h2 className="demo__form__title">{t("demo.formTitle")}</h2>

          {ok && (
            <div
              className="demo__form__message demo__form__message--success"
              role="status"
            >
              {t("demo.success")}
            </div>
          )}

          {!!displayError && (
            <div
              className="demo__form__message demo__form__message--error"
              role="alert"
            >
              {displayError}
            </div>
          )}

          <input
            className="demo__form__inp"
            type="text"
            name="full_name"
            placeholder={t("demo.namePlaceholder")}
            value={form.full_name}
            onChange={onChange}
            required
          />
          <input
            className="demo__form__inp"
            type="tel"
            name="phone"
            placeholder={t("demo.phonePlaceholder")}
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
              {loadingIndustries
                ? t("demo.industryLoading")
                : t("demo.industryPlaceholder")}
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
            {sending ? t("demo.submitting") : t("demo.submit")}
          </button>
        </form>
      </div>
    </section>
  );
};

export default Demo;
