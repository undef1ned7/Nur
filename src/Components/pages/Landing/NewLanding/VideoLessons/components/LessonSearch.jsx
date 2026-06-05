import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

const LessonSearch = ({ value, onChange }) => {
  const { t } = useTranslation("newLanding");

  return (
    <label className="vl-search">
      <Search size={18} className="vl-search__icon" aria-hidden />
      <input
        type="search"
        className="vl-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("videoLessons.searchPlaceholder")}
      />
    </label>
  );
};

export default LessonSearch;
