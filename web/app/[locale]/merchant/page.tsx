import { RecoveringSession } from "@/components/recovering-session";
import { redirectLocalized } from "@/lib/i18n-server";
import { requirePageRole } from "@/lib/staff";

export default async function MerchantIndex() {
  if (!(await requirePageRole("merchant"))) return <RecoveringSession />;
  return redirectLocalized("/merchant/campaigns/new");
}
