import api from "./client";

export interface UserResponse {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export const login = (email: string, password: string) =>
  api.post<TokenResponse>("/auth/login", { email, password });

export const register = (data: { email: string; name: string; password: string }) =>
  api.post<TokenResponse>("/auth/register", data);

export const getMe = () =>
  api.get<UserResponse>("/auth/me");
