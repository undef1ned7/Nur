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
import { useTranslation } from "react-i18next";
import { useScrollToDemo } from "../../hooks/useScrollToDemo";
import { useLandingIndustries } from "../../hooks/useLandingIndustries";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Sphere.scss";

const DESKTOP_SLIDES = 4;

const LANDING_SPHERES = [
  { key: "construction", apiName: "Строительная сфера", Icon: Building2 },
  { key: "barbershop", apiName: "Парикмахерские", Icon: Scissors },
  { key: "cafe", apiName: "Кафе", Icon: UtensilsCrossed },
  { key: "stores", apiName: "Магазины", Icon: Store },
  { key: "warehouse", apiName: "Склад", Icon: Warehouse },
  { key: "production", apiName: "Производство", Icon: Factory },
  { key: "services", apiName: "Услуги", Icon: Wrench },
  { key: "dentistry", apiName: "Стоматология", Icon: Stethoscope },
];

const Sphere = () => {
  const { t } = useTranslation("newLanding");
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

    return LANDING_SPHERES.map(({ key, apiName, Icon }) => {
      const industry = byName.get(apiName);
      if (!industry) return null;

      return {
        id: industry.id,
        title: t(`sphere.industries.${key}.title`),
        text: t(`sphere.industries.${key}.description`),
        Icon,
      };
    }).filter(Boolean);
  }, [industries, t]);

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
            {t("sphere.title")}{" "}
            <span className="spheres__title-yellow">
              {t("sphere.titleHighlight")}
            </span>{" "}
            {t("sphere.titleSuffix")}
          </h2>
          <p className="spheres__subtitle">{t("sphere.subtitle")}</p>
        </div>

        {loading && <p className="spheres__status">{t("sphere.loading")}</p>}

        {!loading && sphereCards.length === 0 && (
          <p className="spheres__status">{t("sphere.unavailable")}</p>
        )}

        {!loading && sphereCards.length > 0 && (
          <div className="spheres__slider">
            <button
              type="button"
              className="spheres__nav spheres__nav--prev"
              aria-label={t("sphere.navPrev")}
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
              aria-label={t("sphere.navNext")}
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
              aria-label={t("sphere.paginationLabel")}
            >
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  className={`spheres__dot${
                    index === activeIndex ? " spheres__dot--active" : ""
                  }`}
                  aria-label={t("sphere.paginationPage", {
                    current: index + 1,
                    total: pageCount,
                  })}
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
            <h4 className="spheres__footer-title">{t("sphere.footerTitle")}</h4>
            <p className="spheres__footer-text">{t("sphere.footerText")}</p>
          </div>
          <button type="button" className="spheres__btn" onClick={scrollToDemo}>
            {t("sphere.cta")}{" "}
            <span className="spheres__btn-arrow">→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default Sphere;
