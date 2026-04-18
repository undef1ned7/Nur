/**
 * Утилиты для работы с товарами
 */

const MAX_PROMOTION_TIERS = 30;

/** Нормализация ступеней акции из API (поле promotion_rules) в состояние формы */
export const normalizePromotionRulesFromApi = (rules) => {
  if (!Array.isArray(rules)) return [];
  return rules.slice(0, MAX_PROMOTION_TIERS).map((r, idx) => ({
    id: `promo-${idx}-${r?.position ?? idx}`,
    position: r?.position != null ? Number(r.position) : idx,
    min_amount: r?.min_amount != null ? String(r.min_amount) : "",
    discount_percent:
      r?.discount_percent != null ? String(r.discount_percent) : "",
    promo_quantity:
      r?.promo_quantity === null || r?.promo_quantity === undefined
        ? ""
        : String(r.promo_quantity),
  }));
};

/** Проверка одной строки ступени (для включения в promotion_rules_input) */
export const isValidPromotionRow = (r) => {
  const min = parseFloat(String(r?.min_amount ?? "").replace(",", "."));
  const disc = parseFloat(String(r?.discount_percent ?? "").replace(",", "."));
  if (!Number.isFinite(min) || min < 0) return false;
  if (!Number.isFinite(disc) || disc < 0.01 || disc > 100) return false;
  const pq = r?.promo_quantity;
  if (pq !== "" && pq !== null && pq !== undefined && String(pq).trim() !== "") {
    const n = Number(String(pq).replace(",", "."));
    if (!Number.isFinite(n) || n < 1) return false;
  }
  return true;
};

/**
 * Тело для API: promotion_rules_input (и совместимо promotion_rules)
 * @param {Array} rules — строки из состояния формы
 */
export const buildPromotionRulesInput = (rules) => {
  if (!Array.isArray(rules)) return [];
  const withPos = rules.map((r, idx) => ({
    ...r,
    position:
      r?.position != null && r.position !== ""
        ? Number(r.position)
        : idx,
  }));
  withPos.sort((a, b) => Number(a.position) - Number(b.position));
  const out = [];
  for (const r of withPos) {
    if (!isValidPromotionRow(r)) continue;
    const row = {
      position: out.length,
      min_amount: String(r.min_amount ?? "0").replace(",", "."),
      discount_percent: String(r.discount_percent ?? "0").replace(",", "."),
    };
    const pq = r.promo_quantity;
    if (pq !== "" && pq != null && String(pq).trim() !== "") {
      row.promo_quantity = Math.floor(Number(String(pq).replace(",", ".")));
    }
    out.push(row);
    if (out.length >= MAX_PROMOTION_TIERS) break;
  }
  return out;
};

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
    hotkey_group:
      String(marketData.hotkeyGroup || "")
        .trim()
        .toUpperCase() || null,
    description: marketData.description || "",
    characteristics: hasCharacteristics ? characteristics : null,
    kind: kindValue,
  };

  const quantityValue =
    quantity && quantity.toString().trim() !== "" ? Number(quantity) : 0;

  const stockPromotional = Boolean(marketData.stock);
  const promotionRulesInput = stockPromotional
    ? buildPromotionRulesInput(marketData.promotionRules || [])
    : [];
  const isPieceSaleEnabled =
    itemType === "product" ? Boolean(marketData.enablePieceSale) : true;

  const packagingItems = (marketData.packagings || [])
    .filter((pkg) => pkg.name && String(pkg.name).trim())
    .map((pkg) => {
      const quantityInPackage = Number(pkg.quantity || 1);
      const pieceUnitPriceRaw = String(
        pkg.piece_unit_price ?? pkg.pieceUnitPrice ?? "",
      )
        .trim()
        .replace(",", ".");
      const parsedPieceUnitPrice = Number(pieceUnitPriceRaw);
      return {
        name: String(pkg.name).trim(),
        quantity_in_package: quantityInPackage > 0 ? quantityInPackage : 1,
        unit: marketData.unit || "шт",
        piece_unit_price:
          pieceUnitPriceRaw !== "" && Number.isFinite(parsedPieceUnitPrice)
            ? pieceUnitPriceRaw
            : "0",
      };
    });

  if (itemType === "product") {
    payload = {
      ...payload,
      purchase_price: (purchase_price || "0").toString(),
      markup_percent: normalizedMarkup,
      quantity: quantityValue,
      stock: stockPromotional,
      promotion_rules_input: promotionRulesInput,
      packages_input: isPieceSaleEnabled ? packagingItems : [],
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
        piece_unit_price: "0",
      }));

    const kitPackagingItems = (marketData.packagings || [])
      .filter((pkg) => pkg.name && pkg.name.trim())
      .map((pkg) => ({
        name: pkg.name.trim(),
        quantity_in_package: Number(pkg.quantity || 1),
        unit: marketData.unit || "шт",
        piece_unit_price: String(
          pkg.piece_unit_price ?? pkg.pieceUnitPrice ?? "0",
        )
          .trim()
          .replace(",", "."),
      }));

    const allPackages = [...kitPackages, ...kitPackagingItems];

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

  if (itemType === "product" && marketData.stock) {
    const rules = marketData.promotionRules || [];
    const built = buildPromotionRulesInput(rules);
    if (built.length === 0) {
      const partial = rules.some((r) => {
        const hasAny =
          String(r?.min_amount ?? "").trim() ||
          String(r?.discount_percent ?? "").trim() ||
          String(r?.promo_quantity ?? "").trim();
        return hasAny && !isValidPromotionRow(r);
      });
      errors.promotion_rules = partial
        ? "Проверьте ступени: сумма от ≥ 0, скидка 0,01–100%, лимит шт. — целое ≥ 1 или пусто"
        : "Для акционного товара добавьте хотя бы одну ступень скидки";
    }
  }

  if (itemType === "product" && Boolean(marketData.enablePieceSale)) {
    const packagings = Array.isArray(marketData.packagings)
      ? marketData.packagings.filter((pkg) => String(pkg?.name || "").trim())
      : [];
    const hasInvalidPackaging = packagings.some((pkg) => {
      const qty = Number(pkg?.quantity);
      const piecePriceStr = String(
        pkg?.piece_unit_price ?? pkg?.pieceUnitPrice ?? "",
      )
        .trim()
        .replace(",", ".");
      const piecePrice = Number(piecePriceStr);
      return !(qty > 0) || piecePriceStr === "" || !Number.isFinite(piecePrice) || piecePrice < 0;
    });
    if (hasInvalidPackaging) {
      errors.packagings =
        "Для каждой упаковки заполните количество > 0 и цену за штуку (>= 0)";
    }
  }

  return errors;
};

