import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { fetchBuildingTreaties } from "@/store/creators/building/treatiesCreators";
import { useDispatch } from "react-redux";
import { useBuildingTreaties } from "@/store/slices/building/treatiesSlice";
import { asCurrency } from "../shared/constants";

export default function InstallmentsTab({ selectedProjectId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    list: treatiesList,
    loading: treatiesLoading,
    error: treatiesError,
  } = useBuildingTreaties();

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingTreaties({
        residential_complex: selectedProjectId,
        payment_type: "installment",
        status: "signed",
      })
    );
  }, [dispatch, selectedProjectId]);

  const installmentTreaties = useMemo(() => {
    const arr = Array.isArray(treatiesList) ? treatiesList : [];
    return arr.filter(
      (t) =>
        String(t?.payment_type) === "installment" &&
        String(t?.status) === "signed"
    );
  }, [treatiesList]);

  return (
    <DataContainer>
      <div className="warehouse-table-container w-full">
        {!selectedProjectId ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Выберите жилой комплекс в шапке раздела, чтобы увидеть договора на
            рассрочку.
          </div>
        ) : treatiesLoading &&
          (!treatiesList || treatiesList.length === 0) ? (
          <div
            className="warehouse-table__loading"
            style={{ padding: 24, textAlign: "center" }}
          >
            Загрузка договоров...
          </div>
        ) : treatiesError ? (
          <div className="mt-2 text-sm text-red-500">
            {String(
              validateResErrors(
                treatiesError,
                "Не удалось загрузить договора"
              )
            )}
          </div>
        ) : !installmentTreaties.length ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Нет подписанных договоров на рассрочку по выбранному ЖК.
          </div>
        ) : (
          <table className="warehouse-table w-full">
            <thead>
              <tr>
                <th>Договор</th>
                <th>Клиент / ЖК</th>
                <th>Сумма</th>
                <th style={{ width: 120 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {installmentTreaties.map((t) => {
                const treatyId = t?.id ?? t?.uuid;
                return (
                  <tr key={treatyId}>
                    <td className="warehouse-table__name">
                      <span>{t?.number || t?.title || "—"}</span>
                    </td>
                    <td>
                      <div className="text-sm text-slate-700">
                        {t?.client_display || t?.client_name || "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {t?.residential_complex_name ||
                          t?.residential_complex_display ||
                          "—"}
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold">
                        {asCurrency(t?.amount ?? t?.total)}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800"
                        onClick={() =>
                          navigate(`/crm/building/cash-register/treaty/${treatyId}`)
                        }
                      >
                        К договору
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DataContainer>
  );
}
