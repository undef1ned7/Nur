import { useEffect, useMemo, useRef, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";

const BAR_COUNT = 42;

/** Стабильная «случайная» форма волны по URL — одинаковая при каждом рендере. */
function buildBars(seed, count) {
  let h = 0;
  const s = String(seed || "voice");
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    h = (h * 1103515245 + 12345) >>> 0;
    const t = (h % 1000) / 1000;
    bars.push(0.28 + t * 0.72);
  }
  return bars;
}

function fmtVoiceTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * WhatsApp-подобный плеер голосового: кнопка play/pause, волна-бары,
 * синий бегунок прогресса (клик/драг по волне — перемотка), таймер.
 */
export default function VoiceMessagePlayer({ url }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const bars = useMemo(() => buildBars(url, BAR_COUNT), [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    // Chrome иногда отдаёт duration=Infinity для webm-блобов без seek —
    // форсируем пересчёт через служебный сик в конец и обратно.
    const fixInfiniteDuration = () => {
      if (audio.duration === Infinity || Number.isNaN(audio.duration)) {
        audio.currentTime = 1e101;
        const onTimeUpdateOnce = () => {
          audio.currentTime = 0;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          audio.removeEventListener("timeupdate", onTimeUpdateOnce);
        };
        audio.addEventListener("timeupdate", onTimeUpdateOnce);
      } else {
        setDuration(audio.duration || 0);
      }
    };

    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", fixInfiniteDuration);
    audio.addEventListener("durationchange", fixInfiniteDuration);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", fixInfiniteDuration);
      audio.removeEventListener("durationchange", fixInfiniteDuration);
      audio.removeEventListener("ended", onEnd);
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const seekFromClientX = (clientX) => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track || !duration) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = fraction * duration;
    setCurrentTime(audio.currentTime);
  };

  const onTrackPointerDown = (e) => {
    if (!duration) return;
    draggingRef.current = true;
    seekFromClientX(e.clientX);
    const onMove = (ev) => {
      if (draggingRef.current) seekFromClientX(ev.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onTrackKeyDown = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    if (e.key === "ArrowRight") {
      audio.currentTime = Math.min(duration, audio.currentTime + 2);
      setCurrentTime(audio.currentTime);
    } else if (e.key === "ArrowLeft") {
      audio.currentTime = Math.max(0, audio.currentTime - 2);
      setCurrentTime(audio.currentTime);
    }
  };

  const progress = duration ? Math.min(1, currentTime / duration) : 0;
  const displaySeconds = playing || currentTime > 0 ? currentTime : duration;

  return (
    <div className="funnel__voicePlayer">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        className="funnel__voicePlayerBtn"
        onClick={togglePlay}
        aria-label={playing ? "Пауза" : "Воспроизвести голосовое"}
      >
        {playing ? <FaPause /> : <FaPlay />}
      </button>
      <div className="funnel__voicePlayerBody">
        <div
          ref={trackRef}
          className="funnel__voicePlayerTrack"
          onPointerDown={onTrackPointerDown}
          onKeyDown={onTrackKeyDown}
          role="slider"
          aria-label="Позиция воспроизведения"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
        >
          {bars.map((h, i) => {
            const played = i / bars.length <= progress;
            return (
              <span
                key={i}
                className={`funnel__voicePlayerBar${played ? " is-played" : ""}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
          <span
            className="funnel__voicePlayerThumb"
            style={{ left: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="funnel__voicePlayerTime">
          {fmtVoiceTime(displaySeconds)}
        </span>
      </div>
    </div>
  );
}
