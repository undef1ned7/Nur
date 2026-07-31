/**
 * Общая оболочка экранов Consulting: header + опциональный nav + белая панель.
 * Визуальный эталон — Лиды / Воронка.
 */
import "./consultingShell.scss";

export default function ConsultingShell({
  eyebrow = "Консалтинг",
  title,
  subtitle,
  headerActions = null,
  nav = null,
  navValue = null,
  onNavChange = null,
  panelTitle = null,
  panelHint = null,
  children,
  className = "",
}) {
  const activeNav =
    (Array.isArray(nav) && nav.find((n) => n.value === navValue)) ||
    (Array.isArray(nav) && nav[0]) ||
    null;

  const showPanelHead =
    panelTitle != null ||
    panelHint != null ||
    (activeNav && (activeNav.label || activeNav.hint));

  return (
    <section className={`cShell ${className}`.trim()}>
      <header className="cShell__header">
        <div className="cShell__heading">
          {eyebrow ? <p className="cShell__eyebrow">{eyebrow}</p> : null}
          <h1 className="cShell__title">{title}</h1>
          {subtitle ? <p className="cShell__subtitle">{subtitle}</p> : null}
        </div>
        {headerActions ? (
          <div className="cShell__headerActions">{headerActions}</div>
        ) : null}
      </header>

      {Array.isArray(nav) && nav.length > 0 ? (
        <nav className="cShell__nav" aria-label="Разделы">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = String(navValue) === String(item.value);
            return (
              <button
                key={item.value}
                type="button"
                className={`cShell__navItem${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onNavChange?.(item.value)}
              >
                {Icon ? (
                  <span className="cShell__navIcon" aria-hidden>
                    <Icon />
                  </span>
                ) : null}
                <span className="cShell__navText">
                  <span className="cShell__navLabel">{item.label}</span>
                  {item.hint ? (
                    <span className="cShell__navHint">{item.hint}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      ) : null}

      <div className="cShell__panel">
        {showPanelHead ? (
          <div className="cShell__panelHead">
            <h2 className="cShell__panelTitle">
              {panelTitle ?? activeNav?.label}
            </h2>
            {(panelHint ?? activeNav?.hint) ? (
              <p className="cShell__panelHint">
                {panelHint ?? activeNav?.hint}
              </p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
