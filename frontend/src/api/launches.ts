import api from "./client";
import { Launch, LaunchListResponse, TestItem } from "../types";

export const getLaunches = (page = 1, pageSize = 20) =>
  api.get<LaunchListResponse>("/launches/", { params: { page, page_size: pageSize } });

export const getLaunch = (id: number) =>
  api.get<Launch>(`/launches/${id}`);

export const getTestItems = (launchId: number, status?: string) =>
  api.get<TestItem[]>(`/launches/${launchId}/items/`, { params: { status } });

export const getItemRetries = (launchId: number, itemId: number) =>
  api.get<TestItem[]>(`/launches/${launchId}/items/${itemId}/retries`);

export const bulkUpdateStatus = (launchId: number, itemIds: number[], status: string) =>
  api.post(`/launches/${launchId}/items/bulk-update`, { item_ids: itemIds, status });

export const bulkAssignDefect = (launchId: number, itemIds: number[], defect: { summary: string; status?: string }) =>
  api.post(`/launches/${launchId}/items/bulk-defect`, { item_ids: itemIds, defect });

export const bulkAnalyze = (launchId: number, itemIds: number[]) =>
  api.post(`/launches/${launchId}/items/bulk-analyze`, { item_ids: itemIds });
