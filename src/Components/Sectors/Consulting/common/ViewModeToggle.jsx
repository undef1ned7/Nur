import { LayoutGrid, Table2 } from "lucide-react";
import { VIEW_MODES } from "../../../../utils/consultingViewMode";
import "./ViewModeToggle.scss";

export default function ViewModeToggle({ viewMode, onChange, disabled = false }) {
  return (
    <div className="consulting-view-toggle" role="group" aria-label="Вид отображения">
      <button
        type="button"
        onClick={() => onChange(VIEW_MODES.TABLE)}
        className={`consulting-view-toggle__btn ${
          viewMode === VIEW_MODES.TABLE ? "consulting-view-toggle__btn--active" : ""
        }`}
        aria-pressed={viewMode === VIEW_MODES.TABLE}
        disabled={disabled}
      >
        <Table2 size={16} aria-hidden />
        Список
      </button>
      <button
        type="button"
        onClick={() => onChange(VIEW_MODES.CARDS)}
        className={`consulting-view-toggle__btn ${
          viewMode === VIEW_MODES.CARDS ? "consulting-view-toggle__btn--active" : ""
        }`}
        aria-pressed={viewMode === VIEW_MODES.CARDS}
        disabled={disabled}
      >
        <LayoutGrid size={16} aria-hidden />
        Карточки
      </button>
    </div>
  );
}
