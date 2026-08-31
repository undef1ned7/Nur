import { useRef } from "react";
import {
  getLessonThumbnail,
  THUMBNAIL_ACCEPT,
  validateThumbnailFile,
} from "../utils";

const LessonThumbnailField = ({
  lesson,
  index,
  disabled,
  onChange,
  onClear,
  onSelectFile,
  onFileError,
}) => {
  const fileInputRef = useRef(null);
  const preview = getLessonThumbnail(lesson);
  const hasCustomThumb = Boolean(
    lesson.thumbnailPreview || lesson.thumbnail?.trim() || lesson.thumbnailFile,
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateThumbnailFile(file);
    if (validationError) {
      onFileError?.(validationError);
      return;
    }

    onSelectFile(index, file);
  };

  return (
    <div className="vl-admin__field">
      <label htmlFor={`lesson-thumb-url-${index}`}>Превью (необязательно)</label>

      <div className="vl-admin__thumb-controls">
        <input
          ref={fileInputRef}
          id={`lesson-thumb-file-${index}`}
          type="file"
          accept={THUMBNAIL_ACCEPT}
          className="vl-admin__thumb-file-input"
          disabled={disabled}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="vl-admin__thumb-file-btn"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          Загрузить файл
        </button>

        {hasCustomThumb && (
          <button
            type="button"
            className="vl-admin__thumb-clear-btn"
            disabled={disabled}
            onClick={() => onClear(index)}
          >
            Убрать превью
          </button>
        )}
      </div>

      <input
        id={`lesson-thumb-url-${index}`}
        type="url"
        value={lesson.thumbnail}
        onChange={(e) => onChange(index, "thumbnail", e.target.value)}
        placeholder="или вставьте ссылку на изображение"
        disabled={disabled}
      />

      <span className="vl-admin__field-hint">
        JPG, PNG, WebP или GIF до 5 МБ. Если не указано — используется превью
        с YouTube
      </span>

      {lesson.thumbnailFile && (
        <span className="vl-admin__field-hint vl-admin__field-hint--file">
          Файл: {lesson.thumbnailFile.name}
        </span>
      )}

      {preview && (
        <div className="vl-admin__thumb-preview">
          <img src={preview} alt="" loading="lazy" />
        </div>
      )}
    </div>
  );
};

export default LessonThumbnailField;
