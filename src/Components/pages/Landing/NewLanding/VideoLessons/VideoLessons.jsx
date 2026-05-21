import { useMemo, useState } from "react";
import Header from "../sections/Header/Header";
import LessonsSidebar from "./components/LessonsSidebar";
import LessonSearch from "./components/LessonSearch";
import LessonCard from "./components/LessonCard";
import { useKnowledgeBase } from "./hooks/useKnowledgeBase";
import { filterLessons, flattenLessons } from "./utils";
import "./VideoLessons.scss";

const VideoLessons = () => {
  const { courses, loading, error, reload } = useKnowledgeBase();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [search, setSearch] = useState("");

  const allLessons = useMemo(() => flattenLessons(courses), [courses]);

  const visibleLessons = useMemo(
    () => filterLessons(allLessons, { courseId: selectedCourseId, search }),
    [allLessons, selectedCourseId, search]
  );

  const pageTitle = selectedCourseId
    ? courses.find((c) => c.id === selectedCourseId)?.title ?? "Видеоуроки"
    : "Все видеоуроки";

  const handleToggleExpand = (courseId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const handleSelectCourse = (courseId) => {
    setSelectedCourseId(courseId);
    setExpandedIds((prev) => new Set(prev).add(courseId));
  };

  return (
    <div className="video-lessons-page">
      <Header />

      <main className="vl-page">
        <div className="vl-page__container new-container">
          <div className="vl-layout">
            <LessonsSidebar
              courses={courses}
              selectedCourseId={selectedCourseId}
              onSelectAll={() => setSelectedCourseId(null)}
              onSelectCourse={handleSelectCourse}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
            />

            <section className="vl-main">
              <div className="vl-main__head">
                <h1 className="vl-main__title">{pageTitle}</h1>
                <LessonSearch value={search} onChange={setSearch} />
              </div>

              {loading && (
                <p className="vl-main__status">Загрузка уроков…</p>
              )}

              {error && !loading && (
                <div className="vl-main__status vl-main__status--error">
                  <p>{error}</p>
                  <button type="button" onClick={reload}>
                    Повторить
                  </button>
                </div>
              )}

              {!loading && !error && visibleLessons.length === 0 && (
                <p className="vl-main__status">Уроки не найдены</p>
              )}

              {!loading && !error && visibleLessons.length > 0 && (
                <ul className="vl-list">
                  {visibleLessons.map((lesson) => (
                    <li key={lesson.id}>
                      <LessonCard lesson={lesson} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoLessons;
