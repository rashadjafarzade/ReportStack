import api from "./client";
import { TestLog } from "../types";

export const getTestLogs = (
  launchId: number,
  itemId: number,
  params?: { level?: string; page?: number; page_size?: number }
) => api.get<TestLog[]>(`/launches/${launchId}/items/${itemId}/logs/`, { params });
