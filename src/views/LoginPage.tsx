import React, { useState } from "react";
import { Train, Lock, User as UserIcon, LogIn, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import { apiPost } from "../lib/api";
import { PublicUser } from "../types";
import { ROLE_META } from "../lib/roles";
import { OfficialRole } from "../types";

const DEMO_ACCOUNTS: { username: string; role: OfficialRole }[] = [
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

export const LoginPage: React.FC<{ onLogin: (user: PublicUser) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const doLogin = async (user?: string, pass?: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await apiPost<{ token: string; user: PublicUser }>("/api/auth/login", {
        username: user ?? username,
        password: pass ?? password,
      });
      sessionStorage.setItem("railoptima_token", res.token);
      onLogin(res.user);
    } catch (e: any) {
      setError(e.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = (u: string) => doLogin(u, "demo123");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[46%] relative overflow-hidden flex-col justify-between p-10 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 border-r border-slate-800">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-lg shadow-blue-900/40">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Train className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">RailOptima</h1>
              <p className="text-[11px] text-slate-400">AI Railway Maintenance Scheduling Engine</p>
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              One platform.
              <br />
              Every official.
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Zero conflicts.
              </span>
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              Role-based access for the entire divisional hierarchy — from Gang Mates in the field to
              the Divisional Railway Manager's command centre.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 max-w-md">
            {[
              ["12", "Operational Roles"],
              ["5", "Conflict Classes"],
              ["<10s", "Reschedule Time"],
            ].map(([v, l]) => (
              <div key={l} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-lg font-bold font-mono text-cyan-300">{v}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Secured per Indian Railways IT policy · DPDP Act 2023 · Full audit trail
        </div>
      </div>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-5">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Train className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <span className="font-extrabold text-lg">RailOptima</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl shadow-black/30">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <LogIn className="w-4 h-4 text-cyan-400" /> Official Sign-In
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Divisional access portal — credentials issued by the System Administrator.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (e.g. section.engineer)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doLogin()}
                  placeholder="Password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={() => doLogin()}
                disabled={busy || !username || !password}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-950/40 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busy ? "Authenticating..." : "Sign In"}
                {!busy && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Demo evaluation — one-tap access as any official
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Demo accounts (demo123) see the seeded sample workspace. Accounts provisioned by the System
              Administrator sign in here too — they start with a clean workspace that fills up as work is
              requested and approved.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.username}
                  onClick={() => quickLogin(a.username)}
                  disabled={busy}
                  className="text-left px-2.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition text-[10px] leading-tight"
                >
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${ROLE_META[a.role].badge}`}>
                    {ROLE_META[a.role].label.split(" (")[0]}
                  </span>
                  <p className="text-slate-500 mt-1 truncate">{a.username}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
