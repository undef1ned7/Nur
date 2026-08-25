const DEFAULT_QUALITY = 0.85;

/**
 * @param {string} imageSrc
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = imageSrc;
  });
}

/**
 * @param {number} degreeValue
 * @returns {number}
 */
export function getRadianAngle(degreeValue) {
  return (normalizeRotation(degreeValue) * Math.PI) / 180;
}

/**
 * Нормализует угол поворота в диапазон 0–360.
 * @param {number} rotation
 * @returns {number}
 */
export function normalizeRotation(rotation) {
  const n = Number(rotation) || 0;
  return ((n % 360) + 360) % 360;
}

/**
 * Размер bounding box повёрнутого прямоугольника (react-easy-crop recipe).
 * @param {number} width
 * @param {number} height
 * @param {number} rotation
 */
export function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * @param {string} [mimeType]
 * @returns {'image/jpeg' | 'image/webp'}
 */
export function resolveOutputMimeType(mimeType) {
  if (mimeType === "image/webp") {
    return "image/webp";
  }
  return "image/jpeg";
}

/**
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {string}
 */
export function buildCroppedFileName(originalName, mimeType) {
  const safeName = String(originalName || "image").trim() || "image";
  const base = safeName.replace(/\.[^.]+$/, "");
  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  return `${base}.${ext}`;
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {File}
 */
export function blobToFile(blob, fileName, mimeType) {
  return new File([blob], fileName, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

/**
 * Обрезка изображения через canvas (паттерн react-easy-crop, с поддержкой rotation).
 *
 * @param {string} imageSrc — data URL или blob URL
 * @param {{ x: number, y: number, width: number, height: number }} croppedAreaPixels
 * @param {{ quality?: number, mimeType?: string, fileName?: string, rotation?: number }} [outputOptions]
 * @returns {Promise<{ blob: Blob, file: File, mimeType: string }>}
 */
export async function getCroppedImg(
  imageSrc,
  croppedAreaPixels,
  outputOptions = {},
) {
  if (!croppedAreaPixels?.width || !croppedAreaPixels?.height) {
    throw new Error("Invalid crop area");
  }

  const quality = outputOptions.quality ?? DEFAULT_QUALITY;
  const mimeType = resolveOutputMimeType(outputOptions.mimeType);
  const rotation = normalizeRotation(outputOptions.rotation ?? 0);
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation,
  );

  canvas.width = Math.round(bBoxWidth);
  canvas.height = Math.round(bBoxHeight);

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) {
    throw new Error("Canvas 2D context is not available");
  }

  croppedCanvas.width = Math.round(croppedAreaPixels.width);
  croppedCanvas.height = Math.round(croppedAreaPixels.height);

  croppedCtx.drawImage(
    canvas,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  );

  const blob = await new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(result);
      },
      mimeType,
      quality,
    );
  });

  const fileName = buildCroppedFileName(outputOptions.fileName, mimeType);
  const file = blobToFile(blob, fileName, mimeType);

  return { blob, file, mimeType };
}
