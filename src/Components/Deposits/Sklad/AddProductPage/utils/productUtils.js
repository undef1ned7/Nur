/**
 * Утилиты для работы с товарами
 */

/**
 * Формирует payload для создания/обновления товара
 * @param {Object} params - Параметры товара
 * @returns {Object} Payload для API
 */
export const buildProductPayload = ({
  newItemData,
  marketData,
  itemType,
  weightProductsCount,
}) => {
  const {
    name,
    barcode,
    brand_name,
    category_name,
    price,
    quantity,
    client,
    purchase_price,
    plu,
  } = newItemData;

  // Нормализуем наценку
  const normalizedMarkup =
    marketData.markup !== undefined &&
    marketData.markup !== null &&
    String(marketData.markup).trim() !== ""
      ? String(marketData.markup)
      : "0";

  // Формируем характеристики
  const characteristics = {
    height_cm:
      marketData.height && marketData.height !== "0"
        ? marketData.height.toString()
        : null,
    width_cm:
      marketData.width && marketData.width !== "0"
        ? marketData.width.toString()
        : null,
    depth_cm:
      marketData.depth && marketData.depth !== "0"
        ? marketData.depth.toString()
        : null,
    factual_weight_kg:
      marketData.weight && marketData.weight !== "0"
        ? marketData.weight.toString()
        : null,
    description: marketData.description || "",
  };

  const hasCharacteristics =
    characteristics.height_cm !== null ||
    characteristics.width_cm !== null ||
    characteristics.depth_cm !== null ||
    characteristics.factual_weight_kg !== null ||
    (characteristics.description && characteristics.description.trim() !== "");

  // Определяем is_weight
  const isWeight =
    itemType === "product"
      ? marketData.isWeightProduct
      : itemType === "service"
      ? marketData.isFractionalService
      : false;

  // Генерируем PLU для весовых товаров
  let pluValue = null;
  if (isWeight) {
    if (marketData.plu && marketData.plu.trim() !== "") {
      pluValue = Number(marketData.plu);
    } else if (plu && plu.trim() !== "") {
      pluValue = Number(plu);
    } else {
      pluValue = weightProductsCount + 1;
    }
  }

  const finalPrice = price && price.trim() !== "" ? price.toString() : "0";

  // Определяем kind
  let kindValue = "product";
  if (itemType === "service") {
    kindValue = "service";
  } else if (itemType === "kit") {
    kindValue = "bundle";
  }

  let payload = {
    name,
    barcode: barcode || null,
    brand_name: brand_name || "",
    category_name: category_name || "",
    article: marketData.article || "",
    unit: marketData.unit || "шт",
    is_weight: isWeight,
    price: finalPrice,
    discount_percent: (marketData.discount || "0").toString(),
    country: marketData.country || "",
    expiration_date: marketData.expiryDate || null,
    client: client || null,
    plu: pluValue,
    description: marketData.description || "",
    characteristics: hasCharacteristics ? characteristics : null,
    kind: kindValue,
  };

  const quantityValue =
    quantity && quantity.toString().trim() !== "" ? Number(quantity) : 0;

  if (itemType === "product") {
    payload = {
      ...payload,
      purchase_price: (purchase_price || "0").toString(),
      markup_percent: normalizedMarkup,
      quantity: quantityValue,
      stock: true,
    };
  } else if (itemType === "service") {
    payload = {
      ...payload,
      purchase_price: "0",
      markup_percent: normalizedMarkup,
      quantity: 0,
      stock: false,
      is_weight: marketData.isFractionalService,
    };
  } else if (itemType === "kit") {
    const kitPackages = (marketData.kitProducts || [])
      .filter((product) => product.id)
      .map((product) => ({
        name: product.name || "",
        quantity_in_package: Number(product.quantity || 1),
        unit: product.unit || marketData.unit || "шт",
      }));

    const packagingItems = (marketData.packagings || [])
      .filter((pkg) => pkg.name && pkg.name.trim())
      .map((pkg) => ({
        name: pkg.name.trim(),
        quantity_in_package: Number(pkg.quantity || 1),
        unit: marketData.unit || "шт",
      }));

    const allPackages = [...kitPackages, ...packagingItems];

    payload = {
      ...payload,
      packages_input: allPackages.length > 0 ? allPackages : [],
      purchase_price: "0",
      markup_percent: normalizedMarkup,
      quantity: quantityValue,
      stock: false,
    };
  }

  return payload;
};

/**
 * Валидация данных товара
 * @param {Object} params - Параметры для валидации
 * @returns {Object} Объект с ошибками валидации
 */
export const validateProductData = ({
  newItemData,
  marketData,
  itemType,
}) => {
  const errors = {};
  const { name, barcode, price, purchase_price, quantity } = newItemData;

  if (!name || !name.trim()) {
    errors.name = "Обязательное поле";
  }
  if (!barcode || !barcode.trim()) {
    errors.barcode = "Обязательное поле";
  }

  const purchasePriceValue = purchase_price ? String(purchase_price) : "";
  const priceValue = price ? String(price) : "";

  if (itemType === "product") {
    if (purchasePriceValue.trim() === "") {
      errors.purchase_price = "Обязательное поле";
    }
    if (priceValue.trim() === "") {
      errors.price = "Обязательное поле";
    }
  }

  if (itemType === "service") {
    if (priceValue.trim() === "") {
      errors.price = "Обязательное поле";
    }
  }

  if (itemType === "kit") {
    if (priceValue.trim() === "") {
      errors.price = "Обязательное поле";
    }
    if (!marketData.kitProducts || marketData.kitProducts.length === 0) {
      errors.kitProducts = "Добавьте хотя бы один товар в комплект";
    }
  }

  return errors;
};

