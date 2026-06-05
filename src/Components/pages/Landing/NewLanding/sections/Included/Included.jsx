import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTranslationArray } from "../../utils/getTranslationArray";
import "./Included.scss";

const STATS_CONFIG = [
  { key: "profit", value: 25, suffix: "%" },
  { key: "errors", value: -60, suffix: "%" },
  { key: "responses", value: 3, suffix: "x" },
  { key: "control", static: "24/7" },
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
  const { t } = useTranslation("newLanding");
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const gridItems = getTranslationArray(t, "included.grid");

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
              {t("included.title")}{" "}
              <span className="included-yellow">{t("included.titleHighlight")}</span>{" "}
              {t("included.titleSuffix")}
            </h1>
            <p className="included__description">{t("included.description")}</p>
          </div>

          <div className="included__grid">
            {gridItems.map((item) => (
                <div key={item.title} className="included__grid-item">
                  <h2 className="included__subtitle">
                    {item.title} <br />
                    <span className="included-yellow">{item.highlight}</span>
                  </h2>
                </div>
              ))}
          </div>
        </div>

        <div
          ref={statsRef}
          className={`included__stats${statsVisible ? " included__stats--visible" : ""}`}
        >
          {STATS_CONFIG.map((stat, index) => (
            <div
              key={stat.key}
              className="included__stat-box"
              style={{ "--stat-delay": `${index * 120}ms` }}
            >
              <AnimatedStatValue
                stat={stat}
                isVisible={statsVisible}
                delay={index * 120}
              />
              <div className="included__stat-label">
                {t(`included.stats.${stat.key}`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Included;
