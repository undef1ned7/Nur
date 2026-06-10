import { Suspense } from "react";
import { Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../../ProtectedRoute";
import RouteFallback from "../../Components/common/RouteFallback/RouteFallback";
import ProductionStartAgentGate from "../../Components/Sectors/Production/ProductionStartAgentGate";
import WarehouseStartAgentGate from "../../Components/Sectors/Warehouse/WarehouseStartAgentGate";

export const createProtectedRoute = (path, Component, props) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <Component />
        </Suspense>
      </ProtectedRoute>
    }
    {...props}
  />
);

export const createPermissionProtectedRoute = (
  path,
  Component,
  permissionKey,
  profile,
  props,
) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          {profile?.[permissionKey] ? (
            <Component />
          ) : (
            <Navigate to="/crm/cafe/menu" replace />
          )}
        </Suspense>
      </ProtectedRoute>
    }
    {...props}
  />
);

/** Производство: маршруты с агентом недоступны на тарифе «Старт». */
export const createProductionAgentProtectedRoute = (path, Component, props) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <ProductionStartAgentGate>
          <Suspense fallback={<RouteFallback />}>
            <Component />
          </Suspense>
        </ProductionStartAgentGate>
      </ProtectedRoute>
    }
    {...props}
  />
);

/** Склад: маршруты агента недоступны на тарифе «Старт». */
export const createWarehouseAgentProtectedRoute = (path, Component, props) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute>
        <WarehouseStartAgentGate>
          <Suspense fallback={<RouteFallback />}>
            <Component />
          </Suspense>
        </WarehouseStartAgentGate>
      </ProtectedRoute>
    }
    {...props}
  />
);
