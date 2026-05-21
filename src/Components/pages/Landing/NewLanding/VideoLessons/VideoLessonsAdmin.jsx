import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import Header from "../sections/Header/Header";
import { useKnowledgeBase } from "./hooks/useKnowledgeBase";
import {
  createKnowledgeBaseCourse,
  fetchKnowledgeBaseCourse,
  updateKnowledgeBaseCourse,
} from "../../../../../api/knowledgeBase";
import "./VideoLessons.scss";
import "./VideoLessonsAdmin.scss";

const EMPTY_LESSON = { title: "", description: "", url: "" };

const VideoLessonsAdmin = () => {
  const navigate = useNavigate();
  const { courses, loading, error, reload } = useKnowledgeBase();

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [lessons, setLessons] = useState([{ ...EMPTY_LESSON }]);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);

  const isEdit = Boolean(courseId);

  const resetForm = useCallback(() => {
    setCourseId("");
    setTitle("");
    setLessons([{ ...EMPTY_LESSON }]);
    setFormError(null);
    setSuccess(null);
  }, []);

  useEffect(() => {
    if (!courseId) {
      setTitle("");
      setLessons([{ ...EMPTY_LESSON }]);
      return;
    }

    const loadCourse = async () => {
      setLoadingCourse(true);
      setFormError(null);
      try {
        const course = await fetchKnowledgeBaseCourse(courseId);
        setTitle(course.title || "");
        const sorted = [...(course.lessons || [])].sort(
          (a, b) => a.order - b.order
        );
        setLessons(
          sorted.length
            ? sorted.map(({ title: t, description, url }) => ({
                title: t || "",
                description: description || "",
                url: url || "",
              }))
            : [{ ...EMPTY_LESSON }]
        );
      } catch (err) {
        setFormError(err.message || "Не удалось загрузить курс");
      } finally {
        setLoadingCourse(false);
      }
    };

    loadCourse();
  }, [courseId]);

  const updateLesson = (index, field, value) => {
    setLessons((prev) =>
      prev.map((lesson, i) =>
        i === index ? { ...lesson, [field]: value } : lesson
      )
    );
  };

  const addLesson = () => {
    setLessons((prev) => [...prev, { ...EMPTY_LESSON }]);
  };

  const removeLesson = (index) => {
    setLessons((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  };

  const validate = () => {
    if (!title.trim()) {
      return "Введите название курса";
    }

    const validLessons = lessons.filter((l) => l.title.trim() && l.url.trim());

    if (!validLessons.length) {
      return "Добавьте хотя бы один урок с названием и ссылкой";
    }

    for (const lesson of validLessons) {
      try {
        new URL(lesson.url.trim());
      } catch {
        return `Некорректная ссылка: ${lesson.url}`;
      }
    }

    return null;
  };

  const buildPayload = () => ({
    title: title.trim(),
    lessons: lessons
      .filter((l) => l.title.trim() || l.url.trim())
      .map((l) => ({
        title: l.title.trim(),
        description: l.description.trim(),
        url: l.url.trim(),
      })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();

      if (isEdit) {
        await updateKnowledgeBaseCourse(courseId, payload);
        setSuccess("Курс обновлён");
      } else {
        const created = await createKnowledgeBaseCourse(payload);
        setSuccess("Курс создан");
        if (created?.id) {
          setCourseId(created.id);
        }
      }

      reload();
    } catch (err) {
      setFormError(err.message || "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTitleOnlyUpdate = async () => {
    if (!courseId || !title.trim()) return;

    setSubmitting(true);
    setFormError(null);
    setSuccess(null);

    try {
      await updateKnowledgeBaseCourse(courseId, { title: title.trim() });
      setSuccess("Название курса обновлено");
      reload();
    } catch (err) {
      setFormError(err.message || "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="video-lessons-page">
      <Header />

      <main className="vl-page">
        <div className="vl-page__container new-container">
          <section className="vl-admin">
            <div className="vl-admin__head">
              <div>
                <h1 className="vl-admin__title">Управление видеоуроками</h1>
                <p className="vl-admin__subtitle">
                  Создавайте курсы и добавляйте уроки с ссылками на видео
                </p>
              </div>
              <Link to="/video-lessons" className="vl-admin__back">
                ← К базе знаний
              </Link>
            </div>

            <form className="vl-admin__form" onSubmit={handleSubmit}>
              <div className="vl-admin__field">
                <label htmlFor="course-select">Курс</label>
                <select
                  id="course-select"
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setFormError(null);
                    setSuccess(null);
                  }}
                  disabled={loading || loadingCourse}
                >
                  <option value="">+ Новый курс</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vl-admin__field">
                <label htmlFor="course-title">Название курса</label>
                <input
                  id="course-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Начало работы"
                  disabled={loadingCourse}
                  required
                />
              </div>

              <div className="vl-admin__lessons">
                <div className="vl-admin__lessons-head">
                  <h2>Уроки</h2>
                  <button
                    type="button"
                    className="vl-admin__add-lesson"
                    onClick={addLesson}
                  >
                    <Plus size={18} />
                    Добавить урок
                  </button>
                </div>

                {lessons.map((lesson, index) => (
                  <div key={index} className="vl-admin__lesson-card">
                    <div className="vl-admin__lesson-card-head">
                      <span>Урок {index + 1}</span>
                      {lessons.length > 1 && (
                        <button
                          type="button"
                          className="vl-admin__remove-lesson"
                          onClick={() => removeLesson(index)}
                          aria-label="Удалить урок"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="vl-admin__field">
                      <label htmlFor={`lesson-title-${index}`}>Название</label>
                      <input
                        id={`lesson-title-${index}`}
                        type="text"
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(index, "title", e.target.value)
                        }
                        placeholder="Как начать работу с NurCRM"
                        disabled={loadingCourse}
                      />
                    </div>

                    <div className="vl-admin__field">
                      <label htmlFor={`lesson-desc-${index}`}>Описание</label>
                      <textarea
                        id={`lesson-desc-${index}`}
                        value={lesson.description}
                        onChange={(e) =>
                          updateLesson(index, "description", e.target.value)
                        }
                        placeholder="Краткий обзор системы и первые шаги"
                        rows={2}
                        disabled={loadingCourse}
                      />
                    </div>

                    <div className="vl-admin__field">
                      <label htmlFor={`lesson-url-${index}`}>
                        Ссылка на видео
                      </label>
                      <input
                        id={`lesson-url-${index}`}
                        type="url"
                        value={lesson.url}
                        onChange={(e) =>
                          updateLesson(index, "url", e.target.value)
                        }
                        placeholder="https://youtube.com/watch?v=..."
                        disabled={loadingCourse}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {isEdit && (
                <p className="vl-admin__hint">
                  При сохранении курса список уроков полностью заменяется
                  указанными ниже.
                </p>
              )}

              {error && <p className="vl-admin__message vl-admin__message--error">{error}</p>}
              {formError && (
                <pre className="vl-admin__message vl-admin__message--error">
                  {formError}
                </pre>
              )}
              {success && (
                <p className="vl-admin__message vl-admin__message--success">
                  {success}
                </p>
              )}

              <div className="vl-admin__actions">
                <button
                  type="submit"
                  className="vl-admin__submit"
                  disabled={submitting || loadingCourse}
                >
                  {submitting
                    ? "Сохранение…"
                    : isEdit
                      ? "Сохранить курс"
                      : "Создать курс"}
                </button>

                {isEdit && (
                  <button
                    type="button"
                    className="vl-admin__secondary"
                    onClick={handleTitleOnlyUpdate}
                    disabled={submitting || loadingCourse}
                  >
                    Только название
                  </button>
                )}

                <button
                  type="button"
                  className="vl-admin__secondary"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Очистить
                </button>

                <button
                  type="button"
                  className="vl-admin__secondary"
                  onClick={() => navigate("/video-lessons")}
                >
                  Отмена
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

export default VideoLessonsAdmin;
