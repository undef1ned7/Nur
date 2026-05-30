import "./Team.scss";
import img from './img/img.svg'

const Team = () => {
  return (
    <section id="team" className="team">
      <div className="team__container new-container">
        <div className="team__start">
          <div className="team__first">
            <h1 className="team__start__title">
            Команда, <br />которая  внедряет 
            <span className="team-span"> результат</span>
          </h1>
          </div>
          <div className="team__start__line"></div>
          <p className="team__start__description">
            Мы не просто создаем систему — мы понимаем бизнес и помогаем ему
            расти.Наша команда — это специалисты с опытом внедрения CRM в разных
            сферах бизнеса. Мы настраиваем систему под реальные процессы, а не
            просто устанавливаем продукт.
          </p>
        </div>
        <div className="team__cards">
          <div className="team__cards__card">
            <img className="team__cards__card__img" src={img} alt="" />
            <h2 className="team__cards__card__title">Анна Иванова</h2>
            <p className="team__cards__card__description">Основатель</p>
            <div className="team__cards__card__line"></div>
          </div>
          <div className="team__cards__card">
            <img className="team__cards__card__img" src={img} alt="" />
            <h2 className="team__cards__card__title">Анна Иванова</h2>
            <p className="team__cards__card__description">Основатель</p>
            <div className="team__cards__card__line"></div>
          </div>
          <div className="team__cards__card">
            <img className="team__cards__card__img" src={img} alt="" />
            <h2 className="team__cards__card__title">Анна Иванова</h2>
            <p className="team__cards__card__description">Основатель</p>
            <div className="team__cards__card__line"></div>
          </div>
          <div className="team__cards__card">
            <img className="team__cards__card__img" src={img} alt="" />
            <h2 className="team__cards__card__title">Анна Иванова</h2>
            <p className="team__cards__card__description">Основатель</p>
            <div className="team__cards__card__line"></div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default Team;
