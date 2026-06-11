import type { DocStatus } from "@prisma/client";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-steel-200 shadow-sm ${className}`}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-steel-100 gap-2">
      <h2 className="font-semibold text-steel-900 text-sm uppercase tracking-wide">{title}</h2>
      {action}
    </div>
  );
}

const statusStyles: Record<DocStatus, string> = {
  DRAFT: "bg-steel-100 text-steel-600",
  SENT: "bg-blue-50 text-blue-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-red-50 text-red-600",
  CONVERTED: "bg-steel-100 text-steel-500",
  OPEN: "bg-amber-50 text-amber-700",
  PARTIAL: "bg-orange-50 text-orange-700",
  PAID: "bg-emerald-50 text-emerald-700",
  VOID: "bg-steel-100 text-steel-400 line-through",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const label = status === "OPEN" ? "Open" : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[status]}`}>
      {label}
    </span>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-steel-500 uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-steel-300 px-3 py-2 text-sm text-steel-900 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-torque-500 focus:border-torque-500 bg-white";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-torque-600 hover:bg-torque-700 text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-steel-300 bg-white hover:bg-steel-50 text-steel-700 text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold px-3 py-1.5 transition-colors";
export const btnSmall =
  "inline-flex items-center justify-center gap-1 rounded-md border border-steel-300 bg-white hover:bg-steel-50 text-steel-600 text-xs font-semibold px-2.5 py-1 transition-colors";

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-steel-400">{children}</div>;
}

export function tableWrap(children: React.ReactNode) {
  return <div className="overflow-x-auto">{children}</div>;
}
