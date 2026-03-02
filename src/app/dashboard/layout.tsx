import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardProviders } from "./providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <DashboardProviders>{children}</DashboardProviders>;
}
