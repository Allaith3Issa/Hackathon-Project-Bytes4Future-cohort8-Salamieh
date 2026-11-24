"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { compressProductImage } from "@/lib/compress-product-image";
import { productImageTypes } from "@/lib/product-image";

type Selection = { file: File; originalBytes: number };
type ImageError = "invalidType" | "sourceTooLarge" | "compressionFailed";

export function ProductImagePicker({ selection, onChange, onBusy, disabled, error }: {
  selection: Selection | null;
  onChange: (selection: Selection | null) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
  error?: string;
}) {
  const { t, formatNumber } = useI18n();
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const inProgress = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ImageError>();
  const [preview, setPreview] = useState<string>();
  const file = selection?.file;
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function choose(source?: File) {
    if (!source || disabled || inProgress.current) return;
    if (!productImageTypes.includes(source.type)) return setMessage("invalidType");
    if (source.size > 20_000_000) return setMessage("sourceTooLarge");
    setMessage(undefined);
    inProgress.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const next = await compressProductImage(source);
      onChange({ file: next, originalBytes: source.size });
    } catch {
      setMessage("compressionFailed");
    } finally {
      inProgress.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <fieldset className="min-w-0 space-y-3" aria-describedby={`${id}-hint`}>
      <legend className="text-sm font-semibold">{t("productImage.label")}</legend>
      <p id={`${id}-hint`} className="text-sm text-muted">{t("productImage.hint")}</p>
      <div className="grid gap-3 rounded-lg border border-dashed border-control p-3"
        onDragOver={(event) => { event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
        {file && preview && (
          <img src={preview} alt={t("productImage.preview")} className="aspect-[4/3] w-full max-w-xs rounded-lg bg-mauve object-contain" />
        )}
        {selection && <p className="text-sm text-muted">{t("productImage.sizes", {
          before: formatNumber(Math.ceil(selection.originalBytes / 1000)),
          after: formatNumber(Math.ceil(selection.file.size / 1000)),
        })}</p>}
        <div className="flex flex-wrap gap-2">
          <input ref={picker} type="file" accept={productImageTypes.join(",")} hidden onChange={(event) => {
            void choose(event.currentTarget.files?.[0]); event.currentTarget.value = "";
          }} />
          <input ref={camera} type="file" accept={productImageTypes.join(",")} capture="environment" hidden onChange={(event) => {
            void choose(event.currentTarget.files?.[0]); event.currentTarget.value = "";
          }} />
          <button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => picker.current?.click()}>
            {t(file ? "productImage.replace" : "productImage.choose")}
          </button>
          <button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => camera.current?.click()}>{t("productImage.camera")}</button>
          {file && <button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => {
            setMessage(undefined); setPreview(undefined); onChange(null);
          }}>{t("productImage.remove")}</button>}
        </div>
      </div>
      {busy && <p role="status" className="text-sm text-muted">{t("productImage.compressing")}</p>}
      {(message || error) && <p role="alert" className="notice-error">{message ? t(`productImage.${message}`) : error}</p>}
    </fieldset>
  );
}
