import api from "./client";
import { ProjectSettings } from "../types";

export const getSettings = () =>
  api.get<ProjectSettings>("/settings");

export const updateSettings = (data: Partial<ProjectSettings>) =>
  api.put<ProjectSettings>("/settings", data);

export const generateDemoData = () =>
  api.post("/settings/seed");
