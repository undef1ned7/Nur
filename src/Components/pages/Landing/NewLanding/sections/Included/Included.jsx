import "./Included.scss";

const Included = () => {
  return (
    <section className="included">
      <div className="included__container new-container">
        <div className="included__main">
   
          <div className="included__info">
            <h1 className="included__title">
              Что входит <span className="included-yellow">в каждый</span> тариф
            </h1>
            <p className="included__description">
              Мы обеспечиваем не только систему, но и полноценную поддержку на
              каждом этапе
            </p>
          </div>


          <div className="included__grid">
            <div className="included__grid-item">
              <h2 className="included__subtitle">
                Подключение <br />
                <span className="included-yellow">за 1 день</span>
              </h2>
            </div>
            <div className="included__grid-item">
              <h2 className="included__subtitle">
                Обучение <br />
                <span className="included-yellow">сотрудников</span>
              </h2>
            </div>
            <div className="included__grid-item">
              <h2 className="included__subtitle">
                Техподдержка <br />
                <span className="included-yellow">24/7</span>
              </h2>
            </div>
            <div className="included__grid-item">
              <h2 className="included__subtitle">
                Помощь <br />
                <span className="included-yellow">в настройке</span>
              </h2>
            </div>
            <div className="included__grid-item">
              <h2 className="included__subtitle">
                Гибкая <br />
                <span className="included-yellow">настройка</span>
              </h2>
            </div>
            <div className="included__grid-item">
              <h2 className="included__subtitle">
                Регулярные <br />
                <span className="included-yellow">обновления</span>
              </h2>
            </div>
          </div>
        </div>


        <div className="included__stats">
          <div className="included__stat-box">
            <div className="included__stat-value">25%</div>
            <div className="included__stat-label">Рост прибыли</div>
          </div>
          <div className="included__stat-box">
            <div className="included__stat-value">-60%</div>
            <div className="included__stat-label">Меньше ошибок</div>
          </div>
          <div className="included__stat-box">
            <div className="included__stat-value">3x</div>
            <div className="included__stat-label">Быстрее ответы</div>
          </div>
          <div className="included__stat-box">
            <div className="included__stat-value">24/7</div>
            <div className="included__stat-label">Контроль бизнеса</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Included;