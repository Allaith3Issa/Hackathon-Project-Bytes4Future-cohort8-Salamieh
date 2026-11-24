import { validReferral } from "./ui";
import { httpImageUrl } from "./product-image";

export const discoverCampaignsPath = "/marketer/campaigns";
export const marketerMembershipsPath = "/marketer/memberships";

export const campaignTypes = ["product", "store_discount"] as const;
export const campaignJoinModes = ["open", "approval_required"] as const;
export const membershipStatuses = ["approved", "pending", "rejected"] as const;

export interface DiscoverableCampaign {
  id: string;
  productName: string;
  shopName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  finalPriceSyp: number | null;
  discountPercent: number;
  commission: { type: "fixed"; amountSyp: number } | { type: "percentage"; percent: number };
  campaignType: (typeof campaignTypes)[number];
  joinMode: (typeof campaignJoinModes)[number];
  status: "active" | "ended";
  endsAt: string;
}

export interface MarketerMembership {
  id: string;
  status: (typeof membershipStatuses)[number];
  campaign: DiscoverableCampaign;
  referralUrl: string | null;
  stats: { clicks: number; itemsSold: number; earnedSyp: number };
}

export type CampaignListPath = typeof discoverCampaignsPath | typeof marketerMembershipsPath;
export type CampaignSearchParams = Record<string, string | string[] | undefined>;
export const campaignIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function marketerCampaignDetailPath(id: string) {
  return `${discoverCampaignsPath}/${encodeURIComponent(id)}` as const;
}

export function publicReferral(value: string | null) {
  const safe = httpImageUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.search || url.hash) return null;
  const code = /^\/r\/([^/]+)$/.exec(url.pathname)?.[1];
  return code && validReferral(code) ? url.href : null;
}

export function campaignListQuery(
  source: Pick<URLSearchParams, "getAll">,
  path: CampaignListPath,
) {
  function single(key: string) {
    const [value, extra] = source.getAll(key);
    return extra === undefined ? value ?? "" : "";
  }

  const query = new URLSearchParams();
  for (const [key, max] of [["page", Number.MAX_SAFE_INTEGER], ["pageSize", 100]] as const) {
    const value = single(key);
    const number = Number(value);
    if (/^[0-9]+$/.test(value) && Number.isSafeInteger(number) && number >= 1 && number <= max) {
      query.set(key, String(number));
    }
  }
  if (path === discoverCampaignsPath) {
    const search = single("q").trim().slice(0, 100);
    if (search) query.set("q", search);
    for (const [key, values] of [["campaignType", campaignTypes], ["joinMode", campaignJoinModes]] as const) {
      const value = single(key);
      if (values.some((option) => option === value)) query.set(key, value);
    }
  } else {
    const status = single("status");
    if (status === "all" || membershipStatuses.some((option) => option === status)) query.set("status", status);
  }
  return query;
}

export function campaignPageHref(path: CampaignListPath, query: URLSearchParams, page?: number) {
  const params = new URLSearchParams(query);
  if (page !== undefined) {
    if (page === 1) params.delete("page");
    else params.set("page", String(page));
  }
  return params.size ? `${path}?${params}` : path;
}
