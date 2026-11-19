import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Badge, Panel, Stat } from "@/components/ui/panel";
import { Empty, ErrorNote, Skeleton } from "@/components/ui/feedback";
import { Popover } from "@/components/ui/popover";
import { Bars, SplitBar } from "@/components/dash/charts";
import { Glyph } from "@/components/dash/glyph";

export const metadata = { title: "Design system" };
export const instant = false;

const colours = [
  ["ground", "Page background"],
  ["surface", "Panels, tables, popovers"],
  ["ink", "Main text"],
  ["ink-2", "Secondary text"],
  ["ink-3", "Hints, placeholders"],
  ["line", "Control borders"],
  ["line-2", "Row dividers"],
  ["primary", "Action, link, selection, main series"],
  ["primary-tint", "Selected ground"],
  ["secondary", "Second series, machine with no work"],
  ["secondary-tint", "Second series ground"],
  ["critical", "Status: problem"],
  ["warning", "Status: attention"],
  ["good", "Status: fine"],
] as const;

const type = [
  ["text-headline", "Headline figure 48", "42.6 km"],
  ["text-figure", "Figure 34", "212 km"],
  ["text-page", "Page title 24", "Armouring 5"],
  ["text-title", "Block title 20", "Cable ready for armouring"],
  ["text-body", "Body 16", "Inner sheath done, armouring not done."],
  ["text-label", "Label, table cell 14", "Tata Power · 3C x 240 sqmm"],
  ["text-caption", "Caption 12", "Data as of 18 Nov, 07:28"],
] as const;

/** Every component in every state. Checked by eye before a screen is built from it. */
export default async function DesignSystemPage() {
  await connection();
  // Open while developing; in production only an admin may see it (proxy.ts guards /admin only).
  if (process.env.NODE_ENV === "production" && (await auth())?.user?.role !== "admin") notFound();

  const asOf = { at: new Date("2026-11-18T02:00:00Z"), stale: false, staleHours: 12 };

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-page">Design system</h1>

      <Group title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {colours.map(([name, use]) => (
            <li key={name}>
              <div className="h-12 border border-line-2" style={{ background: `var(--${name})` }} />
              <div className="mt-1.5 text-label font-medium">{name}</div>
              <div className="text-caption font-normal text-ink-2">{use}</div>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Type">
        <dl className="space-y-3">
          {type.map(([cls, role, sample]) => (
            <div key={cls} className="flex flex-wrap items-baseline gap-x-6">
              <dt className="w-44 shrink-0 text-caption text-ink-2">{role}</dt>
              <dd className={`num ${cls}`}>{sample}</dd>
            </div>
          ))}
        </dl>
      </Group>

      <Group title="Buttons">
        <Row label="Default">
          <Button variant="primary">Sign in</Button>
          <Button>Clear filters</Button>
          <Button variant="quiet">Refresh</Button>
          <IconButton label="Next page">
            <Chev />
          </IconButton>
        </Row>
        <Row label="Loading">
          <Button variant="primary" loading>
            Signing in
          </Button>
          <Button loading>Refreshing</Button>
        </Row>
        <Row label="Disabled">
          <Button variant="primary" disabled>
            Sign in
          </Button>
          <Button disabled>Previous</Button>
          <Button variant="quiet" disabled>
            Refresh
          </Button>
        </Row>
      </Group>

      <Group title="Fields">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" placeholder="name@company.com" />
          </Field>
          <Field label="Password" error="Wrong email or password.">
            <Input type="password" aria-invalid defaultValue="secret" />
          </Field>
          <Field label="Machine">
            <Select defaultValue="ARM5">
              <option value="ARM4">Armouring 4</option>
              <option value="ARM5">Armouring 5</option>
            </Select>
          </Field>
          <Field label="Disabled">
            <Input disabled defaultValue="Not editable" />
          </Field>
        </div>
        <Row label="Checkbox">
          <Checkbox label="Tata Power" defaultChecked />
          <Checkbox label="Adani Energy" />
          <Checkbox label="Disabled" disabled />
        </Row>
      </Group>

      <Group title="Popover">
        <Button popoverTarget="ds-popover">Customer</Button>
        <Popover id="ds-popover">
          <div className="space-y-1 p-1.5">
            <Checkbox label="Tata Power" defaultChecked />
            <Checkbox label="Adani Energy" />
          </div>
        </Popover>
      </Group>

      <Group title="Badges">
        <Row label="Status">
          <Badge tone="critical">Slowest</Badge>
          <Badge tone="warning">Not approved</Badge>
          <Badge tone="good">In plan</Badge>
          <Badge tone="neutral">Day shift</Badge>
        </Row>
      </Group>

      <Group title="Figures">
        <div className="grid gap-6 sm:grid-cols-4">
          <Stat size="headline" label="Cable ready" value="42.6" unit="km" note="4.2 days of work" />
          <Stat size="headline" label="Work left" value="212" unit="km" note="21 days" tone="warning" />
          <Stat label="Bobbins to wind" value="18" note="running and next jobs" />
          <Stat label="Not approved" value="31.4" unit="km" tone="critical" />
        </div>
      </Group>

      <Panel id="ds-panel" title="Panel" subtitle="Title, icon, data-as-of time, then content" glyph="drum" asOf={asOf}>
        <div className="grid gap-8 lg:grid-cols-2">
          <Bars
            label="Output by shift day"
            unit="km"
            legend={[
              { name: "Day", color: "--primary" },
              { name: "Night", color: "--secondary" },
            ]}
            bars={["14 Nov", "15 Nov", "16 Nov", "17 Nov", "18 Nov"].map((d, i) => ({
              key: d,
              axis: d,
              tip: `${d}: ${2 + i * 0.4} km`,
              segments: [
                { name: "Day", value: 1.2 + i * 0.3, color: "--primary" },
                { name: "Night", value: 0.8 + i * 0.1, color: "--secondary" },
              ],
            }))}
          />
          <SplitBar
            label="Bobbin pool"
            parts={[
              { name: "Loaded", value: 24, color: "--primary" },
              { name: "Filled", value: 12, color: "--secondary" },
              { name: "Empty", value: 30, color: "--line" },
              { name: "Badly wound", value: 3, color: "--warning" },
              { name: "Broken", value: 1, color: "--critical" },
            ]}
          />
        </div>
      </Panel>

      <Group title="Loading, empty, error">
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Skeleton rows={4} />
          <Empty action={<Button>Clear filters</Button>}>No orders match.</Empty>
          <ErrorNote message="Could not load this table. The database may be waking up." />
        </div>
      </Group>

      <Group title="Icons">
        <Row label="One stroke weight">
          {(["drum", "layers", "twist", "core", "shield", "chart", "people", "spool", "clock", "list"] as const).map((g) => (
            <span key={g} className="text-ink-2">
              <Glyph name={g} size={20} />
            </span>
          ))}
        </Row>
      </Group>
    </main>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-panel border border-line-2 bg-surface p-5 sm:p-6">
      <h2 className="mb-5 text-title">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 text-caption text-ink-2">{label}</span>
      {children}
    </div>
  );
}

function Chev() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
