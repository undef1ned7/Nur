import { useEffect, useRef, useState } from "react";
import "./Included.scss";

const STATS = [
  { value: 25, suffix: "%", label: "Рост прибыли" },
  { value: -60, suffix: "%", label: "Меньше ошибок" },
  { value: 3, suffix: "x", label: "Быстрее ответы" },
  { static: "24/7", label: "Контроль бизнеса" },
];

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const AnimatedStatValue = ({ stat, isVisible, delay = 0 }) => {
  const [display, setDisplay] = useState(() =>
    stat.static ? "" : `0${stat.suffix}`,
  );
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!isVisible) return undefined;

    const revealTimer = window.setTimeout(() => setRevealed(true), delay);

    if (stat.static) {
      const staticTimer = window.setTimeout(() => {
        setDisplay(stat.static);
      }, delay);
      return () => {
        window.clearTimeout(revealTimer);
        window.clearTimeout(staticTimer);
      };
    }

    const duration = 1400;
    let rafId = 0;
    let startTime = null;

    const tick = (now) => {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      const current = Math.round(stat.value * easeOutCubic(progress));
      setDisplay(`${current}${stat.suffix}`);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const startTimer = window.setTimeout(() => {
      rafId = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(startTimer);
      cancelAnimationFrame(rafId);
    };
  }, [isVisible, stat, delay]);

  return (
    <div
      className={`included__stat-value${revealed ? " included__stat-value--visible" : ""}`}
    >
      {display}
    </div>
  );
};

const Included = () => {
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const node = statsRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

        <div
          ref={statsRef}
          className={`included__stats${statsVisible ? " included__stats--visible" : ""}`}
        >
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className="included__stat-box"
              style={{ "--stat-delay": `${index * 120}ms` }}
            >
              <AnimatedStatValue
                stat={stat}
                isVisible={statsVisible}
                delay={index * 120}
              />
              <div className="included__stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Included;
