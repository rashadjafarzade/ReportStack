import api from "./client";

export interface Widget {
  id: number;
  dashboard_id: number;
  widget_type: string;
  title: string;
  config: string | null;
  order_index: number;
  width: number;
  created_at: string;
}

export interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  owner: string;
  created_at: string;
  updated_at: string;
  widgets: Widget[];
}

export const getDashboards = () =>
  api.get<{ items: Dashboard[]; total: number }>("/dashboards/");

export const createDashboard = (data: { name: string; description?: string }) =>
  api.post<Dashboard>("/dashboards/", data);

export const deleteDashboard = (id: number) =>
  api.delete(`/dashboards/${id}`);

export const addWidget = (dashboardId: number, data: { widget_type: string; title: string; width?: number }) =>
  api.post<Widget>(`/dashboards/${dashboardId}/widgets/`, data);

export const removeWidget = (dashboardId: number, widgetId: number) =>
  api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);
