"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "visitor" | "creator" | "brand" | "admin";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "visitor",
  setRole: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("visitor");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("patched.role") as UserRole | null;
      if (stored && ["visitor", "creator", "brand", "admin"].includes(stored)) {
        setRoleState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setRole = (next: UserRole) => {
    setRoleState(next);
    try {
      localStorage.setItem("patched.role", next);
    } catch {
      // ignore
    }
  };

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
