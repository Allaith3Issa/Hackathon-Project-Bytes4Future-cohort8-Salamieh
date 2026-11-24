"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { httpImageUrl } from "@/lib/product-image";

export function CampaignImage({ url, alt, fallback, className }: {
  url: string | null | undefined;
  alt: string;
  fallback: ReactNode;
  className: string;
}) {
  const source = httpImageUrl(url);
  return source ? <RemoteImage key={source} source={source} alt={alt} fallback={fallback} className={className} /> : fallback;
}

function RemoteImage({ source, alt, fallback, className }: {
  source: string;
  alt: string;
  fallback: ReactNode;
  className: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth === 0) setFailed(true);
  }, []);
  // External campaign images load in the browser, never through Next's image optimizer.
  return failed ? fallback : <img ref={image} src={source} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={className} onError={() => setFailed(true)} />;
}
