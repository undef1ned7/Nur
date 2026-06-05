import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatLessonDate } from "../utils";

const LessonCard = ({ lesson, compact = false, isCurrent = false }) => {
  const { i18n } = useTranslation("newLanding");
  const locale = (i18n.resolvedLanguage || i18n.language || "ru").startsWith("ky")
    ? "ky"
    : "ru";
  const dateLabel = formatLessonDate(lesson.created_at, locale);

  return (
    <Link
      to={`/video-lessons/${lesson.id}`}
      className={`vl-card${compact ? " vl-card--compact" : ""}${isCurrent ? " vl-card--current" : ""}`}
    >
      <div className="vl-card__thumb" aria-hidden />
      <div className="vl-card__body">
        <h3 className="vl-card__title">{lesson.title}</h3>
        {lesson.description && (
          <p className="vl-card__desc">{lesson.description}</p>
        )}
        {dateLabel && (
          <span className="vl-card__meta">• {dateLabel}</span>
        )}
      </div>
    </Link>
  );
};

export default LessonCard;
