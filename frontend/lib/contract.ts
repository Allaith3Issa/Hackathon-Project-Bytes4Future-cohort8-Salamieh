export type Role = "admin" | "customer" | "marketer" | "merchant";

export interface Account {
  id: string;
  name: string;
  phone: string;
  roles: Role[];
  createdAt: string;
  merchant: {
    name: string;
    details: string;
    verificationStatus: "pending" | "verified" | "rejected";
    contractReference: string | null;
  } | null;
  customer: {
    verifiedPurchaseCount: number;
    availableCashbackSyp: number;
    lockedCashbackSyp: number;
  } | null;
}

export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  user: Account;
}

export interface PublicOffer {
  campaignId: string;
  campaignType: "product" | "store_discount";
  shopName: string;
  shopDetails: string;
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  discountPercent: number;
  finalPriceSyp: number | null;
  endsAt: string;
  status: "active" | "ended";
  attributionLabel: string;
}

export interface OfferQrPass {
  passId: string;
  campaignId: string;
  campaignType: PublicOffer["campaignType"];
  productName: string;
  shopName: string;
  discountPercent: number;
  finalPriceSyp: number | null;
  qrToken: string;
  passCode: string;
  status: "active" | "redeemed" | "expired";
  createdAt: string;
}

export interface CustomerDashboard {
  verifiedPurchaseCount: number;
  milestonePurchaseCount: number;
  milestonePurchasesRequired: number;
  milestoneSpendSyp: number;
  milestoneSpendRequiredSyp: number;
  lockedCashbackSyp: number;
  availableCashbackSyp: number;
  totalCashbackUnlockedSyp: number;
}

export interface CustomerPurchase {
  saleId: string;
  shopName: string;
  productName: string;
  quantity: number;
  customerPaidCashSyp: number;
  cashbackEarnedSyp: number;
  scannedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  previousPage: number | null;
  nextPage: number | null;
}
