import { useCallback } from "react";
import { useUser } from "../../../store/slices/userSlice";

/**
 * Хук для работы с permissions пользователя
 * Использует данные из Redux store вместо локальных запросов
 */
export const useMenuPermissions = () => {
  const { profile } = useUser();

  /**
   * Проверяет наличие permission у пользователя
   * @param {string} permission - название permission
   * @returns {boolean}
   */
  const hasPermission = useCallback(
    (permission) => {
      if (!profile || !permission) {
        return false;
      }
      return profile[permission] === true;
    },
    [profile]
  );

  /**
   * Проверяет доступность на уровне компании
   * @param {object} company - объект компании
   * @param {string} perm - название permission
   * @returns {boolean|undefined} - true/false если есть явная политика, undefined если нет
   */
  const companyAllows = useCallback((company, perm) => {
    if (!company) return undefined;
    if (Object.prototype.hasOwnProperty.call(company, perm)) {
      return company[perm] === true;
    }
    return undefined;
  }, []);

  /**
   * Комплексная проверка доступа (пользователь + компания)
   * @param {object} company - объект компании
   * @param {string} perm - название permission
   * @returns {boolean}
   */
  const isAllowed = useCallback(
    (company, perm) => {
      const userOk = hasPermission(perm);
      const companyOk = companyAllows(company, perm);
      if (companyOk === false) return false; // компания явно запретила
      return userOk || companyOk === true; // разрешено либо пользователю, либо компанией
    },
    [hasPermission, companyAllows]
  );

  return {
    hasPermission,
    companyAllows,
    isAllowed,
    profile,
  };
};
