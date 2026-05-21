import { useCallback, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Sphere.scss";

const SPHERE_CARDS = [
  {
    id: "1",
    title: "Кафе / ресторан",
    text: "Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.",
  },
  {
    id: "2",
    title: "Кафе / ресторан",
    text: "Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.",
  },
  {
    id: "3",
    title: "Кафе / ресторан",
    text: "Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.",
  },
  {
    id: "4",
    title: "Кафе / ресторан",
    text: "Контроль заказов, кассы, склада, ингредиентов и себестоимость блюд.",
  },
];

const Sphere = () => {
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paginationCount, setPaginationCount] = useState(0);

  const updatePagination = useCallback((swiper) => {
    setActiveIndex(swiper.snapIndex ?? swiper.activeIndex);
    setPaginationCount(swiper.snapGrid?.length ?? swiper.slides.length);
  }, []);

  const handleDotClick = (index) => {
    swiperRef.current?.slideTo(index);
  };

  return (
    <section className="spheres">
      <div className="spheres__container new-container">
        <div className="spheres__header">
          <h2 className="spheres__title">
            Решения для{" "}
            <span className="spheres__title-yellow">разных сфер</span> бизнеса
          </h2>
          <p className="spheres__subtitle">
            NurCRM помогает управлять продажами, складом, кассой и аналитикой в
            разных направлениях бизнеса.
          </p>
        </div>

        <Swiper
          className="spheres__grid"
          slidesPerView={1.15}
          spaceBetween={24}
          grabCursor
          breakpoints={{
            1025: {
              slidesPerView: 4,
              spaceBetween: 24,
              allowTouchMove: false,
            },
          }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            updatePagination(swiper);
          }}
          onSlideChange={updatePagination}
          onResize={updatePagination}
          onBreakpoint={updatePagination}
        >
          {SPHERE_CARDS.map((card) => (
            <SwiperSlide key={card.id} className="spheres__slide">
              <div className="spheres__card">
                <div className="spheres__card-icon" />
                <h3 className="spheres__card-title">{card.title}</h3>
                <p className="spheres__card-text">{card.text}</p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {paginationCount > 1 && (
          <div className="spheres__dots">
            {Array.from({ length: paginationCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`spheres__dot${
                  index === activeIndex ? " spheres__dot--active" : ""
                }`}
                aria-label={`Слайд ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => handleDotClick(index)}
              />
            ))}
          </div>
        )}

        <div className="spheres__footer">
          <div className="spheres__footer-info">
            <h4 className="spheres__footer-title">Не нашли свою сферу?</h4>
            <p className="spheres__footer-text">
              NurCrm можно адаптировать под ваш бизнес.
            </p>
          </div>
          <button type="button" className="spheres__btn">
            Попробовать NurCRM <span className="spheres__btn-arrow">→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default Sphere;
