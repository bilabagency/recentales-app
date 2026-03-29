import AuthShell from "@/components/layout/auth-shell";
import BottomNav from "@/components/layout/bottom-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthShell>{children}</AuthShell>
      <BottomNav />
    </>
  );
}
