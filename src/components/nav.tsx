"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

function NavLink({ href, label, match, onNav }: { href: string; label: string; match?: string; onNav?: () => void }) {
  const pathname = usePathname();
  const base = match || href.split("?")[0];
  const active = pathname === base || pathname.startsWith(base + "/");
  return (
    <Link
      href={href}
      onClick={onNav}
      className={`block rounded-md px-3 py-2 text-sm font-medium ${
        active ? "bg-steel-800 text-torque-400" : "hover:bg-steel-800 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: "OWNER" | "TECH" };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const nav = (
    <>
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        <NavLink href="/dashboard" label="Dashboard" onNav={close} />
        <NavLink href="/docs?kind=INVOICE" match="/docs" label="Invoices & Work" onNav={close} />
        <NavLink href="/customers" label="Customers" onNav={close} />
        <NavLink href="/followups" label="Follow-ups" onNav={close} />
        <NavLink href="/parts" label="Parts" onNav={close} />
        <NavLink href="/canned-jobs" label="Canned Jobs" onNav={close} />
        {user.role === "OWNER" && <NavLink href="/reports" label="Reports" onNav={close} />}
        {user.role === "OWNER" && <NavLink href="/settings" label="Settings" onNav={close} />}
      </nav>
      <div className="border-t border-steel-800 px-5 py-4">
        <div className="truncate text-sm font-medium text-white">{user.name}</div>
        <div className="text-xs text-steel-500">{user.role === "OWNER" ? "Owner" : "Tech"}</div>
        <div className="flex items-center gap-3 mt-2">
          <Link href="/account" onClick={close} className="text-xs text-steel-500 hover:text-torque-400">Account</Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-steel-500 hover:text-torque-400">
            Sign out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-steel-900 text-white px-4 py-3">
        <Link href="/dashboard" className="font-mono text-lg font-bold tracking-tight">
          Shop<span className="text-torque-400">Desk</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="p-2 -mr-2 text-steel-300 hover:text-white" aria-label="Menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/40" onClick={close}>
          <aside className="absolute top-12 left-0 bottom-0 w-64 flex flex-col bg-steel-900 text-steel-300 pt-2" onClick={(e) => e.stopPropagation()}>
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-56 flex-col bg-steel-900 text-steel-300">
        <Link href="/dashboard" className="px-5 py-5 font-mono text-xl font-bold tracking-tight text-white">
          Shop<span className="text-torque-400">Desk</span>
        </Link>
        {nav}
      </aside>

      <main className="lg:ml-56 px-4 sm:px-6 lg:px-8 py-5 lg:py-7">{children}</main>
    </div>
  );
}
