import { getServerSession } from "next-auth/next";
import { authOptions } from "./config";

export type UserRole = "admin" | "editor" | "viewer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }
  return user;
}

export async function requireRole(
  ...roles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("AUTH_FORBIDDEN");
  }
  return user;
}
