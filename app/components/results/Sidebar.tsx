"use client";

import type { CSSProperties } from "react";
import { IconAlertTriangle, IconCalendar, IconFile, IconFileCheck, IconHelpCircle, IconList } from "./icons";
import type { ResultSectionId } from "./ResultsView";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onJump: (section: ResultSectionId, fieldKey?: string) => void;
}

function ChevronLeft({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function Sidebar({ collapsed, onToggleCollapsed, onJump }: SidebarProps) {
  const labelStyle: CSSProperties = collapsed ? { display: "none" } : {};
  const subListStyle: CSSProperties = collapsed
    ? { display: "none" }
    : { display: "flex", flexDirection: "column", gap: 0, marginBottom: 2 };

  return (
    <aside
      style={{
        width: collapsed ? 56 : 236,
        flex: "none",
        borderRight: "1px solid var(--color-divider)",
        transition: "width 200ms cubic-bezier(.4,0,.2,1)",
        overflow: "hidden",
        position: "sticky",
        top: 54,
        alignSelf: "flex-start",
        height: "calc(100vh - 54px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 8px 0" }}>
        <button
          type="button"
          className="btn btn-ghost btn-icon sidebar-toggle"
          onClick={onToggleCollapsed}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <ChevronLeft collapsed={collapsed} />
        </button>
      </div>
      <div style={{ padding: "4px 10px 20px", overflowY: "auto", flex: 1 }}>
        <p className="text-muted" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", margin: "4px 6px 10px", ...labelStyle }}>
          Jump to
        </p>

        <button type="button" className="sidebar-link" title="Contract Identity" onClick={() => onJump("overview")}>
          <IconFile size={16} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", ...labelStyle }}>Contract Identity</span>
        </button>

        <button type="button" className="sidebar-link" title="Important Dates" onClick={() => onJump("dates")}>
          <IconCalendar size={16} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", ...labelStyle }}>Important Dates</span>
        </button>
        <div style={subListStyle}>
          <button type="button" className="sidebar-sublink" onClick={() => onJump("dates", "renewalDate")}>
            Renewals
          </button>
          <button type="button" className="sidebar-sublink" onClick={() => onJump("dates", "noticePeriod")}>
            Notice Period
          </button>
        </div>

        <button type="button" className="sidebar-link" title="Commercial Terms" onClick={() => onJump("terms")}>
          <IconList size={16} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", ...labelStyle }}>Commercial Terms</span>
        </button>
        <div style={subListStyle}>
          <button type="button" className="sidebar-sublink" onClick={() => onJump("terms", "paymentTerms")}>
            Payment Terms
          </button>
        </div>

        <button type="button" className="sidebar-link" title="Key Clauses" onClick={() => onJump("clauses")}>
          <IconFileCheck size={16} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", ...labelStyle }}>Key Clauses</span>
        </button>
        <div style={subListStyle}>
          <button type="button" className="sidebar-sublink" onClick={() => onJump("clauses", "termination")}>
            Termination
          </button>
          <button type="button" className="sidebar-sublink" onClick={() => onJump("clauses", "liability")}>
            Liability
          </button>
        </div>

        <button type="button" className="sidebar-link" title="Things to Watch" onClick={() => onJump("watch")}>
          <IconAlertTriangle size={16} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", ...labelStyle }}>Things to Watch</span>
        </button>

        <button type="button" className="sidebar-link" title="Unknown Fields" onClick={() => onJump("unknown")}>
          <IconHelpCircle size={16} />
          <span style={{ minWidth: 0, whiteSpace: "nowrap", ...labelStyle }}>Unknown Fields</span>
        </button>
      </div>
    </aside>
  );
}
