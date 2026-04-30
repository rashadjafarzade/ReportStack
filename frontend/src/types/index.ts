export type LaunchStatus = "IN_PROGRESS" | "PASSED" | "FAILED" | "STOPPED";
export type TestStatus = "PASSED" | "FAILED" | "SKIPPED" | "ERROR";
export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
export type AttachmentType = "SCREENSHOT" | "LOG_FILE" | "VIDEO" | "OTHER";
export type DefectType = "PRODUCT_BUG" | "AUTOMATION_BUG" | "SYSTEM_ISSUE" | "NO_DEFECT" | "TO_INVESTIGATE";
export type AnalysisSource = "AI_AUTO" | "MANUAL";

export interface Launch {
  id: number;
  name: string;
  description: string | null;
  status: LaunchStatus;
  start_time: string;
  end_time: string | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface LaunchListResponse {
  items: Launch[];
  total: number;
  page: number;
  page_size: number;
}

export interface TestItem {
  id: number;
  launch_id: number;
  name: string;
  suite: string | null;
  status: TestStatus;
  duration_ms: number | null;
  error_message: string | null;
  stack_trace: string | null;
  start_time: string;
  end_time: string | null;
}

export interface TestLog {
  id: number;
  test_item_id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  step_name: string | null;
  order_index: number;
}

export interface Attachment {
  id: number;
  test_item_id: number | null;
  launch_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  attachment_type: AttachmentType;
  uploaded_at: string;
  url: string;
}

export interface FailureAnalysis {
  id: number;
  test_item_id: number;
  defect_type: DefectType;
  confidence: number;
  reasoning: string | null;
  source: AnalysisSource;
  model_name: string | null;
  prompt_version: string | null;
  created_at: string;
  overridden_by: number | null;
}

export interface LaunchAnalysisSummary {
  total_analyzed: number;
  product_bug: number;
  automation_bug: number;
  system_issue: number;
  no_defect: number;
  to_investigate: number;
}
