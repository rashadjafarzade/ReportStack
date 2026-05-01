import api from "./client";

export interface TestHistoryEntry {
  id: number;
  launch_id: number;
  launch_name: string;
  launch_number: number;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  defect_type: string | null;
  start_time: string;
}

export const getTestHistory = (testName: string, limit: number = 20) =>
  api.get<TestHistoryEntry[]>("/items/history", { params: { name: testName, limit } });
