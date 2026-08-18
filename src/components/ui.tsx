import React from "react";
import { X } from "lucide-react";

// ---------------- Primitives for the new portal design system ----------------

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 ${className}`}>
    {children}
  </div>
);

export const SectionTitle: React.FC<{ title: string; sub?: string; right?: React.ReactNode }> = ({
  title,
  sub,
  right,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-4">
    <div>
      <h2 className="text-base font-bold text-slate-100">{title}</h2>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
);

type BtnVariant = "primary" | "ghost" | "danger" | "success" | "outline";
export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }
> = ({ variant = "primary", size = "md", className = "", ...props }) => {
  const variants: Record<BtnVariant, string> = {
    primary:
      "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-md shadow-blue-950/40",
    ghost: "bg-slate-800/70 hover:bg-slate-700 text-slate-200 border border-slate-700",
    outline: "bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700",
    danger: "bg-rose-700/80 hover:bg-rose-600 text-white",
    success: "bg-emerald-700/80 hover:bg-emerald-600 text-white",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-[11px]", md: "px-3.5 py-2 text-xs" };
  return (
    <button
      className={`rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
};

export const Badge: React.FC<{ tone?: string; className?: string; children: React.ReactNode }> = ({
  tone = "bg-slate-800 text-slate-300 border-slate-700",
  className = "",
  children,
}) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${tone} ${className}`}>
    {children}
  </span>
);

export const PRIORITY_TONES: Record<string, string> = {
  CRITICAL: "bg-rose-950 text-rose-300 border-rose-800",
  HIGH: "bg-amber-950 text-amber-300 border-amber-800",
  MEDIUM: "bg-blue-950 text-blue-300 border-blue-800",
  LOW: "bg-slate-800 text-slate-300 border-slate-700",
};

export const STATUS_TONES: Record<string, string> = {
  PENDING: "bg-amber-950 text-amber-300 border-amber-800",
  APPROVED: "bg-emerald-950 text-emerald-300 border-emerald-800",
  REJECTED: "bg-rose-950 text-rose-300 border-rose-800",
  SCHEDULED: "bg-cyan-950 text-cyan-300 border-cyan-800",
  IN_PROGRESS: "bg-indigo-950 text-indigo-300 border-indigo-800",
  COMPLETED: "bg-emerald-900 text-emerald-200 border-emerald-700",
  CANCELLED: "bg-slate-800 text-slate-400 border-slate-700",
  DEFERRED: "bg-slate-800 text-slate-400 border-slate-700",
};

export const SEVERITY_TONES: Record<string, string> = {
  CRITICAL: "bg-rose-950 text-rose-300 border-rose-800",
  HIGH: "bg-orange-950 text-orange-300 border-orange-800",
  WARNING: "bg-amber-950 text-amber-300 border-amber-800",
  INFO: "bg-sky-950 text-sky-300 border-sky-800",
  MEDIUM: "bg-blue-950 text-blue-300 border-blue-800",
};

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  onClick?: () => void;
}> = ({ label, value, icon, accent = "text-cyan-300", onClick }) => (
  <div
    onClick={onClick}
    className={`bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1.5 ${onClick ? "cursor-pointer hover:border-slate-600 transition" : ""}`}
  >
    <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
      <span>{label}</span>
      {icon}
    </div>
    <div className={`text-2xl font-bold font-mono ${accent}`}>{value}</div>
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-5 space-y-4 my-8`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-bold text-slate-100 text-sm">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <div>
    <label className="block text-slate-400 font-semibold text-[11px] mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

export const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder:text-slate-600";
export const selectCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500";

export const Spinner: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={`animate-spin text-cyan-400 ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center text-xs text-slate-500 py-8">{text}</div>
);

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
