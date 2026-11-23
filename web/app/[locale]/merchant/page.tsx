import { redirectLocalized } from "@/lib/i18n-server";

export default function MerchantIndex() {
  return redirectLocalized("/merchant/campaigns/new");
}
