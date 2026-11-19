import { DataTable } from "@/components/ui/data-table";
import { getTableEnv } from "@/lib/dashboard/data";
import { clientColumns, TABLES, type TableName } from "@/lib/tables/defs";
import { defaultParams } from "@/lib/tables/params";
import { fetchRows } from "@/lib/tables/query";

/**
 * One of the dashboard's tables. Page 1 is rendered here on the server with the same query the
 * browser later calls, so the table arrives filled; from then on the browser asks for one page at a time.
 * `version` is the block's data-as-of time: when a refresh brings newer data, the table reloads with it.
 */
export async function ServerTable({ name, machineCode, version }: { name: TableName; machineCode: string; version: Date | null }) {
  const def = TABLES[name];
  const initial = await fetchRows(def, defaultParams(def, machineCode), await getTableEnv());
  return (
    <DataTable
      key={machineCode}
      table={def.name}
      machine={machineCode}
      title={def.title}
      columns={clientColumns(def)}
      initial={initial}
      defaultSort={def.defaultSort}
      defaultSize={def.defaultSize}
      version={version?.toISOString() ?? "never"}
    />
  );
}
