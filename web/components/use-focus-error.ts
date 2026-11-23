"use client";
import { useEffect, type RefObject } from "react";

/** Moves focus to the first invalid field, or to the form-level alert, whenever `signal` changes. */
export function useFocusError(form: RefObject<HTMLElement | null>, signal: unknown) {
  useEffect(() => {
    const el = form.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    if (!el) return;
    if (el.getAttribute("role") === "alert") el.tabIndex = -1;
    el.focus();
  }, [form, signal]);
}
