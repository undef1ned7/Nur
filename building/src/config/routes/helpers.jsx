import { Suspense } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../../ProtectedRoute";
import RouteFallback from "@/Components/common/RouteFallback/RouteFallback";

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
