import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearStoredToken, getStoredToken, setStoredToken } from "./token";
import { registerUnauthorizedHandler } from "../api/client";

export interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearStoredToken();
      setToken(null);
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  const login = (newToken: string) => {
    setStoredToken(newToken);
    setToken(newToken);
  };

  const logout = () => {
    clearStoredToken();
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: Boolean(token),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
