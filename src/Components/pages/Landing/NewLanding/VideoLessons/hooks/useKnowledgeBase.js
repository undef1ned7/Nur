import { useCallback, useEffect, useState } from "react";
import { fetchKnowledgeBaseCourses } from "../../../../../../api/knowledgeBase";

export function useKnowledgeBase() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchKnowledgeBaseCourses();
      setCourses(data);
    } catch (err) {
      setError(err.message || "Ошибка загрузки");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { courses, loading, error, reload: load };
}
