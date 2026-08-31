import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatLessonDate, getLessonThumbnail, getVideoThumbnail } from "../utils";

const LessonCard = ({ lesson, compact = false, isCurrent = false }) => {
  const { i18n } = useTranslation("newLanding");
  const locale = (i18n.resolvedLanguage || i18n.language || "ru").startsWith("ky")
    ? "ky"
    : "ru";
  const dateLabel = formatLessonDate(lesson.created_at, locale);
  const customThumb = lesson.thumbnail?.trim();
  const autoThumb = getVideoThumbnail(lesson.url);
  const [useAutoThumb, setUseAutoThumb] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbnail = getLessonThumbnail(
    useAutoThumb ? { ...lesson, thumbnail: "" } : lesson,
  );

  const handleThumbError = () => {
    if (customThumb && !useAutoThumb && autoThumb) {
      setUseAutoThumb(true);
      return;
    }
    setThumbFailed(true);
  };

  return (
    <Link
      to={`/video-lessons/${lesson.id}`}
      className={`vl-card${compact ? " vl-card--compact" : ""}${isCurrent ? " vl-card--current" : ""}`}
    >
      <div className="vl-card__thumb" aria-hidden>
        {thumbnail && !thumbFailed && (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            onError={handleThumbError}
          />
        )}
      </div>
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
