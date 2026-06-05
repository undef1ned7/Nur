import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../sections/Header/Header";
import LessonCard from "./components/LessonCard";
import VideoPlayer from "./components/VideoPlayer";
import { useKnowledgeBase } from "./hooks/useKnowledgeBase";
import {
  findLessonById,
  flattenLessons,
  formatLessonDate,
} from "./utils";
import "./VideoLessons.scss";

const VideoLessonView = () => {
  const { t, i18n } = useTranslation("newLanding");
  const { lessonId } = useParams();
  const { courses, loading, error, reload } = useKnowledgeBase();
  const locale = (i18n.resolvedLanguage || i18n.language || "ru").startsWith("ky")
    ? "ky"
    : "ru";

  const lesson = useMemo(
    () => findLessonById(courses, lessonId),
    [courses, lessonId],
  );

  const sidebarLessons = useMemo(() => {
    const all = flattenLessons(courses);
    if (lesson?.courseId) {
      return all.filter((l) => l.courseId === lesson.courseId);
    }
    return all;
  }, [courses, lesson]);

  return (
    <div className="video-lessons-page">
      <Header />

      <main className="vl-page">
        <div className="vl-page__container new-container">
          {loading && (
            <p className="vl-main__status">{t("videoLessons.lessonLoading")}</p>
          )}

          {error && !loading && (
            <div className="vl-main__status vl-main__status--error">
              <p>{error}</p>
              <button type="button" onClick={reload}>
                {t("videoLessons.retry")}
              </button>
            </div>
          )}

          {!loading && !error && !lesson && (
            <div className="vl-main__status">
              <p>{t("videoLessons.lessonNotFound")}</p>
              <Link to="/video-lessons">{t("videoLessons.backToAll")}</Link>
            </div>
          )}

          {!loading && !error && lesson && (
            <section className="vl-view">
              <div className="vl-view__player-col">
                <VideoPlayer url={lesson.url} title={lesson.title} />

                <div className="vl-view__info">
                  <h1 className="vl-view__title">{lesson.title}</h1>
                  {lesson.description && (
                    <p className="vl-view__desc">{lesson.description}</p>
                  )}
                  {lesson.created_at && (
                    <span className="vl-view__meta">
                      • {formatLessonDate(lesson.created_at, locale)}
                    </span>
                  )}
                </div>
              </div>

              <aside className="vl-view__sidebar">
                <h2 className="vl-view__sidebar-title">
                  {t("videoLessons.otherLessons")}
                </h2>
                <ul className="vl-view__list">
                  {sidebarLessons.map((item) => (
                    <li key={item.id}>
                      <LessonCard
                        lesson={item}
                        compact
                        isCurrent={item.id === lesson.id}
                      />
                    </li>
                  ))}
                </ul>
              </aside>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoLessonView;
