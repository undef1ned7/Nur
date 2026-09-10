/**
 * Переключатель региона для консалтинга.
 *
 *  • owner/admin/rop — выпадающий список «Все регионы» + каждый регион;
 *  • supervisor с одним регионом — ничего не рендерит (скоуп фиксирован);
 *  • supervisor с несколькими — только его регионы, без «Все».
 *
 * Значение (`value`) — код региона или "" («все»). Наверх отдаётся тот же код.
 */
import { FaMapMarkerAlt } from "react-icons/fa";
import "./regionFilter.scss";

export default function RegionFilter({
  regions = [],
  scopedRegions = null,
  value = "",
  onChange,
  allowAll = true,
  disabled = false,
  size = "md",
}) {
  const list = scopedRegions || regions;
  if (!list.length) return null;
  // supervisor с единственным регионом — выбор не нужен.
  if (!allowAll && list.length === 1) return null;

  return (
    <label className={`cRegionFilter cRegionFilter--${size}`}>
      <FaMapMarkerAlt className="cRegionFilter__icon" aria-hidden />
      <select
        className="cRegionFilter__select"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-label="Регион"
      >
        {allowAll && <option value="">Все регионы</option>}
        {list.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
            {typeof r.open_leads === "number" && r.open_leads > 0
              ? ` (${r.open_leads})`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
