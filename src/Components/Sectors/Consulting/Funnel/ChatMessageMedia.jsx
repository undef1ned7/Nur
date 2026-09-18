import { FaFileAlt, FaPaperclip } from "react-icons/fa";
import { mediaTypeLabel } from "../../../../api/consultingWazzup";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

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
        <VoiceMessagePlayer url={url} />
      </div>
    );
  }

  const Icon = type === "document" ? FaFileAlt : FaPaperclip;
  const linkHint =
    type === "document"
      ? "Документ · открыть"
      : type === "file"
        ? "Вложение · открыть"
        : "Файл / медиа · открыть";
  const fileName = (() => {
    try {
      const clean = String(url).split("?")[0].split("#")[0];
      return decodeURIComponent(clean.split("/").pop() || "") || label || "Файл";
    } catch {
      return label || "Файл";
    }
  })();

  return (
    <a
      className="funnel__chatMedia funnel__chatMedia--file"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      <span className="funnel__chatMediaFileIcon" aria-hidden>
        <Icon />
      </span>
      <span className="funnel__chatMediaFileInfo">
        <span className="funnel__chatMediaFileName">{fileName}</span>
        <span className="funnel__chatMediaFileHint">{linkHint}</span>
      </span>
    </a>
  );
}
