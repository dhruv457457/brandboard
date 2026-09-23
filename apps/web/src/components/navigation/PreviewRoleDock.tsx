"use client";

import React, { useState } from "react";
import { UserRole, useRole } from "@/lib/role";
import { Seg } from "@/components/ui/Seg";
import { ChevronDown, ChevronUp } from "lucide-react";

export function PreviewRoleDock() {
  const { role, setRole } = useRole();
  const [collapsed, setCollapsed] = useState(false);

  // Hidden in production builds if desired
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SHOW_DEV_DOCK !== "true") {
    return null;
  }

  return (
    <aside
      aria-label="Prototype role preview"
      className="fixed left-4 bottom-4 z-50 flex items-center gap-2.5 bg-[var(--card)] border-2 border-[var(--line)] rounded-2xl p-1.5 pl-3 shadow-[3px_3px_0_var(--shadow)] max-w-[calc(100%-32px)] select-none text-[var(--ink)] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[var(--muted)]">
        Preview as
      </span>

      {!collapsed ? (
        <Seg<UserRole>
          size="small"
          value={role}
          onChange={(newRole) => setRole(newRole)}
          items={[
            { value: "visitor", label: "Visitor" },
            { value: "creator", label: "Creator" },
            { value: "brand", label: "Brand" },
            { value: "admin", label: "Admin" },
          ]}
        />
      ) : (
        <span className="text-xs font-bold font-mono uppercase bg-[var(--accent-soft)] text-[var(--accent-text)] px-2 py-0.5 rounded-md border border-[var(--accent)]">
          {role}
        </span>
      )}

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand role preview" : "Collapse role preview"}
        className="w-6 h-6 rounded-lg grid place-items-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--soft)] cursor-pointer border-0 bg-transparent"
      >
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
