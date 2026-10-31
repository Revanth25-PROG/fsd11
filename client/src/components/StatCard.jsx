import React from 'react';
import { Package, Boxes, AlertTriangle, IndianRupee } from 'lucide-react';

const iconMap = {
  products: Package,
  units: Boxes,
  low: AlertTriangle,
  sales: IndianRupee
};

export default function StatCard({ type = 'products', title, value, note }) {
  const Icon = iconMap[type] || Package;

  return (
    <div className="stat-card">
      <div className={`stat-icon ${type}`}>
        <Icon size={20} />
      </div>
      <p className="stat-title">{title}</p>
      <div className="stat-value">{value ?? 0}</div>
      {note && <p className="stat-note">{note}</p>}
    </div>
  );
}
