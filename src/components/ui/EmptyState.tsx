import React from "react";

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => {
  return (
    <div className="ml-empty-state ml-panel" role="status" aria-live="polite">
      <div style={{ padding: 20, textAlign: "center" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
        {description && <p style={{ marginTop: 8, color: "#9fb8db" }}>{description}</p>}
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
    </div>
  );
};

export default EmptyState;
