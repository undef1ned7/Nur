import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

const LessonsSidebar = ({
  courses,
  selectedCourseId,
  onSelectAll,
  onSelectCourse,
  expandedIds,
  onToggleExpand,
  activeLessonId,
}) => {
  const location = useLocation();

  return (
    <aside className="vl-sidebar">
      <button
        type="button"
        className={`vl-sidebar__all${!selectedCourseId ? " vl-sidebar__all--active" : ""}`}
        onClick={onSelectAll}
      >
        Все уроки
      </button>

      <nav className="vl-sidebar__nav" aria-label="Категории уроков">
        {(Array.isArray(courses) ? courses : []).map((course) => {
          const isExpanded = expandedIds.has(course.id);
          const isCourseActive = selectedCourseId === course.id;
          const sortedLessons = [...(course.lessons || [])].sort(
            (a, b) => a.order - b.order
          );

          return (
            <div key={course.id} className="vl-sidebar__group">
              <button
                type="button"
                className={`vl-sidebar__category${isCourseActive ? " vl-sidebar__category--active" : ""}`}
                onClick={() => {
                  onSelectCourse(course.id);
                  onToggleExpand(course.id);
                }}
                aria-expanded={isExpanded}
              >
                <span>{course.title}</span>
                {isExpanded ? (
                  <ChevronUp size={18} aria-hidden />
                ) : (
                  <ChevronDown size={18} aria-hidden />
                )}
              </button>

              {isExpanded && sortedLessons.length > 0 && (
                <ul className="vl-sidebar__lessons">
                  {sortedLessons.map((lesson) => {
                    const lessonPath = `/video-lessons/${lesson.id}`;
                    const isActive =
                      activeLessonId === lesson.id ||
                      location.pathname === lessonPath;

                    return (
                      <li key={lesson.id}>
                        <Link
                          to={lessonPath}
                          className={`vl-sidebar__lesson-link${isActive ? " vl-sidebar__lesson-link--active" : ""}`}
                          onClick={() => onSelectCourse(course.id)}
                        >
                          {lesson.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default LessonsSidebar;
