import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchBuildingProjects } from "../../../store/creators/building/projectsCreators";
import {
    setSelectedBuildingProjectId,
    useBuildingProjects,
} from "../../../store/slices/building/projectsSlice";
import CreateProjectModal from "./Projects/components/Create";
import "./style.scss";

export default function BuildingLayout() {
    const dispatch = useDispatch();
    const location = useLocation();
    const [openCreate, setOpenCreate] = useState(false);

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

    useEffect(() => {
        if (location?.state?.openCreate) {
            setOpenCreate(true);
        }
    }, [location?.state]);

    const handleCreated = (project) => {
        const pid = project?.id ?? project?.uuid;
        dispatch(fetchBuildingProjects());
        if (pid) {
            dispatch(setSelectedBuildingProjectId(String(pid)));
        }
        setOpenCreate(false);
    };

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
                            onClick={() => setOpenCreate(true)}
                        >
                            Добавить проект
                        </button>
                    </div>
                </div>
            </div>
            <CreateProjectModal
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                onCreated={handleCreated}
            />
        </div>
    );
}