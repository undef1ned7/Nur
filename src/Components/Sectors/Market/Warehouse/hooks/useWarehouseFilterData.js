import { useEffect, useRef, useState } from "react";
import api from "../../../../../api";
import { useWarehouseReferences } from "./useWarehouseData";

/**
 * Справочники для FilterModal — грузятся только при открытии модалки.
 */
export const useWarehouseFilterData = (enabled) => {
  const { brands, categories } = useWarehouseReferences(enabled);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const suppliersRequestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || suppliersRequestedRef.current) return undefined;

    suppliersRequestedRef.current = true;
    let mounted = true;

    const loadSuppliers = async () => {
      try {
        setSuppliersLoading(true);
        const res = await api.get("/main/clients/", {
          params: { type: "suppliers", page_size: 500 },
        });
        const nextSuppliers = res?.data?.results || res?.data || [];
        if (!mounted) return;
        setSuppliers(Array.isArray(nextSuppliers) ? nextSuppliers : []);
      } catch (error) {
        if (!mounted) return;
        console.error("Ошибка при загрузке поставщиков склада:", error);
        setSuppliers([]);
        suppliersRequestedRef.current = false;
      } finally {
        if (mounted) setSuppliersLoading(false);
      }
    };

    void loadSuppliers();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return { brands, categories, suppliers, suppliersLoading };
};
