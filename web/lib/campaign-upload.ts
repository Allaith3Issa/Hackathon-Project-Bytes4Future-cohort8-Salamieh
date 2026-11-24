import "server-only";

import { createHash, createHmac } from "node:crypto";
import { ApiError } from "./api";
import { httpImageUrl } from "./product-image";
import { authenticatedRequest, sessionTokens } from "./session";
import { logoutScope } from "./session-logout";

export interface CampaignUpload {
  imageUrl: string;
  receipt: string;
}

export async function campaignFormSession(merchantId: string) {
  const { sessionId } = logoutScope(await sessionTokens());
  if (!sessionId) return null;
  const scope = createHash("sha256").update(JSON.stringify(["campaign-form", merchantId, sessionId])).digest("hex");
  return { sessionId, scope };
}

export async function uploadCampaignImage(file: File, sessionId: string, previous?: CampaignUpload): Promise<CampaignUpload> {
  const digest = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  // The verified session ID stays server-side and is stable across access-token refresh.
  const receiptFor = (url: string) => createHmac("sha256", sessionId).update(JSON.stringify(["campaign-image", digest, url])).digest("hex");
  if (previous && typeof previous.imageUrl === "string" && previous.receipt === receiptFor(previous.imageUrl)) return previous;

  const body = new FormData();
  body.set("file", file);
  const response = await authenticatedRequest<{ imageUrl: string }>("/merchant/uploads/image", { method: "POST", body });
  const url = httpImageUrl(response?.imageUrl);
  if (!url?.startsWith("https://")) throw new ApiError(502, "IMAGE_UPLOAD_FAILED");
  return { imageUrl: url, receipt: receiptFor(url) };
}
