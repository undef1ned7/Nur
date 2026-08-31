/* eslint-disable react-refresh/only-export-components */
import { lazy } from "react";
import { Route } from "react-router-dom";
import PlatformAdminGuard from "../../Components/pages/PlatformAdmin/PlatformAdminGuard";

const PlatformAdminLayout = lazy(
  () => import("../../Components/pages/PlatformAdmin/PlatformAdminLayout"),
);
const CompaniesList = lazy(
  () => import("../../Components/pages/PlatformAdmin/CompaniesList"),
);
const CompanyDetail = lazy(
  () => import("../../Components/pages/PlatformAdmin/CompanyDetail"),
);

/**
 * Платформенная админка NUR — вне /crm, без проверки подписки компании.
 */
export const platformAdminRoutes = (
  <Route
    key="/platform-admin"
    path="/platform-admin"
    element={
      <PlatformAdminGuard>
        <PlatformAdminLayout />
      </PlatformAdminGuard>
    }
  >
    <Route index element={<CompaniesList />} />
    <Route path="companies/:id" element={<CompanyDetail />} />
  </Route>
);
