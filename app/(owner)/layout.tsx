import { AppShell } from "@/components/owner/app-shell";
import { requireOwner } from "@/lib/auth";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const user = await requireOwner();
  return <AppShell email={user.email ?? ""}>{children}</AppShell>;
}
