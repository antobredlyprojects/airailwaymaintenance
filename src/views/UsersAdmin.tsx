import React, { useCallback, useEffect, useState } from "react";
import { Users, Power, UserPlus, X } from "lucide-react";
import { PublicUser, OfficialRole } from "../types";
import { apiGet, apiPost } from "../lib/api";
import { Card, SectionTitle, Badge, Spinner, Empty } from "../components/ui";
import { ROLE_META } from "../lib/roles";

const ALL_ROLES = Object.keys(ROLE_META) as OfficialRole[];

/** Never crash on a stale/unknown role — show the raw value with a neutral badge. */
const roleMetaOf = (role: string) =>
  (ROLE_META[role as OfficialRole] as { label: string; badge: string } | undefined) || {
    label: role || "Unknown",
    badge: "bg-slate-800 text-slate-300 border-slate-700",
  };

const emptyForm = {
  username: "",
  password: "",
  name: "",
  role: "SECTION_ENGINEER" as OfficialRole,
  department: "",
  designation: "",
  current_location: "",
  budget_limit: "",
  scope_tags: "",
};

export const UsersAdmin: React.FC<{ showToast: (m: string, t?: "success" | "error") => void }> = ({ showToast }) => {
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    apiGet<PublicUser[]>("/api/users").then(setUsers).catch(() => setUsers([]));
  }, []);
  useEffect(load, [load]);

  const toggle = async (id: string) => {
    setBusy(id);
    try {
      const res = await apiPost<{ user: PublicUser }>(`/api/users/${id}/deactivate`);
      setUsers((prev) => prev?.map((u) => (u.id === id ? res.user : u)) || null);
      showToast(`${res.user.name} ${res.user.active ? "activated" : "deactivated"}.`);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const createUser = async () => {
    if (!form.username.trim() || !form.password || !form.name.trim()) {
      showToast("Username, password and official name are required.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ user: PublicUser }>("/api/users", {
        username: form.username.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        department: form.department.trim(),
        designation: form.designation.trim(),
        current_location: form.current_location.trim(),
        budget_limit: form.budget_limit === "" ? null : Number(form.budget_limit),
        scope_tags: form.scope_tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setUsers((prev) => [res.user, ...(prev || [])]);
      setForm(emptyForm);
      setExpanded(false);
      showToast(`Account created for ${res.user.name} — ${res.user.username} can now sign in.`);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title="User Administration"
        sub="Role-based access across the divisional hierarchy. Only System Administrators can modify accounts."
        right={<Badge tone="bg-slate-800 text-slate-300 border-slate-700">{users?.length ?? 0} accounts</Badge>}
      />

      {/* Add account */}
      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <button
          onClick={() => { setExpanded((v) => !v); setForm(emptyForm); }}
          className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-semibold text-slate-200 hover:bg-slate-900/60 transition"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-cyan-400" />
            Provision a new official account
          </span>
          {expanded ? <X className="w-4 h-4 text-slate-500" /> : <span className="text-slate-500 text-[10px]">expand</span>}
        </button>
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-800/70 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <Field label="Username">
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. se.ndls.01" className={inputCls} />
              </Field>
              <Field label="Password">
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a sign-in password" className={inputCls} />
              </Field>
              <Field label="Official name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Verma" className={inputCls} />
              </Field>
              <Field label="Role">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as OfficialRole })} className={inputCls}>
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-slate-900">
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department">
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder={ROLE_META[form.role].dept} className={inputCls} />
              </Field>
              <Field label="Designation">
                <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Section Engineer (P.Way)" className={inputCls} />
              </Field>
              <Field label="Current Location">
                <input value={form.current_location} onChange={(e) => setForm({ ...form, current_location: e.target.value })} placeholder="e.g. NDLS–TKJ Section, UP-125 km" className={inputCls} />
              </Field>
              <Field label="Approval ceiling (₹)">
                <input type="number" value={form.budget_limit} onChange={(e) => setForm({ ...form, budget_limit: e.target.value })} placeholder="e.g. 50000 (blank = none)" className={inputCls} />
              </Field>
              <Field label="Scope tags (comma-separated)">
                <input value={form.scope_tags} onChange={(e) => setForm({ ...form, scope_tags: e.target.value })} placeholder="e.g. NDLS, UP-125 (blank = division-wide)" className={inputCls} />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                New accounts start in a <span className="text-cyan-400 font-semibold">clean workspace</span> — no sample data, no
                seeded conflicts. Their view fills up as they request and approve real work. Permissions are set automatically from the
                role matrix; passwords are stored as salted hashes.
              </p>
              <button
                onClick={createUser}
                disabled={submitting || !form.username.trim() || !form.password || !form.name.trim()}
                className="flex-shrink-0 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-[11px] font-bold shadow transition disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create account"}
              </button>
            </div>
          </div>
        )}
      </div>

      {users === null ? (
        <div className="py-10 flex justify-center"><Spinner className="w-6 h-6" /></div>
      ) : users.length === 0 ? (
        <Empty text="No users." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-3 font-semibold">Official</th>
                <th className="py-2 pr-3 font-semibold">Role</th>                  <th className="py-2 pr-3 font-semibold">Department</th>
                  <th className="py-2 pr-3 font-semibold">Location</th>
                  <th className="py-2 pr-3 font-semibold">Scope</th>
                <th className="py-2 pr-3 font-semibold">Ceiling</th>
                <th className="py-2 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      {u.name}
                      {u.demo && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-800 text-amber-300 bg-amber-950/40">
                          DEMO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{u.username} · {u.id}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={roleMetaOf(u.role).badge}>{roleMetaOf(u.role).label}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-400">{u.department}</td>
                  <td className="py-2.5 pr-3 text-slate-400 text-[10px]">
                    {u.current_location || <span className="text-slate-600 italic">—</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500 max-w-40 truncate">
                    {u.scope?.tags?.length ? u.scope.tags.join(", ") : "Division-wide"}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-400 font-mono">
                    {u.budget_limit != null ? `₹${u.budget_limit.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => toggle(u.id)}
                      disabled={busy === u.id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                        u.active
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900"
                          : "bg-slate-900 text-slate-500 border-slate-800 hover:bg-rose-950 hover:text-rose-300"
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {u.active ? "Active" : "Deactivated"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500">
        <Users className="w-3.5 h-3.5 text-cyan-400" />
        Demo accounts see the seeded sample workspace. Provisioned accounts start clean. In production, accounts provision from
        IR-NPASS SSO; passwords are never stored in plaintext.
      </div>
    </Card>
  );
};

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[10px] font-semibold text-slate-500 mb-1">{label}</span>
    {children}
  </label>
);
