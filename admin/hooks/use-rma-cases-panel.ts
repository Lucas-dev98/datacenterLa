"use client";

import { useCallback, useEffect, useState } from "react";
import { useRmaStep } from "@/hooks/use-rma-step";
import { rmaApi, type RMACase } from "@/lib/api/rma";
import { defaultRmaResolution } from "@/lib/rma-resolution";
import { useToast } from "@/components/toast-provider";

type Options = {
  items: RMACase[];
  defectConfirmed: boolean;
  onError: (message: string) => void;
  clearError?: () => void;
  onRefresh?: () => void | Promise<unknown>;
};

export function useRmaCasesPanel({ items, defectConfirmed, onError, clearError, onRefresh }: Options) {
  const toast = useToast();
  const { run: runRmaStep } = useRmaStep();

  const [expandedCaseId, setExpandedCaseId] = useState("");
  const [expandedCase, setExpandedCase] = useState<RMACase | null>(null);
  const [resolveById, setResolveById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!expandedCaseId) {
      setExpandedCase(null);
      return;
    }
    void (async () => {
      try {
        const detail = await rmaApi.get(expandedCaseId);
        setExpandedCase(detail);
      } catch {
        setExpandedCase(items.find((c) => c.id === expandedCaseId) ?? null);
      }
    })();
  }, [expandedCaseId, items]);

  useEffect(() => {
    if (defectConfirmed) {
      setResolveById((prev) => {
        const next = { ...prev };
        for (const [id, value] of Object.entries(next)) {
          if (value === "restock") next[id] = "scrap";
        }
        return next;
      });
    }
  }, [defectConfirmed]);

  const toggleCase = useCallback((id: string) => {
    setExpandedCaseId((current) => (current === id ? "" : id));
  }, []);

  async function action(id: string, step: "approve" | "receive" | "resolve", resolution?: string) {
    clearError?.();
    const rmaCase = items.find((c) => c.id === id);
    const bodyResolution = resolution ?? (rmaCase ? defaultRmaResolution(rmaCase) : "scrap");
    try {
      await runRmaStep({
        id,
        step,
        body: step === "resolve" ? { resolution: bodyResolution } : undefined,
      });
      toast.push(`RMA ${step}${step === "resolve" ? ` (${bodyResolution})` : ""}`, "success");
      await onRefresh?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro na ação");
    }
  }

  return {
    expandedCaseId,
    expandedCase,
    resolveById,
    setResolveById,
    toggleCase,
    action,
  };
}
