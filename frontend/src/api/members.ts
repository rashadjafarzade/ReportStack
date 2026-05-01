import api from "./client";
import { Member, MemberRole } from "../types";

export const getMembers = () =>
  api.get<Member[]>("/members");

export const addMember = (data: { name: string; email: string; role: MemberRole }) =>
  api.post<Member>("/members", data);

export const updateMemberRole = (id: number, role: MemberRole) =>
  api.put<Member>(`/members/${id}`, { role });

export const removeMember = (id: number) =>
  api.delete(`/members/${id}`);
