import "./Sphere.scss";

const Sphere = () => {
  return (
    <section className="spheres">
      <div className="spheres__container new-container">
        
        <div className="spheres__header">
          <h2 className="spheres__title">
            Решения для <span className="spheres__title-yellow">разных сфер</span> бизнеса
          </h2>
          <p className="spheres__subtitle">
            NurCRM помогает управлять продажами, складом, кассой и аналитикой в разных направлениях бизнеса.
          </p>
        </div>

        <div className="spheres__grid">
          {/* Карточка 1 */}
          <div className="spheres__card">
            <div className="spheres__card-icon"></div>
            <h3 className="spheres__card-title">Кафе / ресторан</h3>
            <p className="spheres__card-text">
              Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.
            </p>
          </div>

          {/* Карточка 2 */}
          <div className="spheres__card">
            <div className="spheres__card-icon"></div>
            <h3 className="spheres__card-title">Кафе / ресторан</h3>
            <p className="spheres__card-text">
              Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.
            </p>
          </div>

          {/* Карточка 3 */}
          <div className="spheres__card">
            <div className="spheres__card-icon"></div>
            <h3 className="spheres__card-title">Кафе / ресторан</h3>
            <p className="spheres__card-text">
              Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.
            </p>
          </div>

          {/* Карточка 4 */}
          <div className="spheres__card">
            <div className="spheres__card-icon"></div>
            <h3 className="spheres__card-title">Кафе / ресторан</h3>
            <p className="spheres__card-text">
              Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.
            </p>
          </div>
        </div>

        <div className="spheres__dots">
          <span className="spheres__dot spheres__dot--active"></span>
          <span className="spheres__dot"></span>
          <span className="spheres__dot"></span>
        </div>

        <div className="spheres__footer">
          <div className="spheres__footer-info">
            <h4 className="spheres__footer-title">Не нашли свою сферу?</h4>
            <p className="spheres__footer-text">NurCrm можно адаптировать под ваш бизнес.</p>
          </div>
          <button className="spheres__btn">
            Попробовать NurCRM <span className="spheres__btn-arrow">→</span>
          </button>
        </div>

      </div>
    </section>
  );
};

export default Sphere;