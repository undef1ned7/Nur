import { useTranslation } from "react-i18next";
import LandingImg from "../../components/LandingImg";
import { getTranslationArray } from "../../utils/getTranslationArray";
import "./UnitedBusiness.scss";
import blur from "../../assets/banner/blur.svg";

const UnitedBusiness = () => {
  const { t } = useTranslation("newLanding");
  const features = getTranslationArray(t, "unitedBusiness.features");

  return (
    <section id="features" className="unibusiness">
      <div className="unibusiness__container new-container">
        <LandingImg className="unibusiness__blur" src={blur} alt="" aria-hidden="true" />
        <h1 className="unibusiness__title">
          {t("unitedBusiness.title")}{" "}
          <span className="unibusiness__title-span">
            {t("unitedBusiness.titleHighlight")}
          </span>{" "}
          {t("unitedBusiness.titleSuffix")}
        </h1>
        <p className="unibusiness__description">
          {t("unitedBusiness.description")}
        </p>

        <div className="unibusiness__carts">
          {features.map((feature) => (
              <div key={feature.title} className="col-3 unibusiness__cart">
                <h3 className="unibusiness__cart__title">{feature.title}</h3>
                <p className="unibusiness__cart__description">
                  {feature.description}
                </p>
                <div className="unibusiness__cart__line"></div>
              </div>
            ))}
        </div>
        <p className="unibusiness__enddescription">
          {t("unitedBusiness.footer")}
        </p>
      </div>
    </section>
  );
};
export default UnitedBusiness;
