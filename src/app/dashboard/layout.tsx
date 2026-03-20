import { getAuthenticatedViewer } from "@/lib/active-couple";
import { canUseThinkingPartnerPersona } from "@/lib/beta-access";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ThinkingPartnerFloating } from "@/components/dashboard/thinking-partner-floating";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAuthenticatedViewer();
  const canUsePersona = await canUseThinkingPartnerPersona(viewer?.email);

  return (
    <>
      <DashboardHeader />
      {children}
      <ThinkingPartnerFloating canUsePersona={canUsePersona} />
    </>
  );
}
