export type OfferCampaignType = 'product' | 'store_discount';

export type PublicOfferStatus = 'active' | 'ended';

export type OfferPassStatus = 'active' | 'redeemed' | 'expired';

/**
 * Mirrors api/src/referral/referral.dto.ts -> PublicOfferDto literally.
 * Monetary fields are integer minor units (100 = 1.00 new SYP) or null for store_discount.
 */
export interface PublicOffer {
  campaignId: string;
  campaignType: OfferCampaignType;
  shopName: string;
  shopDetails: string;
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  discountPercent: number;
  finalPriceSyp: number | null;
  endsAt: string;
  status: PublicOfferStatus;
  attributionLabel: string;
}

/**
 * Mirrors api/src/referral/referral.dto.ts -> OfferQrPassDto literally.
 * Never store qrToken or passCode inside SWR cache or AsyncStorage.
 */
export interface OfferQrPass {
  passId: string;
  campaignId: string;
  campaignType: OfferCampaignType;
  productName: string;
  shopName: string;
  discountPercent: number;
  finalPriceSyp: number | null;
  qrToken: string;
  passCode: string;
  status: OfferPassStatus;
  createdAt: string;
}

/**
 * Non-sensitive summary stored in customer-isolated SWR memory cache
 * so previously opened referral codes can be re-queried from the server.
 */
export interface RecentOpenedOfferEntry {
  code: string;
  campaignId: string;
  productName: string;
  shopName: string;
  openedAt: string;
}

export const REFERRAL_CODE_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

const APP_DEEP_LINK_SCHEME = 'alsalamiyahoffers';

function validateExtractedCode(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }

  const normalized = decoded.trim();
  return REFERRAL_CODE_REGEX.test(normalized) ? normalized : null;
}

function extractCodeFromPathSegments(pathSegments: string[]): string | null {
  if (pathSegments.length < 2) {
    return null;
  }

  let markerIndex = -1;
  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    if (pathSegments[index] === 'r' || pathSegments[index] === 'R') {
      markerIndex = index;
      break;
    }
  }

  if (markerIndex === -1 || markerIndex + 1 !== pathSegments.length - 1) {
    return null;
  }

  return validateExtractedCode(pathSegments[markerIndex + 1]);
}

function extractCodeFromUrl(parsed: URL, pathSegments: string[]): string | null {
  const fromPath = extractCodeFromPathSegments(pathSegments);
  if (fromPath) {
    return fromPath;
  }

  return validateExtractedCode(parsed.searchParams.get('code'));
}

/**
 * Safely extracts and validates a referral code matching backend's
 * ^[A-Za-z0-9_-]{1,128}$ pattern from:
 * - A direct code (e.g. "mk-demo01")
 * - A web link (e.g. "https://.../r/mk-demo01" or "https://.../customer?code=mk-demo01")
 * - A custom scheme deep link (e.g. "alsalamiyahoffers://r/mk-demo01" or "alsalamiyahoffers://customer?code=mk-demo01")
 */
export function extractReferralCode(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  if (REFERRAL_CODE_REGEX.test(trimmed)) {
    return trimmed;
  }

  const relativePathMatch = trimmed.match(/^\/?r\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (relativePathMatch) {
    return validateExtractedCode(relativePathMatch[1]);
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('?')) {
    try {
      const parsedRelative = new URL(trimmed, 'https://local.invalid');
      const relativeSegments = parsedRelative.pathname.split('/').filter(Boolean);
      const fromRelative = extractCodeFromUrl(parsedRelative, relativeSegments);
      if (fromRelative) {
        return fromRelative;
      }
    } catch {
      // Fall through to regex fallback below if needed.
    }
  }

  try {
    const parsed = new URL(trimmed);
    const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();

    if (scheme === 'http' || scheme === 'https') {
      if (!parsed.hostname) {
        return null;
      }
      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      return extractCodeFromUrl(parsed, pathSegments);
    }

    if (scheme === APP_DEEP_LINK_SCHEME) {
      const hostSegments = parsed.hostname ? [parsed.hostname] : [];
      const pathSegments = [
        ...hostSegments,
        ...parsed.pathname.split('/').filter(Boolean),
      ];
      return extractCodeFromUrl(parsed, pathSegments);
    }

    return null;
  } catch {
    if (trimmed.toLowerCase().startsWith(`${APP_DEEP_LINK_SCHEME}://`)) {
      const deepLinkMatch = trimmed.match(
        /^alsalamiyahoffers:\/\/\/?r\/([^/?#]+)\/?(?:[?#].*)?$/i,
      );
      if (deepLinkMatch) {
        return validateExtractedCode(deepLinkMatch[1]);
      }

      const queryFallbackMatch = trimmed.match(/[?&]code=([^&#]+)/i);
      if (queryFallbackMatch) {
        return validateExtractedCode(queryFallbackMatch[1]);
      }
    }

    if (trimmed.startsWith('/') || trimmed.startsWith('?')) {
      const relativeQueryMatch = trimmed.match(/[?&]code=([^&#]+)/i);
      if (relativeQueryMatch) {
        return validateExtractedCode(relativeQueryMatch[1]);
      }
    }

    return null;
  }
}
