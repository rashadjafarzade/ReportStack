import api from "./client";
import { Comment } from "../types";

export const getItemComments = (launchId: number, itemId: number) =>
  api.get<Comment[]>(`/launches/${launchId}/items/${itemId}/comments`);

export const createItemComment = (launchId: number, itemId: number, data: { author: string; text: string }) =>
  api.post<Comment>(`/launches/${launchId}/items/${itemId}/comments`, data);

export const getLaunchComments = (launchId: number) =>
  api.get<Comment[]>(`/launches/${launchId}/comments`);

export const createLaunchComment = (launchId: number, data: { author: string; text: string }) =>
  api.post<Comment>(`/launches/${launchId}/comments`, data);

export const deleteComment = (commentId: number) =>
  api.delete(`/comments/${commentId}`);
