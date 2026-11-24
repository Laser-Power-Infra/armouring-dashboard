// The 17 Kharagpur machines in the order the cards print them: the fixed machine table of
// docs/final guide for card 1.md, section 3.3 (the MD's decisions, 19-Nov Rev 2).
export type MachineInfo = {
  /** The machine's name in the "Machines to run daily" sheet (S4). */
  s4: string;
  /** Process on the plan rows and group on the cards. */
  group: string;
  makes: string;
  runs: string;
  speed?: string;
  feedFrom?: string;
  note?: string;
  /** Men in each shift as printed on the Labour Allocation Card. Card 1 reads its own figure from S4. */
  menPerShift: number;
};

const SKIP_RUNS = "Day and night on the days it has work";
const WD14_FEED = "Aluminium wire drawn on WD14";

export const MACHINES = {
  WD14: { s4: "Wire Drawing No 14", group: "Wire drawing", makes: "Drawn aluminium wire for the skip and multistrand machines", runs: "Every day any conductor machine runs", feedFrom: "Aluminium rod from store", note: "No job list", menPerShift: 2 },
  WD17: { s4: "Wire Drawing No 17", group: "Wire drawing", makes: "Drawn aluminium wire for ACSR Raccoon on Skip 10", runs: "Every Skip 10 day", feedFrom: "Aluminium rod from store", note: "No job list", menPerShift: 1 },
  "Skip (12+7)-1": { s4: "Skip Machine (12+7) - 1", group: "Skip strander", makes: "19-wire conductor 70 sq mm (19-wire never on Skip 10)", runs: SKIP_RUNS, speed: "10 core km a day", feedFrom: WD14_FEED, note: "70 left over runs first · 95 sq mm: machine to confirm", menPerShift: 2 },
  "Skip (12+7)-2": { s4: "Skip Machine (12-7)", group: "Skip strander", makes: "No size fixed: 50 sq mm machine to confirm", runs: SKIP_RUNS, speed: "11 core km a day", feedFrom: WD14_FEED, menPerShift: 2 },
  "Skip 8": { s4: "Skip Machine No 8", group: "Skip strander", makes: "Cable conductor 25, 35 sq mm", runs: SKIP_RUNS, speed: "25 core km a day", feedFrom: WD14_FEED, note: "16 sq mm: machine to confirm", menPerShift: 2 },
  "Skip 10": { s4: "Skip Machine No 10", group: "Skip strander", makes: "ACSR Raccoon", runs: SKIP_RUNS, speed: "23 km a day (= 10 drums of 2.5 km)", feedFrom: "Aluminium wire drawn on WD17", note: "Wound on FG drums; never 19-wire", menPerShift: 2 },
  "Skip 11": { s4: "Skip Machine No 11", group: "Skip strander", makes: "Covered conductor above 100 sq mm, first pass", runs: SKIP_RUNS, speed: "31.9 km a day", feedFrom: WD14_FEED, menPerShift: 2 },
  "MS-14": { s4: "Multi Strand No 14", group: "Multistrand", makes: "Power cable conductor 150–300 sq mm; Sioplas feed below 300 sq mm (e.g. 185)", runs: SKIP_RUNS, speed: "12.6 core km a day", feedFrom: WD14_FEED, menPerShift: 3 },
  "MS-11": { s4: "Multi Strand No 11", group: "Multistrand", makes: "Sioplas feed 300 sq mm and above, and power cable above 300", runs: SKIP_RUNS, speed: "12 core km a day", feedFrom: WD14_FEED, note: "HT conductor stock ≤ 27 core km", menPerShift: 4 },
  "MS-18": { s4: "Multi Strand No 18", group: "Multistrand", makes: "Covered conductor: 100 sq mm direct; above 100, final pass after Skip 11", runs: SKIP_RUNS, speed: "14.1 km a day", feedFrom: "100 sq mm: wire from WD14 · above 100: first-pass conductor from Skip 11", menPerShift: 2 },
  "Laying 5": { s4: "Laying Machine No 5", group: "Laying", makes: "All laying (no Laying 7 program)", runs: "Day and night", speed: "300 sq mm: 3 km a day · other: 7 km a day", feedFrom: "Insulated core from Extruder 22 and Extruder 35", note: "Laid + inner-sheathed stock kept to 22 km, paced to Armouring 5", menPerShift: 2 },
  "Armouring 5": { s4: "Armouring No 5", group: "Armouring", makes: "Armouring of all cables", runs: "Day and night", speed: "Big 7 km a day · small 10 km a day", feedFrom: "Inner-sheathed cable from Extruder 52", note: "Bottleneck: every other machine is paced to it", menPerShift: 3 },
  "Extruder 22": { s4: "Extruder No 22", group: "Extruder", makes: "XLPE insulation 300, 150, 95, 25 sq mm", runs: "Day and night", speed: "300/150: 16 · 95: 24 · 25: 30 core km a day; ≤ 3.5 t XLPE / 5.5 t PVC a day", feedFrom: "Conductor from the skip and multistrand machines", menPerShift: 4 },
  "Extruder 35": { s4: "Extruder No 35", group: "Extruder", makes: "All insulation 16, 35, 50, 70 sq mm", runs: "Day and night", speed: "12 core km a day; ≤ 2.5 t XLPE / 3.5 t PVC a day", feedFrom: "Conductor from the skip machines", menPerShift: 3 },
  "Extruder 51": { s4: "Extruder No 51", group: "Extruder", makes: "Resting: runs only when the factory says", runs: "Only when the factory says", speed: "Inner 12 · outer 13 km a day; ≤ 6 t PVC a day", feedFrom: "Inner sheath: laid cable from Laying 5 · Outer sheath: armoured cable from Armouring 5", note: "Round conductor only; inner sheath up to 30 mm, outer up to 40 mm", menPerShift: 0 },
  "Extruder 52": { s4: "Extruder No 52", group: "Extruder", makes: "All inner and outer sheath (Extruder 51 is resting)", runs: "Day and night", speed: "Inner big 9 / small 12 · outer big 8 / small 13 km a day; ≤ 7.5 t PVC / 5.5 t HDPE a day", feedFrom: "Inner sheath: laid cable from Laying 5 · Outer sheath: armoured cable from Armouring 5", menPerShift: 4 },
  "Sioplas 4": { s4: "Sioplass Line 4", group: "Sioplas", makes: "HT core, then covered conductor 120 sq mm", runs: "Day and night", speed: "HT 9 core km a day · covered conductor 23 km a day", feedFrom: "Conductor from MS-11 · covered conductor from MS-18", note: "HT first", menPerShift: 7 },
} satisfies Record<string, MachineInfo>;

export type MachineName = keyof typeof MACHINES;
export const MACHINE_ORDER = Object.keys(MACHINES) as MachineName[];

/** The slowest step: this machine decides the finish date. */
export const BOTTLENECK: MachineName = "Armouring 5";

/** Wire drawing has no jobs of its own: it runs on the days the machines it feeds run. */
export const RUNS_WITH: Partial<Record<MachineName, MachineName[]>> = {
  WD14: ["Skip (12+7)-1", "Skip (12+7)-2", "Skip 8", "Skip 11", "MS-14", "MS-11", "MS-18"],
  WD17: ["Skip 10"],
};

/** Orders (number after the dash) whose sheathing the factory has sent to Extruder 51. Empty: E51 is resting, all sheathing is on E52. */
export const EXT51_ORDERS: number[] = [];
