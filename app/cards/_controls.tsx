"use client";

import { usePathname, useRouter } from "next/navigation";
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

/** The browser prints the card as A4 landscape pages, as the PDF cards are made. */
export function PrintButton() {
  return <Button onClick={() => window.print()}>Print</Button>;
}
