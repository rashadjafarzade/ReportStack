import api from "./client";
import { Defect, DefectStatus } from "../types";

export const getItemDefects = (launchId: number, itemId: number) =>
  api.get<Defect[]>(`/launches/${launchId}/items/${itemId}/defects`);

export const createItemDefect = (
  launchId: number,
  itemId: number,
  data: { summary: string; description?: string; external_id?: string; external_url?: string; status?: DefectStatus }
) => api.post<Defect>(`/launches/${launchId}/items/${itemId}/defects`, data);

export const getLaunchDefects = (launchId: number) =>
  api.get<Defect[]>(`/launches/${launchId}/defects`);

export const updateDefect = (
  defectId: number,
  data: Partial<{ summary: string; description: string; external_id: string; external_url: string; status: DefectStatus }>
) => api.put<Defect>(`/defects/${defectId}`, data);

export const deleteDefect = (defectId: number) =>
  api.delete(`/defects/${defectId}`);
