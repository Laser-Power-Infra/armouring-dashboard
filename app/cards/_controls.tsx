"use client";

import { startTransition, useActionState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { regenerateCard1 } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

/** Every stored issue, newest first. The newest needs no query string. */
export function IssuePicker({ current, issues }: { current: number; issues: { id: number; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  if (issues.length < 2) return null;
  return (
    <Select className="shrink-0" aria-label="Card version" value={current} onChange={(e) => router.push(Number(e.target.value) === issues[0].id ? path : `${path}?issue=${e.target.value}`)}>
      {issues.map((i, n) => (
        <option key={i.id} value={i.id}>
          {i.name}
          {n === 0 ? " (latest)" : ""}
        </option>
      ))}
    </Select>
  );
}

/** Syncs the source sheets and stores a new revision of today's Card 1; the reason shows here when it cannot. */
export function RegenerateButton() {
  const [error, run, pending] = useActionState(regenerateCard1, null);
  return (
    <>
      {error && !pending && (
        <span role="alert" className="max-w-md whitespace-pre-line text-caption text-critical">
          {error}
        </span>
      )}
      <Button loading={pending} onClick={() => startTransition(run)}>
        {pending ? "Regenerating…" : "Regenerate"}
      </Button>
    </>
  );
}

/** The browser prints the card as A4 landscape pages, as the PDF cards are made. */
export function PrintButton() {
  return <Button onClick={() => window.print()}>Print</Button>;
}
