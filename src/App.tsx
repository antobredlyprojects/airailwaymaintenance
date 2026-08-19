import React, { useCallback, useEffect, useState } from "react";
import { PublicUser } from "./types";
import { getToken, clearToken, apiGet } from "./lib/api";
import { LoginPage } from "./views/LoginPage";
import { AppShell } from "./views/AppShell";
import { Overview } from "./views/Overview";
import { WorkRequests } from "./views/WorkRequests";
import { Approvals } from "./views/Approvals";
import { Possessions } from "./views/Possessions";
import { Conflicts } from "./views/Conflicts";
import { UsersAdmin } from "./views/UsersAdmin";
import { AuditLog } from "./views/AuditLog";
import { ScheduleGantt } from "./views/ScheduleGantt";
import { CheckCircle2, XCircle } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [active, setActive] = useState("overview");
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const showToast = useCallback((text: string, tone: "success" | "error" = "success") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4000);
  }, []);

  // Restore session on boot
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setBooting(false);
        return;
      }
      try {
        const res = await apiGet<{ user: PublicUser }>("/api/auth/me");
        setUser(res.user);
      } catch {
        clearToken();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Global session-expiry signal from the API client
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-xs font-medium">Restoring session…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={(u) => { setUser(u); setActive("overview"); }} />;
  }

  const views: Record<string, React.ReactNode> = {
    overview: <Overview user={user} onNavigate={setActive} />,
    requests: <WorkRequests user={user} showToast={showToast} />,
    approvals: <Approvals user={user} showToast={showToast} />,
    possessions: <Possessions user={user} showToast={showToast} />,
    gantt: <ScheduleGantt user={user} />,
    conflicts: <Conflicts user={user} showToast={showToast} />,
    users: <UsersAdmin showToast={showToast} />,
    audit: <AuditLog />,
  };

  return (
    <AppShell
      user={user}
      active={active}
      onNavigate={setActive}
      onSwitchUser={(u) => { setUser(u); showToast(`Now viewing as ${u.name} (${u.role}).`); }}
      onLogout={() => setUser(null)}
    >
      {views[active] || <Overview user={user} onNavigate={setActive} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className={`p-3.5 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs ${
            toast.tone === "error"
              ? "bg-rose-950/95 border-rose-600 text-rose-100"
              : "bg-emerald-950/95 border-emerald-600 text-emerald-100"
          }`}>
            {toast.tone === "error" ? (
              <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <p className="leading-snug font-medium">{toast.text}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
