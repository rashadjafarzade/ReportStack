import api from "./client";
import { FailureAnalysis, LaunchAnalysisSummary } from "../types";

export const triggerLaunchAnalysis = (launchId: number) =>
  api.post(`/launches/${launchId}/analyze`);

export const triggerItemAnalysis = (launchId: number, itemId: number) =>
  api.post(`/launches/${launchId}/items/${itemId}/analyze`);

export const getItemAnalyses = (launchId: number, itemId: number) =>
  api.get<FailureAnalysis[]>(`/launches/${launchId}/items/${itemId}/analyses`);

export const getAnalysisSummary = (launchId: number) =>
  api.get<LaunchAnalysisSummary>(`/launches/${launchId}/analysis-summary`);

export const overrideAnalysis = (
  launchId: number,
  itemId: number,
  analysisId: number,
  data: { defect_type: string; reasoning?: string }
) =>
  api.put<FailureAnalysis>(
    `/launches/${launchId}/items/${itemId}/analyses/${analysisId}`,
    data
  );
