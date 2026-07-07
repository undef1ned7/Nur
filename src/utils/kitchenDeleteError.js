import { validateResErrors } from "../../tools/validateResErrors";

const GENERIC_DELETE_PATTERNS = [
  /request failed with status code/i,
  /^internal server error$/i,
  /^server error/i,
  /integrity/i,
  /foreign key/i,
  /protected/i,
  /constraint/i,
  /cannot delete/i,
  /related/i,
  /referenced/i,
];

const isGenericDeleteMessage = (message) => {
  const text = String(message ?? "").trim();
  if (!text) return true;
  return GENERIC_DELETE_PATTERNS.some((pattern) => pattern.test(text));
};

export const getKitchenDeleteErrorMessage = (error, kitchenName = "кухня") => {
  const status = error?.response?.status;
  const extracted = validateResErrors(error, "");

  const looksLikeRelatedEntitiesError =
    status === 500 ||
    status === 409 ||
    isGenericDeleteMessage(extracted);

  if (looksLikeRelatedEntitiesError) {
    return (
      `Кухню «${kitchenName}» сейчас нельзя удалить — к ней привязаны блюда из меню, заказы или другие данные. ` +
      `Переназначьте связанные позиции на другую кухню и попробуйте снова. ` +
      `Мы уже работаем над тем, чтобы удаление в таких случаях было понятнее и безопаснее.`
    );
  }

  return (
    extracted ||
    `Не удалось удалить кухню «${kitchenName}». Попробуйте ещё раз чуть позже.`
  );
};
