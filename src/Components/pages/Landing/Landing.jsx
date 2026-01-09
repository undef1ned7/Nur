import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Lang from "../../Lang/Lang";
import logo from "../../Photo/logo2.png";
import "./Landing.scss";

const Landing = () => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Блокировка скролла при открытом меню
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Хелпер для массивов из t()
  const tArray = (key) => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? value : [];
  };

  const industries = tArray("industries.list");
  const pricingPlans = tArray("pricing.plans");

  return (
    <div className="landing">
      {/* ===== TOPBAR ===== */}
      <header className="landing__topbar" role="banner">
        <div className="landing__container">
          <div className="landing__topbar-row">
            <Link to="/" className="landing__logo" aria-label={t("hero.title")}>
              <img src={logo} alt="NUR CRM" className="landing__logo-img" />
            </Link>

            <nav className="landing__actions" aria-label="Авторизация">
              <Link
                to="/login"
                className="landing__btn landing__btn--secondary"
              >
                {t("header.login")}
              </Link>
              <Link
                to="/submit-application"
                className="landing__btn landing__btn--primary"
              >
                {t("header.submitApplication")}
              </Link>
              <div className="landing__lang">
                <Lang />
              </div>
            </nav>

            <button
              type="button"
              className={`landing__burger ${menuOpen ? "is-open" : ""}`}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="landing__burger-line" />
              <span className="landing__burger-line" />
              <span className="landing__burger-line" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== Off-canvas меню ===== */}
      <div
        className={`landing__offcanvas ${
          menuOpen ? "landing__offcanvas--open" : ""
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="landing__backdrop" onClick={() => setMenuOpen(false)} />
        <aside
          className="landing__panel"
          role="dialog"
          aria-label="Меню"
          aria-modal="true"
        >
          <button
            type="button"
            className="landing__close"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          >
            <span />
            <span />
          </button>

          <nav className="landing__panel-body">
            <Link
              to="/login"
              className="landing__btn landing__btn--secondary landing__btn--block"
              onClick={() => setMenuOpen(false)}
            >
              {t("header.login")}
            </Link>
            <Link
              to="/submit-application"
              className="landing__btn landing__btn--primary landing__btn--block"
              onClick={() => setMenuOpen(false)}
            >
              {t("header.submitApplication")}
            </Link>
            <div className="landing__lang landing__lang--block">
              <Lang />
            </div>
          </nav>
        </aside>
      </div>

      {/* ===== Основной контент ===== */}
      <main className="landing__main" id="main">
        {/* HERO */}
        <section className="landing__hero">
          <div className="landing__container">
            <div className="landing__hero-inner">
              <h1 className="landing__hero-title">{t("hero.title")}</h1>
              <p className="landing__hero-text">{t("hero.text")}</p>
              <div className="landing__hero-actions">
                <Link
                  to="/submit-application"
                  className="landing__btn landing__btn--primary"
                >
                  {t("hero.button")}
                </Link>
              </div>

              <ul className="landing__trust">
                {industries.map((item, idx) => (
                  <li key={idx} className="landing__trust-item">
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ОТРАСЛИ */}
        <section
          className="landing__section landing__section--industries"
          aria-label={t("industries.title")}
        >
          <div className="landing__container">
            <h2 className="landing__title">{t("industries.title")}</h2>
            <div
              className="landing__scroller"
              tabIndex="0"
              aria-label={t("industries.title")}
            >
              {industries.map((item, idx) => (
                <article className="landing__card" key={idx}>
                  <div className="landing__card-ico" aria-hidden="true">
                    <span className="landing__dot" />
                  </div>
                  <h3 className="landing__card-title">{item.name}</h3>
                  <p className="landing__card-text">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ТАРИФЫ */}
        <section
          className="landing__section landing__section--pricing"
          aria-label={t("pricing.title")}
        >
          <div className="landing__container">
            <h2 className="landing__title">{t("pricing.title")}</h2>
            <div className="landing__plans">
              {pricingPlans.map((plan, idx) => (
                <article
                  key={idx}
                  className={`landing__plan ${
                    idx === 1 ? "landing__plan--highlight" : ""
                  }`}
                >
                  {idx === 1 && (
                    <div className="landing__badge">
                      {t("pricing.highlightBadge")}
                    </div>
                  )}
                  <h3 className="landing__plan-name">{plan.name}</h3>
                  <p className="landing__plan-desc">{plan.desc}</p>
                  <div className="landing__price">{plan.price}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing__cta" aria-label={t("cta.title")}>
          <div className="landing__container">
            <div className="landing__cta-card">
              <h3 className="landing__cta-title">{t("cta.title")}</h3>
              <p className="landing__cta-text">{t("cta.text")}</p>
              <Link
                to="/submit-application"
                className="landing__btn landing__btn--primary"
              >
                {t("cta.button")}
              </Link>
            </div>
          </div>
        </section>

        {/* КОНТАКТЫ */}
        <section
          className="landing__section landing__section--contact"
          aria-label={t("contact.title")}
        >
          <div className="landing__container">
            <h2 className="landing__title">{t("contact.title")}</h2>
            <p className="landing__text">
              {t("contact.email")}:{" "}
              <a className="landing__link" href="mailto:support@nurcrm.com">
                support@nurcrm.com
              </a>
            </p>
            <p className="landing__text">
              {t("contact.phone")}:{" "}
              <a className="landing__link" href="tel:+996700123456">
                +996 700 123 456
              </a>
            </p>
            <p className="landing__text">
              {t("contact.telegram")}:{" "}
              <a
                className="landing__link"
                href="https://t.me/nurcrm"
                target="_blank"
                rel="noopener noreferrer"
              >
                @nurcrm
              </a>
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="landing__footer">
        <div className="landing__container">
          <p className="landing__footer-text">{t("footer.text")}</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
