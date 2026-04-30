import api from "./client";
import { Launch, LaunchListResponse, TestItem } from "../types";

export const getLaunches = (page = 1, pageSize = 20) =>
  api.get<LaunchListResponse>("/launches/", { params: { page, page_size: pageSize } });

export const getLaunch = (id: number) =>
  api.get<Launch>(`/launches/${id}`);

export const getTestItems = (launchId: number, status?: string) =>
  api.get<TestItem[]>(`/launches/${launchId}/items/`, { params: { status } });
