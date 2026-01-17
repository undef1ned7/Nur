import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../api";
import { getCompany } from "../../../store/creators/userCreators";
import { getProfile, useUser } from "../../../store/slices/userSlice";
import {
  isAllowedPathWithoutToken,
  shouldRedirectToCrm,
  clearTokens,
} from "../../../utils/authUtils";
import {
  DEFAULT_AUTHENTICATED_PATH,
  DEFAULT_UNAUTHENTICATED_PATH,
} from "../../../constants/routes";
import Loading from "../../common/Loading/Loading";

/**
 * Компонент для проверки аутентификации при загрузке приложения
 * @param {Object} props
 * @param {React.ReactNode} props.children - Дочерние компоненты
 * @param {Function} props.onProfileLoaded - Callback при загрузке профиля
 */
const AuthGuard = ({ children, onProfileLoaded }) => {
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const dispatch = useDispatch();
  const { accessToken } = useUser();
  const { profile, loading } = useUser();

  const getProfileFunc = useCallback(async () => {
    dispatch(getProfile())
  }, [])
  useEffect(() => {
    if (loading) return;
    if (onProfileLoaded) {
      onProfileLoaded(profile);
    }
  }, [dispatch, loading])

  useEffect(() => {
    const checkTokenValidity = async () => {
      const token = localStorage.getItem("accessToken");
      const currentPath = window.location.pathname;

      // Если токена нет и мы не на публичной странице
      if (!token) {
        if (!isAllowedPathWithoutToken(currentPath)) {
          window.location.href = DEFAULT_UNAUTHENTICATED_PATH;
          return;
        }
        setIsCheckingToken(false);
        return;
      }

      // Проверяем валидность токена через API
      try {
        // const response = await api.get("/users/profile/");
        await getProfileFunc();

        // Если токен валиден и мы на публичной странице - редирект на /crm
        if (shouldRedirectToCrm(currentPath)) {
          window.location.href = DEFAULT_AUTHENTICATED_PATH;
          return;
        }
      } catch (err) {
        // Токен невалиден или ошибка при проверке - очищаем и редиректим на логин
        console.error("Ошибка проверки токена:", err);
        clearTokens();

        if (!isAllowedPathWithoutToken(currentPath)) {
          window.location.href = DEFAULT_UNAUTHENTICATED_PATH;
          return;
        }
      } finally {
        setIsCheckingToken(false);
      }
    };

    checkTokenValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Запускаем только один раз при монтировании

  useEffect(() => {
    if (accessToken) {
      dispatch(getCompany());
    }
  }, [accessToken, dispatch]);

  if (isCheckingToken) {
    return <Loading />;
  }

  return <>{children}</>;
};

export default AuthGuard;
