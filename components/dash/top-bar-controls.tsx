"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

/** Machine is a choice on the screen (md §9): the same dashboard serves Armouring 1, 4, 6. */
export function MachinePicker({ current, machines }: { current: string; machines: { code: string; label: string }[] }) {
  const router = useRouter();
  if (machines.length < 2) return null;
  return (
    <Select className="shrink-0" aria-label="Machine" value={current} onChange={(e) => router.push(`/dashboard/${e.target.value.toLowerCase()}`)}>
      {machines.map((m) => (
        <option key={m.code} value={m.code}>
          {m.label}
        </option>
      ))}
    </Select>
  );
}

/** Re-reads every block from the database; each table reloads when its block's data-as-of time moves. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="quiet" loading={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Refreshing" : "Refresh"}
    </Button>
  );
}
