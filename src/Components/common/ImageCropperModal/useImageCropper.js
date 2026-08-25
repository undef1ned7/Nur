import { useCallback, useRef, useState } from "react";

/**
 * Состояние crop/zoom/rotation для react-easy-crop.
 */
export function useImageCropper(initialZoom = 1) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const croppedAreaPixelsRef = useRef(null);

  const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
    croppedAreaPixelsRef.current = croppedPixels;
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const resetCropper = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(initialZoom);
    setRotation(0);
    setCroppedAreaPixels(null);
    croppedAreaPixelsRef.current = null;
  }, [initialZoom]);

  const resetCropperView = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(initialZoom);
    setRotation(0);
  }, [initialZoom]);

  return {
    crop,
    setCrop,
    zoom,
    setZoom,
    rotation,
    setRotation,
    croppedAreaPixels,
    croppedAreaPixelsRef,
    onCropComplete,
    resetCropper,
    resetCropperView,
  };
}
