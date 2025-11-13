import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Lang from "../../Lang/Lang";
import logo from "../../Photo/logo2.png";
import "./Landing.scss";

const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Блокируем скролл фона, когда открыт off-canvas
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  return (
    <div className="landing">
      {/* ===== TOPBAR ===== */}
      <header className="landing__topbar" role="banner">
        <div className="landing__container">
          <div className="landing__topbar-row">
            <Link to="/" className="landing__logo" aria-label="Главная">
              <img src={logo} alt="NUR CRM" className="landing__logo-img" />
            </Link>

            {/* Desktop-набор действий (на md- скрывается) */}
            <nav className="landing__actions" aria-label="Авторизация">
              <Link to="/login" className="landing__btn landing__btn--secondary">Вход</Link>
              <Link to="/submit-application" className="landing__btn landing__btn--primary">Оставить заявку</Link>
              <div className="landing__lang"><Lang /></div>
            </nav>

            {/* Бургер — ВСЕГДА справа */}
            <button
              type="button"
              className={`landing__burger ${menuOpen ? "is-open" : ""}`}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(s => !s)}
            >
              <span className="landing__burger-line" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== Off-canvas меню (mobile) ===== */}
      <div className={`landing__offcanvas ${menuOpen ? "landing__offcanvas--open" : ""}`} aria-hidden={!menuOpen}>
        <div className="landing__backdrop" onClick={() => setMenuOpen(false)} aria-hidden />
        <aside className="landing__panel" role="dialog" aria-label="Меню" aria-modal="true">
          <button type="button" className="landing__close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}>
            <span />
          </button>

          <nav className="landing__panel-body">
            <Link
              to="/login"
              className="landing__btn landing__btn--secondary landing__btn--block"
              onClick={() => setMenuOpen(false)}
            >
              Вход
            </Link>
            <Link
              to="/submit-application"
              className="landing__btn landing__btn--primary landing__btn--block"
              onClick={() => setMenuOpen(false)}
            >
              Оставить заявку
            </Link>
            <div className="landing__lang landing__lang--block">
              <Lang />
            </div>
          </nav>
        </aside>
      </div>

      {/* ===== Секции ===== */}
      <main className="landing__main" id="main">
        {/* HERO */}
        <section className="landing__hero" aria-label="Введение">
          <div className="landing__container">
            <div className="landing__hero-inner">
              <h1 className="landing__hero-title">Сила управления в&nbsp;ваших руках</h1>
              <p className="landing__hero-text">
                Премиум-платформа для бизнеса: единый стек для кафе, строй-сферы, маркетов,
                барбершопов/салонов красоты, школ и гостиниц — красиво, быстро, надёжно.
              </p>
              <div className="landing__hero-actions">
                <Link to="/submit-application" className="landing__btn landing__btn--primary">Попробовать</Link>
              </div>

              <ul className="landing__trust">
                <li className="landing__trust-item">Кафе</li>
                <li className="landing__trust-item">Строй-сфера</li>
                <li className="landing__trust-item">Маркет</li>
                <li className="landing__trust-item">Барбершоп / Салон</li>
                <li className="landing__trust-item">Школа</li>
                <li className="landing__trust-item">Гостиница</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ОТРАСЛИ */}
        <section className="landing__section landing__section--industries" aria-label="Отрасли">
          <div className="landing__container">
            <h2 className="landing__title">Отрасли</h2>

            <div className="landing__scroller" tabIndex="0" aria-label="Список отраслей">
              {[
                { t: "Кафе", d: "Столы, заказы, кухня/KDS, быстрые оплаты." },
                { t: "Строй-сфера", d: "Сметы, заявки, объекты, материалы, акты." },
                { t: "Маркет", d: "Товары, остатки, штрих-коды, касса, скидки." },
                { t: "Барбершоп/Салон", d: "Записи, мастера, услуги, клиентская база." },
                { t: "Школа", d: "Лиды, группы, расписания, счета, рассрочки." },
                { t: "Гостиница", d: "Номера, брони, заселение/выезд, отчёты." }
              ].map((i, idx) => (
                <article className="landing__card" key={idx}>
                  <div className="landing__card-ico" aria-hidden><span className="landing__dot" /></div>
                  <h3 className="landing__card-title">{i.t}</h3>
                  <p className="landing__card-text">{i.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ТАРИФЫ */}
        <section className="landing__section landing__section--pricing" aria-label="Тарифы">
          <div className="landing__container">
            <h2 className="landing__title">Тарифы</h2>

            <div className="landing__plans">
              <article className="landing__plan">
                <h3 className="landing__plan-name">Старт</h3>
                <p className="landing__plan-desc">Минимум функций, максимум пользы</p>
                <div className="landing__price">500 сом</div>
              </article>

              <article className="landing__plan landing__plan--highlight">
                <div className="landing__badge">Хит</div>
                <h3 className="landing__plan-name">Стандарт</h3>
                <p className="landing__plan-desc">Аналитика, отчёты, поддержка 24/7</p>
                <div className="landing__price">3000 сом / мес</div>
              </article>

              <article className="landing__plan">
                <h3 className="landing__plan-name">Стандарт+</h3>
                <p className="landing__plan-desc">Полная кастомизация и контроль</p>
                <div className="landing__price">10000 сом / мес</div>
              </article>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing__cta" aria-label="Призыв к действию">
          <div className="landing__container">
            <div className="landing__cta-card">
              <h3 className="landing__cta-title">Готовы управлять эффективнее?</h3>
              <p className="landing__cta-text">Подключим вашу отрасль за 1 день и аккуратно перенесём данные.</p>
              <Link to="/submit-application" className="landing__btn landing__btn--primary">
                Получить консультацию
              </Link>
            </div>
          </div>
        </section>

        {/* КОНТАКТЫ */}
        <section className="landing__section landing__section--contact" aria-label="Контакты">
          <div className="landing__container">
            <h2 className="landing__title">Связь с нами</h2>
            <p className="landing__text">
              Email:{" "}
              <a className="landing__link" href="mailto:support@nurcrm.com">
                support@nurcrm.com
              </a>
            </p>
            <p className="landing__text">
              Телефон:{" "}
              <a className="landing__link" href="tel:+996700123456">
                +996 700 123 456
              </a>
            </p>
            <p className="landing__text">
              Telegram:{" "}
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
          <p className="landing__footer-text">© 2025 NUR CRM — Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
