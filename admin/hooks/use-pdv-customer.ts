"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { posApi } from "@/lib/api/pos";
import type { Customer } from "@/lib/types";
import { customerMatchesQuery, digitsOnly } from "@/lib/customer-profile";
import type { PdvBuyerProfile } from "@/components/pdv/pdv-customer-step";

export function usePdvCustomer(walkIn: Customer | null) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearching, setCustomerSearching] = useState(false);
  const [profile, setProfile] = useState<PdvBuyerProfile>("walkin");
  const [lastCustomer, setLastCustomer] = useState<Customer | null>(null);
  const [customerModal, setCustomerModal] = useState(false);

  useEffect(() => {
    if (walkIn?.id) setCustomerId(walkIn.id);
  }, [walkIn?.id]);

  const applyCustomer = useCallback((c: Customer) => {
    setCustomerId(c.id);
    setLastCustomer(c);
    if (c.residency === "paraguayan") setProfile("paraguayan");
    else if (c.residency === "foreigner") setProfile("foreigner");
  }, []);

  const searchCustomers = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setCustomers([]);
        setCustomerSearching(false);
        return;
      }
      try {
        const res = await posApi.searchCustomers(term);
        const items = (res.items ?? []).filter((c) => c.id !== walkIn?.id && customerMatchesQuery(c, term));
        setCustomers(items);
        const qDigits = digitsOnly(term);
        const exact = items.filter((c) => digitsOnly(c.document_id) && digitsOnly(c.document_id) === qDigits);
        if (qDigits.length >= 5 && exact.length >= 1) {
          applyCustomer(exact[0]);
        } else if (items.length === 1 && term.length >= 3) {
          applyCustomer(items[0]);
        }
      } catch {
        /* keep current list */
      } finally {
        setCustomerSearching(false);
      }
    },
    [walkIn?.id, applyCustomer],
  );

  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerSearching(false);
      setCustomers([]);
      return;
    }
    setCustomerSearching(true);
    const t = setTimeout(() => void searchCustomers(customerQuery), 200);
    return () => clearTimeout(t);
  }, [customerQuery, searchCustomers]);

  const selectedCustomer = useMemo(() => {
    if (customerId && customerId === walkIn?.id) return walkIn;
    return customers.find((c) => c.id === customerId) ?? lastCustomer ?? walkIn;
  }, [customers, customerId, walkIn, lastCustomer]);

  const identifiedHits = useMemo(
    () => customers.filter((c) => c.id !== walkIn?.id && customerMatchesQuery(c, customerQuery)),
    [customers, customerQuery, walkIn?.id],
  );

  const queryLockedToSelected = Boolean(
    selectedCustomer &&
      selectedCustomer.id !== walkIn?.id &&
      ((digitsOnly(customerQuery).length >= 5 &&
        digitsOnly(selectedCustomer.document_id) === digitsOnly(customerQuery)) ||
        selectedCustomer.name.toLowerCase() === customerQuery.trim().toLowerCase()),
  );

  const profileFallback =
    profile === "paraguayan" ? "Paraguaio" : profile === "foreigner" ? "Estrangeiro" : undefined;

  const chargesIVA = profile === "paraguayan";

  const effectiveCustomerId = profile === "walkin" ? walkIn?.id : customerId;

  const canFinalize = profile === "walkin" || Boolean(customerId && customerId !== walkIn?.id);

  function onProfileChange(next: PdvBuyerProfile) {
    setProfile(next);
    if (next === "walkin") {
      setCustomerId(walkIn?.id ?? "");
      setCustomerQuery("");
      setCustomers([]);
      setLastCustomer(null);
      return;
    }
    if (customerId === walkIn?.id) setCustomerId("");
  }

  function resetCustomer() {
    setCustomerId(walkIn?.id ?? "");
    setCustomerQuery("");
    setProfile("walkin");
    setCustomers([]);
    setLastCustomer(null);
  }

  function onCustomerCreated(customer: Customer) {
    applyCustomer(customer);
    setCustomers((prev) => [customer, ...prev.filter((c) => c.id !== customer.id)]);
    setCustomerQuery(customer.document_id ?? customer.name);
    setCustomerModal(false);
  }

  return {
    profile,
    onProfileChange,
    customerId,
    customerQuery,
    setCustomerQuery,
    customerSearching,
    identifiedHits,
    queryLockedToSelected,
    selectedCustomer,
    profileFallback,
    chargesIVA,
    effectiveCustomerId,
    canFinalize,
    customerModal,
    setCustomerModal,
    applyCustomer,
    resetCustomer,
    onCustomerCreated,
    lastCustomer,
    setLastCustomer,
  };
}
