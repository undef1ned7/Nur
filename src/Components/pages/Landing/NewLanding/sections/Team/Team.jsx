import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "./Team.scss";
import memberPhoto from "./img/member.jpg";
import LandingImg from "../../components/LandingImg";

const DESKTOP_SLIDES = 4;

const TEAM_MEMBERS = [
  { id: 1, name: "Анна Иванова", role: "Основатель" },
  { id: 2, name: "Анна Иванова", role: "Основатель" },
  { id: 3, name: "Анна Иванова", role: "Основатель" },
  { id: 4, name: "Анна Иванова", role: "Основатель" },
];

const Team = () => {
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

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

  const showControls = pageCount > 1;

  return (
    <section id="team" className="team">
      <div className="team__container new-container">
        <div className="team__start">
          <div className="team__first">
            <h1 className="team__start__title">
              Команда, <br />
              которая внедряет
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

        <div className="team__slider">
          <button
            type="button"
            className="team__nav team__nav--prev"
            aria-label="Предыдущий участник команды"
            onClick={handlePrev}
            disabled={isBeginning}
          >
            <ChevronLeft size={24} />
          </button>

          <Swiper
            className="team__cards"
            slidesPerView={1.15}
            slidesPerGroup={1}
            spaceBetween={16}
            grabCursor
            watchOverflow
            breakpoints={{
              768: {
                slidesPerView: 2,
                slidesPerGroup: 1,
                spaceBetween: 20,
              },
              1025: {
                slidesPerView: DESKTOP_SLIDES,
                slidesPerGroup: DESKTOP_SLIDES,
                spaceBetween: 20,
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
            {TEAM_MEMBERS.map((member) => (
              <SwiperSlide key={member.id} className="team__slide">
                <div className="team__cards__card">
                  <LandingImg
                    className="team__cards__card__img"
                    src={memberPhoto}
                    alt={member.name}
                    width={400}
                    height={500}
                  />
                  <h2 className="team__cards__card__title">{member.name}</h2>
                  <p className="team__cards__card__description">{member.role}</p>
                  <div className="team__cards__card__line"></div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          <button
            type="button"
            className="team__nav team__nav--next"
            aria-label="Следующий участник команды"
            onClick={handleNext}
            disabled={isEnd}
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {showControls && (
          <div className="team__controls">
            <div className="team__dots" role="tablist" aria-label="Страницы команды">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  className={`team__dot${
                    index === activeIndex ? " team__dot--active" : ""
                  }`}
                  aria-label={`Страница ${index + 1} из ${pageCount}`}
                  aria-selected={index === activeIndex}
                  onClick={() => handleDotClick(index)}
                />
              ))}
            </div>
            <span className="team__counter">
              {activeIndex + 1} / {pageCount}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default Team;
