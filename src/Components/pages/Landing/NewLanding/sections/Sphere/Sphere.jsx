import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getIndustries } from "../../../../../../api/auth";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Sphere.scss";

const DESKTOP_SLIDES = 4;

const getIndustryDescription = (industry) => {
  if (industry.sectors?.length) {
    return industry.sectors.map((sector) => sector.name).join(", ");
  }
  return "Индивидуальная настройка NurCRM под процессы вашего бизнеса.";
};

const Sphere = () => {
  const scrollToDemo = useScrollToDemo();
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);

  const sphereCards = useMemo(
    () =>
      industries.map((industry) => ({
        id: industry.id,
        title: industry.name,
        text: getIndustryDescription(industry),
      })),
    [industries]
  );

  useEffect(() => {
    let cancelled = false;

    const loadIndustries = async () => {
      setLoading(true);
      try {
        const data = await getIndustries();
        if (!cancelled) {
          setIndustries(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setIndustries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadIndustries();

    return () => {
      cancelled = true;
    };
  }, []);

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
            NurCRM помогает управлять продажами, складом, кассой и аналитикой в
            разных направлениях бизнеса.
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
              {sphereCards.map((card) => (
                <SwiperSlide key={card.id} className="spheres__slide">
                  <div className="spheres__card">
                    <div className="spheres__card-icon" />
                    <h3 className="spheres__card-title">{card.title}</h3>
                    <p className="spheres__card-text">{card.text}</p>
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
            <div className="spheres__dots" role="tablist" aria-label="Страницы сфер">
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
              NurCrm можно адаптировать под ваш бизнес.
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
