import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import { fetchBuildingMySalaryLines } from "../../../../store/creators/building/salaryCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";

export default function BuildingSalaryMyLines() {
  const dispatch = useDispatch();
  const {
    myLines: { list, loading, error },
  } = useBuildingSalary();

  useEffect(() => {
    dispatch(fetchBuildingMySalaryLines());
  }, [dispatch]);

  return (
    <div className="building-page__card">
      <h2 className="building-page__title" style={{ fontSize: 18 }}>
        Мои начисления
      </h2>
      {loading && (
        <div className="building-page__muted">
          Загрузка ваших начислений...
        </div>
      )}
      {error && (
        <div className="building-page__error">
          {String(
            validateResErrors(
              error,
              "Не удалось загрузить ваши начисления",
            ),
          )}
        </div>
      )}
      {!loading && !error && (
        <div className="building-table building-table--shadow">
          <table>
            <thead>
              <tr>
                <th>Период</th>
                <th>Базовая сумма</th>
                <th>К выплате</th>
                <th>Выплачено</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {(list || []).map((line) => (
                <tr key={line.id ?? line.uuid}>
                  <td>
                    {line.payroll_title ||
                      line.period_title ||
                      "—"}
                  </td>
                  <td>{line.base_amount ?? "—"}</td>
                  <td>{line.net_to_pay ?? "—"}</td>
                  <td>{line.paid_total ?? "—"}</td>
                  <td>{line.status || "—"}</td>
                </tr>
              ))}
              {(!list || list.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    У вас пока нет начислений.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

