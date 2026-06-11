import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return <AppShell user={{ name: user.name, role: user.role }}>{children}</AppShell>;
}
