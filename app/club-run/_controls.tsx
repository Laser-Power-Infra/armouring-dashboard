"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { acceptSfg, setCustomerDate, supplyFromStock } from "./actions";

function Err({ error }: { error: string | null }) {
  return error ? (
    <span role="alert" className="max-w-md text-caption text-critical">
      {error}
    </span>
  ) : null;
}

/** One server action on one click; its reason shows beside the button when it cannot be done. */
export function ActionButton({ action, children, variant = "secondary" }: { action: () => Promise<string | null>; children: React.ReactNode; variant?: ButtonVariant }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant={variant} loading={pending} onClick={() => start(async () => setError(await action()))}>
        {children}
      </Button>
      <Err error={error} />
    </span>
  );
}

/** Speaks one order's lot proposals (ElevenLabs, via our route); a second click stops it. */
export function ReadAloudButton({ prodOrder }: { prodOrder: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = () => {
    audio?.pause();
    setState("idle");
  };
  const play = async () => {
    setError(null);
    setState("loading");
    try {
      const res = await fetch(`/club-run/inbox/speak?order=${encodeURIComponent(prodOrder)}`);
      if (!res.ok) throw new Error(await res.text());
      const src = URL.createObjectURL(await res.blob());
      const a = new Audio(src);
      a.onended = () => {
        URL.revokeObjectURL(src);
        setState("idle");
      };
      setAudio(a);
      await a.play();
      setState("playing");
    } catch (e) {
      setError((e as Error).message || "Could not play.");
      setState("idle");
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2 print:hidden">
      <Button variant="quiet" loading={state === "loading"} aria-pressed={state === "playing"} onClick={state === "playing" ? stop : play}>
        {state === "playing" ? "Stop" : "Read aloud"}
      </Button>
      <Err error={error} />
    </span>
  );
}

/** The MD takes the held-back SFG figures for one order. */
export function AcceptSfgButton({ prodOrder }: { prodOrder: string }) {
  return <ActionButton action={acceptSfg.bind(null, prodOrder)}>Accept SFG</ActionButton>;
}

/** [Stock se do]: pick which stock supplies the order. */
export function StockPicker({ prodOrder }: { prodOrder: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Select
        aria-label={`Supply ${prodOrder} from stock`}
        disabled={pending}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) start(async () => setError(await supplyFromStock(prodOrder, v)));
        }}
      >
        <option value="">Give from stock…</option>
        <option>Dead stock</option>
        <option>Old stock</option>
        <option>Free stock</option>
      </Select>
      <Err error={error} />
    </span>
  );
}

/** The customer's delivery date, typed by the MD; saved when it changes. */
export function CustomerDate({ prodOrder, value }: { prodOrder: string; value: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="date"
        aria-label={`Customer date for ${prodOrder}`}
        className="h-8 w-36"
        disabled={pending}
        defaultValue={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => setError(await setCustomerDate(prodOrder, v)));
        }}
      />
      <Err error={error} />
    </span>
  );
}

/** Excel download of a table already on the page: CSV, which Excel opens. */
export function CsvButton({ name, rows }: { name: string; rows: (string | number | null)[][] }) {
  const download = () => {
    const cell = (v: string | number | null) => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return <Button onClick={download}>Excel</Button>;
}

/** The browser prints (or saves as PDF) the page. */
export function PrintButton() {
  return <Button onClick={() => window.print()}>PDF</Button>;
}
