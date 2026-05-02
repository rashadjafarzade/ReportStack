import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { UserResponse, getMe } from "../api/auth";

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  setAuth: (token: string, user: UserResponse) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  setAuth: () => {},
  logout: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("rs_token"));
  const [loading, setLoading] = useState(true);

  const setAuth = useCallback((newToken: string, newUser: UserResponse) => {
    localStorage.setItem("rs_token", newToken);
    localStorage.setItem("rs_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("rs_token");
    localStorage.removeItem("rs_user");
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token) {
      getMe()
        .then(res => setUser(res.data))
        .catch(() => { logout(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
