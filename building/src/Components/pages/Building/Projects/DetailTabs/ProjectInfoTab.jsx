import React from "react";
import { MapPin, FileText } from "lucide-react";

export default function ProjectInfoTab({ project }) {
  if (!project) {
    return (
      <div className="building-page__card">
        <div className="building-page__muted">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="building-page__card">
      <h3 className="building-page__cardTitle">Информация о ЖК</h3>
      <div style={{ marginBottom: 16 }}>
        {project?.address && (
          <div className="building-page__row" style={{ paddingTop: 4 }}>
            <div>
              <div className="building-page__label">
                <MapPin size={14} style={{ marginRight: 4 }} />
                Адрес
              </div>
              <div className="building-page__value" style={{ textAlign: "left" }}>
                {project.address}
              </div>
            </div>
          </div>
        )}
        {project?.description && (
          <div className="building-page__row" style={{ paddingTop: 4 }}>
            <div>
              <div className="building-page__label">
                <FileText size={14} style={{ marginRight: 4 }} />
                Описание
              </div>
              <div className="building-page__value" style={{ textAlign: "left" }}>
                {project.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
