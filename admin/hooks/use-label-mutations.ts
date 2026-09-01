"use client";

import { useCallback } from "react";
import { labelsApi } from "@/lib/api/labels";
import { useApiMutation } from "./use-api-mutation";

export type LabelBatchInput = {
  format: "pdf" | "html";
  items: { type: string; code: string }[];
};

export function useLabelBatchExport() {
  const mutate = useCallback((body: LabelBatchInput) => labelsApi.batch(body), []);
  return useApiMutation(mutate);
}
