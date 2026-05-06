import React from "react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export const Breadcrumb: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <div className="page-breadcrumb">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="page-breadcrumb-separator">/</span>}
        {item.to ? (
          <Link to={item.to}>{item.label}</Link>
        ) : (
          <span>{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);
