
import React from "react";

function StatCard({ title, value, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-content">
        <div>
          <p className="stat-card-title">{title}</p>
          <h2 className="stat-card-value">{value ?? 0}</h2>
        </div>

        <div
          className="stat-card-icon"
          style={{
            backgroundColor: color || "#e8f5e9",
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default StatCard;
