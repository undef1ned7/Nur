import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Maximize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getVideoSource } from "../utils";

const VideoPlayer = ({ url, title }) => {
  const { t } = useTranslation("newLanding");
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const source = getVideoSource(url);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [url]);

  if (source.type === "none") {
    return (
      <div className="vl-player vl-player--empty">
        <span>{t("videoLessons.playerUnavailable")}</span>
      </div>
    );
  }

  if (source.type === "iframe") {
    return (
      <div className="vl-player vl-player--embed">
        <iframe
          src={source.src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video?.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width)
    );
    video.currentTime = ratio * video.duration;
    setProgress(ratio * 100);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div className="vl-player vl-player--native" ref={containerRef}>
      <video
        ref={videoRef}
        src={source.src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setPlaying(false)}
        onClick={togglePlay}
        playsInline
      />

      <div className="vl-player__controls">
        <div className="vl-player__controls-left">
          <button
            type="button"
            className="vl-player__btn"
            onClick={togglePlay}
            aria-label={
              playing ? t("videoLessons.playerPause") : t("videoLessons.playerPlay")
            }
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            type="button"
            className="vl-player__btn"
            onClick={toggleMute}
            aria-label={
              muted ? t("videoLessons.playerUnmute") : t("videoLessons.playerMute")
            }
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <div
          className="vl-player__progress"
          onClick={handleSeek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-valuenow={(progress / 100) * (duration || 0)}
          tabIndex={0}
        >
          <div
            className="vl-player__progress-fill"
            style={{ width: `${progress}%` }}
          />
          <span
            className="vl-player__progress-thumb"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="vl-player__controls-right">
          <button
            type="button"
            className="vl-player__btn"
            onClick={toggleFullscreen}
            aria-label={t("videoLessons.playerFullscreen")}
          >
            <Maximize size={18} />
          </button>
          <button
            type="button"
            className="vl-player__btn vl-player__btn--disabled"
            aria-label={t("videoLessons.playerSettings")}
            disabled
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
