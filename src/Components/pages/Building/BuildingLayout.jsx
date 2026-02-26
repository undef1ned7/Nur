import React, { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchBuildingProjects } from "../../../store/creators/building/projectsCreators";
import {
    setSelectedBuildingProjectId,
    useBuildingProjects,
} from "../../../store/slices/building/projectsSlice";
import "./style.scss";

export default function BuildingLayout() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    const { items, selectedProjectId, loading, loaded } = useBuildingProjects();

    const projectsList = useMemo(() => {
        return Array.isArray(items) ? items : [];
    }, [items]);

    useEffect(() => {
        if (loading) return;
        if (loaded) return;
        if (projectsList.length > 0) return;
        dispatch(fetchBuildingProjects());
    }, [dispatch, loading, loaded, projectsList.length]);

    if (selectedProjectId) {
        return (
            <div className="building-layout">
                <Outlet />
            </div>
        );
    }

    return (
        <div className="building-layout">
            <div className="building-layout__gate">
                <div className="building-layout__gateCard">
                    <div className="building-layout__gateTitle">Выберите проект</div>
                    <div className="building-layout__gateText">
                        Чтобы продолжить работу в строительном разделе, выберите жилой
                        комплекс.
                    </div>

                    <div className="building-layout__gateField">
                        <div className="building-layout__gateLabel">Проект</div>
                        <select
                            className="building-layout__gateSelect"
                            value={selectedProjectId ?? ""}
                            onChange={(e) =>
                                dispatch(setSelectedBuildingProjectId(e.target.value || null))
                            }
                            disabled={loading}
                        >
                            <option value="" disabled>
                                {loading
                                    ? "Загрузка..."
                                    : projectsList.length > 0
                                        ? "Выберите проект"
                                        : "Проектов пока нет"}
                            </option>
                            {projectsList.map((p, idx) => {
                                const id = String(p?.id ?? p?.uuid ?? idx);
                                return (
                                    <option key={id} value={id}>
                                        {p?.name || "—"}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="building-layout__gateActions">
                        <button
                            type="button"
                            className="building-layout__btn building-layout__btn--primary"
                            onClick={() =>
                                navigate("/crm/building/projects", { state: { openCreate: true } })
                            }
                        >
                            Добавить проект
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}