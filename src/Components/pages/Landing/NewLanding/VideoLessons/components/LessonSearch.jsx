import { Search } from "lucide-react";

const LessonSearch = ({ value, onChange, placeholder = "Поиск по видеоурокам" }) => (
  <label className="vl-search">
    <Search size={18} className="vl-search__icon" aria-hidden />
    <input
      type="search"
      className="vl-search__input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </label>
);

export default LessonSearch;
