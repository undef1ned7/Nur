import { FaFileAlt, FaPaperclip } from "react-icons/fa";
import { mediaTypeLabel } from "../../../../api/consultingWazzup";

/**
 * Рендер вложения в бабле чата (image / video / voice / document / file).
 * Контракт: docs/consulting/media-and-error-handling.md
 */
export default function ChatMessageMedia({ url, mediaType }) {
  if (!url) return null;
  const type = String(mediaType || "").toLowerCase();
  const label = mediaTypeLabel(type) || "📎 [Вложение]";

  if (type === "image") {
    return (
      <a
        className="funnel__chatMedia funnel__chatMedia--image"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        <img src={url} alt="Фотография" loading="lazy" />
      </a>
    );
  }

  if (type === "video") {
    return (
      <div className="funnel__chatMedia funnel__chatMedia--video">
        <video src={url} controls preload="metadata" playsInline />
      </div>
    );
  }

  if (type === "voice") {
    return (
      <div className="funnel__chatMedia funnel__chatMedia--voice">
        <audio controls preload="metadata" src={url}>
          <a href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        </audio>
      </div>
    );
  }

  const Icon = type === "document" ? FaFileAlt : FaPaperclip;
  const linkLabel =
    type === "document"
      ? "Документ"
      : type === "file"
        ? "Вложение"
        : "Файл / медиа";

  return (
    <a
      className="funnel__chatMedia funnel__chatMedia--file"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      <Icon aria-hidden /> {linkLabel}
    </a>
  );
}
