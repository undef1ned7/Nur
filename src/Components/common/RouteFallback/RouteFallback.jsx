import "./RouteFallback.scss";

const RouteFallback = () => (
  <div className="route-fallback" role="status" aria-live="polite">
    <div className="route-fallback__spinner" />
  </div>
);

export default RouteFallback;
