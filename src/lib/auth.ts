import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; role: "OWNER" | "TECH"; shopId: string };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "OWNER" | "TECH";
    shopId: string;
  }
}

// Simple in-memory login throttle: 5 failures / 15 min per email.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function throttled(email: string): boolean {
  const a = attempts.get(email);
  if (!a || Date.now() > a.resetAt) return false;
  return a.count >= MAX_FAILS;
}
function recordFail(email: string) {
  const a = attempts.get(email);
  if (!a || Date.now() > a.resetAt) attempts.set(email, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else a.count++;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const email = creds.email.toLowerCase().trim();
        if (throttled(email)) throw new Error("Too many attempts. Try again in 15 minutes.");
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = user && (await bcrypt.compare(creds.password, user.passwordHash));
        if (!ok) {
          recordFail(email);
          return null;
        }
        attempts.delete(email);
        return { id: user.id, name: user.name, email: user.email, role: user.role, shopId: user.shopId } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.shopId = (user as any).shopId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.shopId = token.shopId;
      return session;
    },
  },
};

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.shopId) throw new Error("Unauthorized");
  return session;
}

export async function requireOwner() {
  const session = await requireSession();
  if (session.user.role !== "OWNER") throw new Error("Owner access required");
  return session;
}
