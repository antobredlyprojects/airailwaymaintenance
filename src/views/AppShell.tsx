import React, { useState } from "react";
import { Train, LogOut, Menu, X, RefreshCw, UserRound } from "lucide-react";
import { PublicUser, OfficialRole } from "../types";
import { NAV_ITEMS, ROLE_META, formatINR } from "../lib/roles";
import { apiPost } from "../lib/api";

const DEMO_SWITCH: { username: string; role: OfficialRole }[] = [
  { username: "gangmate", role: "GANG_MATE" },
  { username: "section.engineer", role: "SECTION_ENGINEER" },
  { username: "depot.engineer", role: "DEPOT_ENGINEER" },
  { username: "workshop.supervisor", role: "WORKSHOP_SUPERVISOR" },
  { username: "ade.pway", role: "ADE" },
  { username: "srdme.cw", role: "SR_DME" },
  { username: "section.controller", role: "SECTION_CONTROLLER" },
  { username: "drm", role: "DRM" },
  { username: "admin", role: "SYSTEM_ADMIN" },
  { username: "analyst", role: "DATA_ANALYST" },
  { username: "contractor", role: "CONTRACTOR" },
  { username: "auditor", role: "AUDITOR" },
];

interface AppShellProps {
  user: PublicUser;
  active: string;
  onNavigate: (v: string) => void;
  onSwitchUser: (user: PublicUser) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  active,
  onNavigate,
  onSwitchUser,
  onLogout,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const meta = ROLE_META[user.role];
  const nav = NAV_ITEMS.filter((n) => n.visible(user.permissions, user.role));

  const switchTo = async (username: string) => {
    setSwitching(true);
    try {
      const res = await apiPost<{ token: string; user: PublicUser }>("/api/auth/login", {
        username,
        password: "demo123",
      });
      sessionStorage.setItem("railsync_token", res.token);
      onSwitchUser(res.user);
      onNavigate("overview");
    } catch (e) {
      console.error(e);
    } finally {
      setSwitching(false);
    }
  };

  const doLogout = async () => {
    try {
      await apiPost("/api/auth/logout");
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem("railsync_token");
    onLogout();
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5">
          <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
            <Train className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
        <div>
          <div className="text-sm font-extrabold leading-none">RailSync AI</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Delhi Division · NR</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? "bg-blue-600/15 text-blue-300 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div className="px-3 pb-4">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{meta.label}</div>
              {user.current_location && (
                <div className="text-[9px] text-slate-600 truncate flex items-center gap-1 mt-0.5">
                  <span className="text-cyan-500">●</span>
                  {user.current_location}
                </div>
              )}
            </div>
            <button onClick={doLogout} title="Sign out" className="ml-auto text-slate-500 hover:text-rose-400 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {user.budget_limit != null && user.permissions.approve_requests && (
            <div className="text-[10px] text-slate-500">
              Approval ceiling: <span className="text-cyan-300 font-mono font-semibold">{formatINR(user.budget_limit)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 bg-slate-900/50 border-r border-slate-800 fixed inset-y-0 left-0 z-30">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800">
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 text-slate-400">
              <X className="w-4 h-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-slate-950/85 backdrop-blur border-b border-slate-800">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-400">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <UserRound className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.badge}`}>
                {meta.label}
              </span>
              {user.demo ? (
                <span
                  title="Demo account — this official sees the seeded sample workspace"
                  className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-amber-800 text-amber-300 bg-amber-950/40"
                >
                  Demo data
                </span>
              ) : (
                <span
                  title="Provisioned account — clean workspace, populated by real requests and approvals"
                  className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-emerald-800 text-emerald-300 bg-emerald-950/40"
                >
                  Live workspace
                </span>
              )}
              <span className="text-xs text-slate-400 truncate hidden sm:block">{meta.dept}</span>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              {/* Demo role switcher */}
              <div className="hidden md:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px]">
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${switching ? "animate-spin" : ""}`} />
                <select
                  value={user.username}
                  onChange={(e) => switchTo(e.target.value)}
                  aria-label="Demo role switch"
                  className="bg-transparent text-slate-300 font-medium focus:ring-0 cursor-pointer"
                >
                  {DEMO_SWITCH.map((d) => (
                    <option key={d.username} value={d.username} className="bg-slate-900">
                      {ROLE_META[d.role].label} ({d.username})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-px h-6 bg-slate-800 hidden md:block" />
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</div>
                <div className="text-[10px] text-slate-500">{user.designation}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5">{children}</main>

        <footer className="px-6 py-4 text-[10px] text-slate-600 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
          <span>RailSync AI · AI Railway Maintenance Scheduling Engine · Indian Railways Delhi Division</span>
          <span className="font-mono">Role-scoped access · Full audit trail · v4.0</span>
        </footer>
      </div>
    </div>
  );
};
