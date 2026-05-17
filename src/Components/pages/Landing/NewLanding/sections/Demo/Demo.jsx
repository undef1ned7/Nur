import './Demo.scss'
import blur1 from './img/blur1.svg'
import line from './img/line.svg'

const Demo = () => {
  return (
    <section className="demo">
      <div className="demo__container new-container">
        <img className='demo__blur' src={blur1} alt="" />
        <img className='demo__blur2' src={blur1} alt="" />
        <div className="demo__left">
            <img className='demo__line' src={line} alt="" />
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
          <input  className='demo__form__inp' type="text" placeholder="Введите ваше имя" />
          <input  className='demo__form__inp' type="number" placeholder="Номер телефона" />
          <select className='demo__form__inp' >
            <option selected disabled>
              Выберите сферу
            </option>
            <option>IT</option>
            <option>Маркетинг</option>
            <option>Дизайн</option>
          </select>
          <button className='demo__form__btn'>Оставить заявку</button>
        </form>
      </div>
    </section>
  );
};
export default Demo;
