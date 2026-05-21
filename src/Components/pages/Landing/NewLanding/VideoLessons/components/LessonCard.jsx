import { Link } from "react-router-dom";
import { formatLessonDate } from "../utils";

const LessonCard = ({ lesson, compact = false, isCurrent = false }) => {
  const dateLabel = formatLessonDate(lesson.created_at);

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
