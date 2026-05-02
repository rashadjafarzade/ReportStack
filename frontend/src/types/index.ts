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
  tags: string[] | null;
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

export type DefectStatus = "OPEN" | "IN_PROGRESS" | "FIXED" | "WONT_FIX" | "DUPLICATE";

export interface Comment {
  id: number;
  test_item_id: number | null;
  launch_id: number;
  author: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface Defect {
  id: number;
  test_item_id: number;
  launch_id: number;
  external_id: string | null;
  external_url: string | null;
  summary: string;
  description: string | null;
  status: DefectStatus;
  created_at: string;
  updated_at: string;
}

export type MemberRole = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

export interface Member {
  id: number;
  name: string;
  email: string;
  role: MemberRole;
  created_at: string;
}

export interface ProjectSettings {
  project_name: string;
  description: string;
  default_launch_mode: string;
  auto_analysis_enabled: boolean;
  ai_model: string;
  notifications_enabled: boolean;
  retention_days: number;
  max_attachment_size_mb: number;
  inactivity_timeout: string;
  keep_launches: string;
  keep_logs: string;
  keep_attachments: string;
}
