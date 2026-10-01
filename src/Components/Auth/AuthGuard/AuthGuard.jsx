import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { getCompany } from "../../../store/creators/userCreators";
import {
  getProfile,
  refreshProfileSilently,
  useUser,
} from "../../../store/slices/userSlice";
import {
  isAllowedPathWithoutToken,
  shouldRedirectToCrm,
  clearTokens,
} from "../../../utils/authUtils";
import {
  tryRedirectToBuildingApp,
  shouldSkipBuildingRedirect,
  clearSkipBuildingRedirectParam,
  tryRedirectToMarketApp,
  shouldSkipMarketRedirect,
  clearSkipMarketRedirectParam,
} from "../../../utils/crossAppAuth";
import { captureBuildingAppUrlFromSearch, captureMarketAppUrlFromSearch } from "../../../utils/appUrls";
import { getCompanySubscriptionStatus } from "../../../utils/companySubscription";
import {
  DEFAULT_AUTHENTICATED_PATH,
  DEFAULT_UNAUTHENTICATED_PATH,
} from "../../../constants/routes";
import Loading from "../../common/Loading/Loading";

/** Не чаще раза в этот интервал — иначе каждое переключение вкладок бьёт по API. */
const PROFILE_REFRESH_MIN_INTERVAL_MS = 30_000;

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
  const lastProfileRefreshRef = useRef(0);

  const getProfileFunc = useCallback(async () => {
    await dispatch(getProfile()).unwrap();
    lastProfileRefreshRef.current = Date.now();
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
      const searchParams = new URLSearchParams(window.location.search);

      // Logout из building (stroy): токены на stage живут в другом origin —
      // без очистки AuthGuard сразу вернёт в stroy.
      const logoutFromBuilding = searchParams.get("logout") === "1";
      if (logoutFromBuilding || currentPath === "/crm/logout") {
        clearTokens();
        localStorage.removeItem("userId");
        localStorage.removeItem("userData");

        if (logoutFromBuilding) {
          searchParams.delete("logout");
          const search = searchParams.toString();
          const cleanUrl =
            window.location.pathname +
            (search ? `?${search}` : "") +
            window.location.hash;
          window.history.replaceState({}, "", cleanUrl);
        }

        if (currentPath === "/crm/logout") {
          window.location.replace("/login");
          return;
        }

        setIsCheckingToken(false);
        return;
      }

      captureBuildingAppUrlFromSearch();
      captureMarketAppUrlFromSearch();

      const token = localStorage.getItem("accessToken");
      if (!token) {
        if (!isAllowedPathWithoutToken(currentPath)) {
          window.location.href = DEFAULT_UNAUTHENTICATED_PATH;
          return;
        }
        setIsCheckingToken(false);
        return;
      }

      if (!navigator.onLine) {
        console.warn("AuthGuard: нет сети, токен принят без проверки");
        setIsCheckingToken(false);
        return;
      }

      try {
        await getProfileFunc();

        const skipBuilding = shouldSkipBuildingRedirect();
        const skipMarket = shouldSkipMarketRedirect();
        if (skipBuilding) clearSkipBuildingRedirectParam();
        if (skipMarket) clearSkipMarketRedirectParam();

        if (!skipBuilding && !skipMarket) {
          const company = await dispatch(getCompany()).unwrap();
          const subscription = getCompanySubscriptionStatus(company);
          const wantsAppEntry =
            shouldRedirectToCrm(currentPath) ||
            currentPath.startsWith("/crm/building") ||
            currentPath.startsWith("/crm/market");

          // Истёкшая подписка: не пускаем в CRM/building/market, оставляем на лендинге
          if (
            wantsAppEntry &&
            !subscription.ok &&
            subscription.reason !== "unknown"
          ) {
            if (currentPath !== "/") {
              window.location.replace("/");
              return;
            }
            setIsCheckingToken(false);
            return;
          }

          if (wantsAppEntry) {
            const buildingHandoff = tryRedirectToBuildingApp(company, currentPath);
            if (buildingHandoff === "redirected") {
              return;
            }

            const marketHandoff = tryRedirectToMarketApp(company, currentPath);
            if (marketHandoff === "redirected") {
              return;
            }
          }
        }

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
  }, []);

  // Только при смене токена (вход под другим пользователем). Начальный токен
  // обрабатывает checkTokenValidity выше — иначе на старте уходит лишний company/.
  const prevAccessTokenRef = useRef(accessToken);
  useEffect(() => {
    if (prevAccessTokenRef.current === accessToken) return;
    prevAccessTokenRef.current = accessToken;
    if (accessToken) {
      dispatch(getCompany());
    }
  }, [accessToken, dispatch]);

  // Роль/права могут поменять на бэке, пока вкладка открыта (см.
  // docs — жалоба «после смены роли на owner доступ не появился без
  // перезахода»). Профиль грузится один раз при старте (checkTokenValidity
  // выше), поэтому при возврате на вкладку тихо подтягиваем актуальный —
  // без state.loading, чтобы не мигать спиннерами в других компонентах.
  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (!localStorage.getItem("accessToken")) return;
      const now = Date.now();
      if (now - lastProfileRefreshRef.current < PROFILE_REFRESH_MIN_INTERVAL_MS) {
        return;
      }
      lastProfileRefreshRef.current = now;
      dispatch(refreshProfileSilently());
    };
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [dispatch]);

  if (isCheckingToken) {
    return <Loading />;
  }

  return <>{children}</>;
};

export default AuthGuard;
