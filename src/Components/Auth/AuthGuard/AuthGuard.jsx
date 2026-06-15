import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
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
    await dispatch(getProfile()).unwrap();
  }, [dispatch]);
  useEffect(() => {
    if (loading) return;
    if (onProfileLoaded) {
      onProfileLoaded(profile);
    }
  }, [dispatch, loading]);

  useEffect(() => {
    const checkTokenValidity = async () => {
      const currentPath = window.location.pathname;

      if (currentPath === "/crm/logout") {
        clearTokens();
        localStorage.removeItem("userId");
        setIsCheckingToken(false);
        return;
      }

      const token = localStorage.getItem("accessToken");

      // Если токена нет и мы не на публичной странице
      if (!token) {
        if (!isAllowedPathWithoutToken(currentPath)) {
          window.location.href = DEFAULT_UNAUTHENTICATED_PATH;
          return;
        }
        setIsCheckingToken(false);
        return;
      }

      // Если нет сети — доверяем токену, не делаем API-запрос
      if (!navigator.onLine) {
        console.warn("AuthGuard: нет сети, токен принят без проверки");
        setIsCheckingToken(false);
        return;
      }

      // Проверяем валидность токена через API
      try {
        await getProfileFunc();

        // Если токен валиден и мы на публичной странице - редирект на /crm
        if (shouldRedirectToCrm(currentPath)) {
          window.location.href = DEFAULT_AUTHENTICATED_PATH;
          return;
        }
      } catch (err) {
        const isNetworkError =
          !err?.response &&
          (err?.code === "ERR_NETWORK" ||
            err?.code === "ECONNABORTED" ||
            err?.message === "Network Error" ||
            !navigator.onLine);

        if (isNetworkError) {
          console.warn("AuthGuard: нет сети, сессия сохранена");
        } else {
          console.error("Ошибка проверки токена:", err);
          clearTokens();

          if (!isAllowedPathWithoutToken(currentPath)) {
            window.location.href = DEFAULT_UNAUTHENTICATED_PATH;
            return;
          }
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
