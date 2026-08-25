import { useCallback, useRef, useState } from "react";

const filterImageFiles = (files) => {
  const fileArray =
    files instanceof FileList
      ? Array.from(files)
      : Array.isArray(files)
        ? files
        : [];
  return fileArray.filter((file) => file?.type?.startsWith("image/"));
};

const emptyCropperState = () => ({
  open: false,
  imageSrc: null,
  sourceFile: null,
  fileQueue: [],
});

/**
 * Хук для управления изображениями товара (с кроппером перед добавлением).
 * @returns {Object} Состояние и методы для работы с изображениями
 */
export const useProductImages = () => {
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);
  const [cropper, setCropper] = useState(emptyCropperState);

  const revokeCropperSrc = useCallback((src) => {
    if (src && String(src).startsWith("blob:")) {
      URL.revokeObjectURL(src);
    }
  }, []);

  const appendCroppedImage = useCallback((file) => {
    setImages((prev) => {
      const isFirst = prev.length === 0;
      return [
        ...prev,
        {
          file,
          alt: "",
          is_primary: isFirst,
          preview: URL.createObjectURL(file),
        },
      ];
    });
  }, []);

  /**
   * Ставит новые файлы в очередь кроппера (по одному).
   * @param {FileList|File[]} files
   */
  const addImages = useCallback(
    (files) => {
      const fileArray = filterImageFiles(files);
      if (fileArray.length === 0) return;

      setCropper((prev) => {
        if (prev.open) {
          return {
            ...prev,
            fileQueue: [...prev.fileQueue, ...fileArray],
          };
        }

        const [nextFile, ...rest] = fileArray;
        return {
          open: true,
          imageSrc: URL.createObjectURL(nextFile),
          sourceFile: nextFile,
          fileQueue: rest,
        };
      });
    },
    [],
  );

  const handleCropComplete = useCallback(
    async (_blob, croppedFile) => {
      appendCroppedImage(croppedFile);
      setCropper((prev) => {
        revokeCropperSrc(prev.imageSrc);
        const nextQueue = prev.fileQueue;
        if (nextQueue.length === 0) {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return emptyCropperState();
        }

        const [nextFile, ...rest] = nextQueue;
        return {
          open: true,
          imageSrc: URL.createObjectURL(nextFile),
          sourceFile: nextFile,
          fileQueue: rest,
        };
      });
    },
    [appendCroppedImage, revokeCropperSrc],
  );

  const handleCropCancel = useCallback(() => {
    setCropper((prev) => {
      revokeCropperSrc(prev.imageSrc);
      const nextQueue = prev.fileQueue;
      if (nextQueue.length === 0) {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return emptyCropperState();
      }

      const [nextFile, ...rest] = nextQueue;
      return {
        open: true,
        imageSrc: URL.createObjectURL(nextFile),
        sourceFile: nextFile,
        fileQueue: rest,
      };
    });
  }, [revokeCropperSrc]);

  /**
   * Удаляет изображение по индексу
   * @param {number} index
   */
  const removeImage = (index) => {
    setImages((prev) => {
      const image = prev[index];
      if (image?.preview && String(image.preview).startsWith("blob:")) {
        URL.revokeObjectURL(image.preview);
      }
      const newImages = prev.filter((_, i) => i !== index);
      if (
        image?.is_primary &&
        newImages.length > 0 &&
        !newImages.some((p) => p.is_primary)
      ) {
        newImages[0] = { ...newImages[0], is_primary: true };
      }
      return newImages;
    });
  };

  const setPrimaryImage = (index) => {
    setImages((prev) =>
      prev.map((it, i) => ({
        ...it,
        is_primary: i === index,
      })),
    );
  };

  const updateImageAlt = (index, alt) => {
    setImages((prev) =>
      prev.map((it, i) => (i === index ? { ...it, alt } : it)),
    );
  };

  const loadImagesFromAPI = (apiImages) => {
    if (apiImages && apiImages.length > 0) {
      const loadedImages = apiImages.map((img) => ({
        file: null,
        alt: img.alt || "",
        is_primary: img.is_primary || false,
        preview: img.image_url || img.image || "",
        id: img.id,
      }));
      setImages(loadedImages);
    }
  };

  const clearImages = () => {
    setImages((prev) => {
      prev.forEach((img) => {
        if (img.preview && img.file && String(img.preview).startsWith("blob:")) {
          URL.revokeObjectURL(img.preview);
        }
      });
      return [];
    });
    setCropper((prev) => {
      revokeCropperSrc(prev.imageSrc);
      return emptyCropperState();
    });
  };

  return {
    images,
    setImages,
    fileInputRef,
    addImages,
    removeImage,
    setPrimaryImage,
    updateImageAlt,
    loadImagesFromAPI,
    clearImages,
    cropperOpen: cropper.open,
    cropperImageSrc: cropper.imageSrc,
    cropperSourceFile: cropper.sourceFile,
    handleCropComplete,
    handleCropCancel,
  };
};
