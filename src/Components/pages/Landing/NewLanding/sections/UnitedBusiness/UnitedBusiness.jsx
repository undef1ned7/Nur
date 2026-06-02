import LandingImg from "../../components/LandingImg";
import "./UnitedBusiness.scss";
import blur from "../../assets/banner/blur.svg";

const FEATURES = [
  {
    title: "Клиенты и контакты",
    description:
      "База клиентов, поставщиков и партнёров в одном разделе — история и реквизиты всегда под рукой, без разрозненных таблиц",
  },
  {
    title: "Продажи и долги",
    description:
      "Оформление продаж, возвратов и учёт задолженности — видите, кто купил, кто должен и на какую сумму",
  },
  {
    title: "Склад и закупки",
    description:
      "Товары, остатки, приходы и списания, печать штрих-кодов — точный учёт до продажи, а не после сюрприза на кассе",
  },
  {
    title: "Касса и смены",
    description:
      "Приём оплат, кассовые смены и движение денег — выручка и расходы прозрачны для владельца и кассира",
  },
  {
    title: "Аналитика и обзор",
    description:
      "Дашборд, отчёты по продажам и показатели команды — цифры вместо догадок, когда нужно масштабировать или срезать лишнее",
  },
  {
    title: "Команда и филиалы",
    description:
      "Сотрудники, отделы, филиалы и права доступа — каждый работает в своём контуре, руководитель видит общую картину",
  },
  {
    title: "Бронирование и записи",
    description:
      "Расписание, столы и онлайн-запись — для салонов, кафе и услуг без двойных броней и забытых визитов",
  },
  {
    title: "Под вашу отрасль",
    description:
      "Готовые модули: кафе, магазин, склад, стройка, производство, стоматология и другие — подключаете только то, что нужно бизнесу",
  },
];

const UnitedBusiness = () => {
  return (
    <section id="features" className="unibusiness">
      <div className="unibusiness__container new-container">
        <LandingImg className="unibusiness__blur" src={blur} alt="" aria-hidden="true" />
        <h1 className="unibusiness__title">
          NurCRM объединяет{" "}
          <span className="unibusiness__title-span">все процессы</span> бизнеса
        </h1>
        <p className="unibusiness__description">
          Клиенты, продажи, склад, касса, аналитика и команда — в одной системе с
          настройкой под вашу сферу. Меньше хаоса в таблицах и чатах, больше контроля и
          прибыли.
        </p>

        <div className="unibusiness__carts">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="col-3 unibusiness__cart">
              <h3 className="unibusiness__cart__title">{feature.title}</h3>
              <p className="unibusiness__cart__description">{feature.description}</p>
              <div className="unibusiness__cart__line"></div>
            </div>
          ))}
        </div>
        <p className="unibusiness__enddescription">
          Начните работать с NurCRM уже сегодня — подключитесь за 15 минут и наведите порядок в
          бизнесе.
        </p>
      </div>
    </section>
  );
};
export default UnitedBusiness;
