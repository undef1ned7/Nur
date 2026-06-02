import { useCallback, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Factory,
  LayoutGrid,
  Scissors,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import { useLandingIndustries } from "../../hooks/useLandingIndustries";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Sphere.scss";

const DESKTOP_SLIDES = 4;

const LANDING_SPHERE_NAMES = [
  "Строительная сфера",
  "Парикмахерские",
  "Кафе",
  "Магазины",
  "Склад",
  "Производство",
  "Услуги",
  "Стоматология",
];

/** Описания по фактическим модулям сфер в NurCRM (menuConfig + sector routes) */
const SPHERE_DESCRIPTIONS = {
  "Строительная сфера":
    "Объекты и проекты, договоры, закупки, склад, продажи и зарплата — весь цикл стройки от сметы до сдачи в одной системе",
  "Парикмахерские":
    "Онлайн-запись, услуги, мастера и клиентская база — салон без очередей, потерянных номеров и хаоса в блокноте",
  Кафе:
    "Меню, заказы, кухня, столы, бронь и склад — зал, бар и кухня работают согласованно, без накладок по столам и блюдам",
  Магазины:
    "Товары, касса, смены, поставщики и аналитика — розница с точными остатками, документами и прозрачной выручкой",
  Склад:
    "Приход, отгрузки, документы, контрагенты и заявки агентов — оптовый учёт без Excel и потерянных накладных",
  Производство:
    "Каталог, склад, продажи, заявки и передача агентам — видите заказы и остатки, пока продукция ещё на линии",
  Услуги:
    "Записи, услуги, клиенты и сотрудники — для сервисных компаний, где каждый визит и заявка на счету",
  Стоматология:
    "Пациенты, приёмы, услуги и история лечения — клиника без потерянных записей и бумажных карточек",
};

const SPHERE_ICONS = {
  "Строительная сфера": Building2,
  "Парикмахерские": Scissors,
  Кафе: UtensilsCrossed,
  Магазины: Store,
  Склад: Warehouse,
  Производство: Factory,
  Услуги: Wrench,
  Стоматология: Stethoscope,
};

const getSphereDescription = (industryName) =>
  SPHERE_DESCRIPTIONS[industryName] ??
  "Индивидуальная настройка NurCRM под процессы вашего бизнеса.";

const getSphereIcon = (industryName) => SPHERE_ICONS[industryName] ?? LayoutGrid;

const Sphere = () => {
  const scrollToDemo = useScrollToDemo();
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const { industries, loading } = useLandingIndustries();

  const sphereCards = useMemo(() => {
    const byName = new Map(
      industries.map((industry) => [industry.name, industry]),
    );

    return LANDING_SPHERE_NAMES.map((name) => byName.get(name))
      .filter(Boolean)
      .map((industry) => ({
        id: industry.id,
        title: industry.name,
        text: getSphereDescription(industry.name),
        Icon: getSphereIcon(industry.name),
      }));
  }, [industries]);

  const updateSwiperState = useCallback((swiper) => {
    setActiveIndex(swiper.snapIndex ?? swiper.activeIndex);
    setPageCount(swiper.snapGrid?.length ?? 1);
    setIsBeginning(swiper.isBeginning);
    setIsEnd(swiper.isEnd);
  }, []);

  const handleDotClick = (pageIndex) => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    const group = swiper.params.slidesPerGroup || 1;
    swiper.slideTo(pageIndex * group);
  };

  const handlePrev = () => swiperRef.current?.slidePrev();
  const handleNext = () => swiperRef.current?.slideNext();

  const showControls = !loading && pageCount > 1;

  return (
    <section id="for-whom" className="spheres">
      <div className="spheres__container new-container">
        <div className="spheres__header">
          <h2 className="spheres__title">
            Решения для{" "}
            <span className="spheres__title-yellow">разных сфер</span> бизнеса
          </h2>
          <p className="spheres__subtitle">
            Выбираете сферу — получаете готовый набор инструментов: клиенты, продажи,
            склад, касса и отчёты уже настроены под ваш тип бизнеса.
          </p>
        </div>

        {loading && <p className="spheres__status">Загрузка сфер…</p>}

        {!loading && sphereCards.length === 0 && (
          <p className="spheres__status">Сферы временно недоступны</p>
        )}

        {!loading && sphereCards.length > 0 && (
          <div className="spheres__slider">
            <button
              type="button"
              className="spheres__nav spheres__nav--prev"
              aria-label="Предыдущие сферы"
              onClick={handlePrev}
              disabled={isBeginning}
            >
              <ChevronLeft size={24} />
            </button>

            <Swiper
              className="spheres__grid"
              slidesPerView={1.15}
              slidesPerGroup={1}
              spaceBetween={16}
              grabCursor
              watchOverflow
              breakpoints={{
                768: {
                  slidesPerView: 2,
                  slidesPerGroup: 2,
                  spaceBetween: 20,
                },
                1025: {
                  slidesPerView: DESKTOP_SLIDES,
                  slidesPerGroup: DESKTOP_SLIDES,
                  spaceBetween: 24,
                  allowTouchMove: false,
                },
              }}
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
                updateSwiperState(swiper);
              }}
              onSlideChange={updateSwiperState}
              onResize={updateSwiperState}
              onBreakpoint={updateSwiperState}
            >
              {sphereCards.map(({ id, title, text, Icon }) => (
                <SwiperSlide key={id} className="spheres__slide">
                  <div className="spheres__card">
                    <div className="spheres__card-icon" aria-hidden="true">
                      <Icon size={40} strokeWidth={1.75} />
                    </div>
                    <h3 className="spheres__card-title">{title}</h3>
                    <p className="spheres__card-text">{text}</p>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            <button
              type="button"
              className="spheres__nav spheres__nav--next"
              aria-label="Следующие сферы"
              onClick={handleNext}
              disabled={isEnd}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {showControls && (
          <div className="spheres__controls">
            <div
              className="spheres__dots"
              role="tablist"
              aria-label="Страницы сфер"
            >
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  className={`spheres__dot${
                    index === activeIndex ? " spheres__dot--active" : ""
                  }`}
                  aria-label={`Страница ${index + 1} из ${pageCount}`}
                  aria-selected={index === activeIndex}
                  onClick={() => handleDotClick(index)}
                />
              ))}
            </div>
            <span className="spheres__counter">
              {activeIndex + 1} / {pageCount}
            </span>
          </div>
        )}

        <div className="spheres__footer">
          <div className="spheres__footer-info">
            <h4 className="spheres__footer-title">Не нашли свою сферу?</h4>
            <p className="spheres__footer-text">
              Подключим нужные модули и поможем настроить систему под ваши процессы.
            </p>
          </div>
          <button type="button" className="spheres__btn" onClick={scrollToDemo}>
            Попробовать NurCRM <span className="spheres__btn-arrow">→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default Sphere;
