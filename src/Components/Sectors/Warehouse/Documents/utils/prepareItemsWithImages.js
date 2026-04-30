const getImageSource = (image) => {
  if (!image) return "";
  if (typeof image === "string") return image;
  return (
    image.product_image_url ||
    image.image_url ||
    image.image ||
    image.url ||
    image.preview ||
    image.photo_url ||
    image.photo ||
    ""
  );
};

const toAbsoluteUrl = (src) => {
  if (!src || /^(data:|blob:)/i.test(src)) return src || "";
  if (/^https?:\/\//i.test(src)) return src;
  const base =
    import.meta.env?.VITE_API_URL?.replace(/\/api\/?$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${src.startsWith("/") ? "" : "/"}${src}` : src;
};

export const prepareItemsWithImages = async (items) => {
  return Promise.all(
    items.map(async (item) => {
      const rawSrc =
        item.product_image_url ||
        item.image_url ||
        getImageSource(
          Array.isArray(item.images) && item.images.length > 0
            ? item.images.find((img) => img?.is_primary) || item.images[0]
            : null,
        ) ||
        "";

      if (!rawSrc) return { ...item, imageDataUrl: "" };

      const absoluteSrc = toAbsoluteUrl(rawSrc);

      try {
        const dataUrl = await new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";

          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              canvas.getContext("2d").drawImage(img, 0, 0);
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch (e) {
              resolve(absoluteSrc);
            }
          };

          img.onerror = () => {
            resolve(absoluteSrc);
          };

          img.src = absoluteSrc;
        });

        return {
          ...item,
          imageDataUrl: dataUrl || absoluteSrc,
        };
      } catch (e) {
        return { ...item, imageDataUrl: absoluteSrc };
      }
    }),
  );
};
