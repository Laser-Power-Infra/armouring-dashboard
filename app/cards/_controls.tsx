"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { confirmIssue, regenerateCards } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

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

/** Syncs the source sheets and stores a new revision of today's four cards; the reason shows here when it cannot. */
export function RegenerateButton() {
  const [error, run, pending] = useActionState(regenerateCards, null);
  const [note, setNote] = useState("");
  return (
    <>
      {error && !pending && (
        <span role="alert" className="max-w-md whitespace-pre-line text-caption text-critical">
          {error}
        </span>
      )}
      <Input className="w-44" aria-label="Note for the new version" placeholder="Note for this version" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button loading={pending} onClick={() => startTransition(() => run(note))}>
        {pending ? "Regenerating…" : "Regenerate"}
      </Button>
    </>
  );
}

/** Takes the review mark off the issue. */
export function ConfirmButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <Button loading={pending} onClick={() => start(() => confirmIssue(id))}>
      Confirm issue
    </Button>
  );
}

/** The browser prints the card as A4 landscape pages, as the PDF cards are made. */
export function PrintButton() {
  return <Button onClick={() => window.print()}>Print</Button>;
}
