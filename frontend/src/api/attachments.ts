import api from "./client";
import { Attachment } from "../types";

export const getTestAttachments = (launchId: number, itemId: number) =>
  api.get<Attachment[]>(`/launches/${launchId}/items/${itemId}/attachments`);

const BASE = process.env.REACT_APP_API_URL || "/api/v1";

export const getAttachmentUrl = (attachmentId: number) =>
  `${BASE}/attachments/${attachmentId}/file`;
