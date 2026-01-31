import { ThinkingPartnerFloating } from "@/components/dashboard/thinking-partner-floating";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ThinkingPartnerFloating />
    </>
  );
}

