// The 17 Kharagpur machines in the order the cards print them (build spec 4):
// wire drawing, skip, multistrand, laying, armouring, then extruders and Sioplas.
export const MACHINE_ORDER = [
  "WD14",
  "WD17",
  "Skip (12+7)-1",
  "Skip (12+7)-2",
  "Skip 8",
  "Skip 10",
  "Skip 11",
  "MS-14",
  "MS-11",
  "MS-18",
  "Laying 5",
  "Armouring 5",
  "Extruder 22",
  "Extruder 35",
  "Extruder 51",
  "Extruder 52",
  "Sioplas 4",
] as const;

export type MachineName = (typeof MACHINE_ORDER)[number];
