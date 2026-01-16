import React from "react";

/**
 * Компонент загрузки изображений товара
 */
const ProductImagesSection = ({
  images,
  fileInputRef,
  onImageAdd,
  onImageRemove,
  onSetPrimary,
}) => {
  return (
    <div className="market-product-form__section">
      <h3 className="market-product-form__section-title">Изображение</h3>
      <div className="market-product-form__image-upload">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              onImageAdd(files);
            }
          }}
        />
        <div
          className="market-product-form__image-placeholder"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = Array.from(e.dataTransfer.files || []).filter((f) =>
              f.type.startsWith("image/")
            );
            onImageAdd(files);
          }}
          style={{ cursor: "pointer" }}
        >
          <p>Выберите фото для загрузки</p>
          <p>или перетащите его мышью</p>
          <button
            type="button"
            className="market-product-form__image-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            +
          </button>
        </div>
        {images.length > 0 && (
          <div className="market-product-form__image-list">
            {images.map((img, idx) => (
              <div key={idx} className="market-product-form__image-item">
                <img
                  src={img.preview}
                  alt={img.alt || "Preview"}
                  className="market-product-form__image-preview"
                />
                <button
                  type="button"
                  className="market-product-form__image-remove"
                  onClick={() => onImageRemove(idx)}
                >
                  ×
                </button>
                {img.is_primary && (
                  <span className="market-product-form__image-primary">
                    Главное
                  </span>
                )}
                <button
                  type="button"
                  className="market-product-form__image-set-primary"
                  onClick={() => onSetPrimary(idx)}
                >
                  {img.is_primary ? "Главное" : "Сделать главным"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductImagesSection);

