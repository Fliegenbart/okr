import { getAuthenticatedViewer } from "@/lib/active-couple";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ThinkingPartnerFloating } from "@/components/dashboard/thinking-partner-floating";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAuthenticatedViewer();
  const showThinkingPartner = Boolean(viewer?.isAdmin || viewer?.isPreviewingCouple);

  return (
    <>
      <DashboardHeader />
      {children}
      {showThinkingPartner ? <ThinkingPartnerFloating /> : null}
    </>
  );
}
