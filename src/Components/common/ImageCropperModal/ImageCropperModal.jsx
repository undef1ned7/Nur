import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { RotateCcw, RotateCw, X } from "lucide-react";
import ReactPortal from "../Portal/ReactPortal";
import { useImageCropper } from "./useImageCropper";
import { getCroppedImg } from "./cropImage";
import styles from "./ImageCropperModal.module.scss";

/**
 * Переиспользуемая модалка обрезки изображения (react-easy-crop + canvas export).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string|null} props.imageSrc — blob/data URL
 * @param {File|null} [props.sourceFile] — исходный File (имя и mime для экспорта)
 * @param {number} [props.aspectRatio=1]
 * @param {(blob: Blob, file: File) => void | Promise<void>} props.onCropComplete
 * @param {() => void} props.onClose
 */
const ImageCropperModal = ({
  open,
  imageSrc,
  sourceFile = null,
  aspectRatio = 1,
  onCropComplete,
  onClose,
}) => {
  const {
    crop,
    setCrop,
    zoom,
    setZoom,
    rotation,
    setRotation,
    croppedAreaPixels,
    croppedAreaPixelsRef,
    onCropComplete: handleCropAreaChange,
    resetCropper,
    resetCropperView,
  } = useImageCropper(1);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      resetCropper();
      setError("");
      setApplying(false);
      return;
    }
    resetCropperView();
    setError("");
    setApplying(false);
  }, [open, imageSrc, resetCropper, resetCropperView]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !imageSrc) {
    return null;
  }

  const handleApply = async () => {
    const pixels = croppedAreaPixelsRef.current || croppedAreaPixels;
    if (!pixels) {
      setError("Подождите, пока изображение загрузится для обрезки");
      return;
    }

    setApplying(true);
    setError("");
    try {
      const { blob, file } = await getCroppedImg(imageSrc, pixels, {
        fileName: sourceFile?.name,
        mimeType: sourceFile?.type,
        rotation,
      });
      await onCropComplete(blob, file);
    } catch (err) {
      console.error("Image crop failed:", err);
      setError("Не удалось обрезать изображение. Попробуйте ещё раз.");
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => {
    resetCropper();
    onClose();
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !applying) {
      handleCancel();
    }
  };

  const handleRotateCw = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateCcw = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  return (
    <ReactPortal wrapperId="image-cropper-modal">
      <div
        className={styles.overlay}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-cropper-title"
      >
        <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h2 id="image-cropper-title" className={styles.title}>
              Обрезка изображения
            </h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleCancel}
              disabled={applying}
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          </div>

          <div className={styles.cropArea}>
            <Cropper
              key={imageSrc}
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropAreaChange}
            />
          </div>

          <div className={styles.controls}>
            <label className={styles.zoomLabel} htmlFor="image-cropper-zoom">
              Масштаб
            </label>
            <input
              id="image-cropper-zoom"
              className={styles.zoomSlider}
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />

            <label className={styles.zoomLabel} htmlFor="image-cropper-rotation">
              Поворот
            </label>
            <div className={styles.rotationRow}>
              <button
                type="button"
                className={styles.rotateBtn}
                onClick={handleRotateCcw}
                disabled={applying}
                aria-label="Повернуть против часовой стрелки на 90°"
                title="Повернуть на 90° против часовой"
              >
                <RotateCcw size={18} />
              </button>
              <input
                id="image-cropper-rotation"
                className={styles.zoomSlider}
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
              />
              <button
                type="button"
                className={styles.rotateBtn}
                onClick={handleRotateCw}
                disabled={applying}
                aria-label="Повернуть по часовой стрелке на 90°"
                title="Повернуть на 90° по часовой"
              >
                <RotateCw size={18} />
              </button>
            </div>
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleCancel}
              disabled={applying}
            >
              Отмена
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? "Применение…" : "Применить"}
            </button>
          </div>
        </div>
      </div>
    </ReactPortal>
  );
};

export default ImageCropperModal;
