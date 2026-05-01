import api from "./client";
import { ProjectSettings } from "../types";

export const getSettings = () =>
  api.get<ProjectSettings>("/settings");

export const updateSettings = (data: ProjectSettings) =>
  api.put<ProjectSettings>("/settings", data);
