import { useState, useRef } from "react";

/**
 * Хук для управления изображениями товара
 * @returns {Object} Состояние и методы для работы с изображениями
 */
export const useProductImages = () => {
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);

  /**
   * Добавляет новые изображения
   * @param {FileList|Array} files - Список файлов
   */
  const addImages = (files) => {
    const fileArray = files instanceof FileList ? Array.from(files) : (Array.isArray(files) ? files : []);
    const newImages = fileArray.map((file, idx) => ({
      file,
      alt: "",
      is_primary: images.length === 0 && idx === 0,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Удаляет изображение по индексу
   * @param {number} index - Индекс изображения
   */
  const removeImage = (index) => {
    const image = images[index];
    // revokeObjectURL только для blob-URL (свои файлы); для HTTP-URL (из API) не вызывать — иначе исключение и setImages не выполнится
    if (image?.preview && String(image.preview).startsWith("blob:")) {
      URL.revokeObjectURL(image.preview);
    }
    const newImages = images.filter((_, i) => i !== index);
    // Если удалили главное, назначаем первое как главное
    if (
      image?.is_primary &&
      newImages.length > 0 &&
      !newImages.some((p) => p.is_primary)
    ) {
      newImages[0] = { ...newImages[0], is_primary: true };
    }
    setImages(newImages);
  };

  /**
   * Устанавливает главное изображение
   * @param {number} index - Индекс изображения
   */
  const setPrimaryImage = (index) => {
    setImages((prev) =>
      prev.map((it, i) => ({
        ...it,
        is_primary: i === index,
      }))
    );
  };

  /**
   * Обновляет alt текст изображения
   * @param {number} index - Индекс изображения
   * @param {string} alt - Новый alt текст
   */
  const updateImageAlt = (index, alt) => {
    setImages((prev) =>
      prev.map((it, i) => (i === index ? { ...it, alt } : it))
    );
  };

  /**
   * Загружает изображения из API (для режима редактирования)
   * @param {Array} apiImages - Массив изображений из API
   */
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

  /**
   * Очищает все изображения
   */
  const clearImages = () => {
    images.forEach((img) => {
      if (img.preview && img.file) {
        URL.revokeObjectURL(img.preview);
      }
    });
    setImages([]);
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
  };
};

