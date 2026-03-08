import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { fetchBuildingPayrolls } from "@/store/creators/building/salaryCreators";
import { useDispatch } from "react-redux";
import { useBuildingSalary } from "@/store/slices/building/salarySlice";

const PAYROLL_STATUS_LABELS = {
  draft: "Черновик",
  approved: "Утверждён",
  paid: "Выплачен",
};

export default function SalaryPaymentsTab({ selectedProjectId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    payrolls,
    payrollsLoading,
    payrollsError,
  } = useBuildingSalary();

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingPayrolls({
        residential_complex: selectedProjectId,
        status: "approved",
      }),
    );
  }, [dispatch, selectedProjectId]);

  const allPayrolls = Array.isArray(payrolls)
    ? payrolls.filter((p) => String(p?.status) === "approved")
    : [];

  return (
    <DataContainer>
      <div className="warehouse-table-container w-full">
        {!selectedProjectId ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Выберите жилой комплекс в шапке раздела, чтобы увидеть
            утверждённые периоды зарплаты для выплат.
          </div>
        ) : payrollsLoading && (!payrolls || payrolls.length === 0) ? (
          <div
            className="warehouse-table__loading"
            style={{ padding: 24, textAlign: "center" }}
          >
            Загрузка периодов...
          </div>
        ) : payrollsError ? (
          <div className="mt-2 text-sm text-red-500">
            {String(
              validateResErrors(
                payrollsError,
                "Не удалось загрузить периоды зарплаты",
              ),
            )}
          </div>
        ) : !allPayrolls.length ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Нет утверждённых периодов зарплаты по выбранному ЖК. Утвердите
            период на странице «Зарплата».
          </div>
        ) : (
          <table className="warehouse-table w-full">
            <thead>
              <tr>
                <th>Период</th>
                <th>Даты</th>
                <th>Статус</th>
                <th style={{ width: 140 }} />
              </tr>
            </thead>
            <tbody>
              {allPayrolls.map((p) => {
                const payrollId = p?.id ?? p?.uuid;
                return (
                  <tr key={payrollId}>
                    <td>{p?.title || "—"}</td>
                    <td>
                      {p?.period_start && p?.period_end
                        ? `${p.period_start} — ${p.period_end}`
                        : "—"}
                    </td>
                    <td>
                      {PAYROLL_STATUS_LABELS[p?.status] ?? p?.status ?? "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                        onClick={() =>
                          navigate(
                            `/crm/building/cash-register/salary-payroll/${payrollId}`,
                            {
                              state: {
                                payrollTitle: p?.title || "",
                                periodStart: p?.period_start || "",
                                periodEnd: p?.period_end || "",
                                payrollStatus: p?.status || "",
                              },
                            },
                          )
                        }
                      >
                        К выплатам
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
