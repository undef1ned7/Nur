import "./UnitedBusiness.scss";
import blur from '../../assets/banner/blur.svg';

const UnitedBusiness = () => {
  return (
    <section id="features" className="unibusiness">
      <div className="unibusiness__container new-container">
        <img className="unibusiness__blur" src={blur} alt="" />
        <h1 className="unibusiness__title">
          NurCRM объединяет{" "}
          <span className="unibusiness__title-span">все процессы</span> бизнеса
        </h1>
        <p className="unibusiness__description">
          Одна система для управления клиентами, продажами, финансами и
          командой. Все данные в одном месте - принимайте решения быстрее и
          зарабатывайте больше.
        </p>


        <div className="unibusiness__carts">


          <div className="col-3 unibusiness__cart">

            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>

          </div>



          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
          <div className="col-3 unibusiness__cart">
            <h3 className="unibusiness__cart__title">CRM система</h3>
            <p className="unibusiness__cart__description">
              Вся база клиентов, сделки, коммуникации и история в одном месте
            </p>
            <div className="unibusiness__cart__line"></div>
          </div>
        </div>
        <p className="unibusiness__enddescription">Начните работать с NurCRM уже сегодня — подключитесь за 15 минут и наведите порядок в бизнесе.</p>
      </div>
    </section>
  );
};
export default UnitedBusiness;
