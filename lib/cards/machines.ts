// The 17 Kharagpur machines in the order the cards print them (build spec 4):
// wire drawing, skip, multistrand, laying, armouring, then extruders and Sioplas.
// The facts are the MD's decisions as printed on the approved cards (build spec 3.3, 5.1).
// They live here until the sheet carries them (build spec 11).
export type MachineInfo = {
  group: string;
  makes: string;
  runs: string;
  speed?: string;
  feedFrom?: string;
  note?: string;
  /** Men needed in each shift, set by the MD only. 0 = the machine is at rest. */
  menPerShift: number;
};

const SKIP_RUNS = "Day and night on the days it has work";
const WD14_FEED = "Aluminium wire drawn on WD14";

export const MACHINES = {
  WD14: { group: "Wire drawing", makes: "Drawn aluminium wire for the skip and multistrand machines of the next day", runs: "Day shift only", feedFrom: "Aluminium rod from store", menPerShift: 2 },
  WD17: { group: "Wire drawing", makes: "Drawn aluminium wire for ACSR Raccoon on Skip 10", runs: "Day shift only", speed: "About 5.0 t of aluminium rod a day", feedFrom: "Aluminium rod from store", menPerShift: 1 },
  "Skip (12+7)-1": { group: "Skip strander", makes: "19-wire conductor, 70 and 95 sq mm", runs: SKIP_RUNS, feedFrom: WD14_FEED, note: "If any 70 sq mm is left it runs first, then 95 sq mm", menPerShift: 2 },
  "Skip (12+7)-2": { group: "Skip strander", makes: "50 sq mm conductor", runs: SKIP_RUNS, feedFrom: WD14_FEED, note: "Runs only as far ahead as Extruder 35 needs", menPerShift: 2 },
  "Skip 8": { group: "Skip strander", makes: "Cable conductor 25, 35 and 16 sq mm", runs: SKIP_RUNS, feedFrom: WD14_FEED, note: "ACSR Raccoon runs here only when the yard gives 19 drums a day", menPerShift: 2 },
  "Skip 10": { group: "Skip strander", makes: "ACSR Raccoon conductor", runs: SKIP_RUNS, speed: "23 km a day = 10 drums a day", feedFrom: "Aluminium wire drawn on WD17", note: "Wound straight on finished drums, so drums must be ready the day before. Never 19-wire conductor on this machine", menPerShift: 2 },
  "Skip 11": { group: "Skip strander", makes: "Covered conductor 120 sq mm, first pass", runs: SKIP_RUNS, feedFrom: "Alloy rod from store", note: "Starts when Sioplas 4 is about 3 days from finishing HT core. Final pass is on MS-18", menPerShift: 2 },
  "MS-14": { group: "Multistrand", makes: "Power cable conductor, 150 to 300 sq mm", runs: SKIP_RUNS, feedFrom: WD14_FEED, note: "Starts only when the earlier lots are nearly laid", menPerShift: 3 },
  "MS-11": { group: "Multistrand", makes: "Conductor of 300 sq mm and above for Sioplas 4", runs: SKIP_RUNS, speed: "12 core km a day", feedFrom: WD14_FEED, note: "Kept at most 3 days ahead of Sioplas 4", menPerShift: 4 },
  "MS-18": { group: "Multistrand", makes: "Covered conductor 120 sq mm, final pass", runs: SKIP_RUNS, feedFrom: "First-pass conductor from Skip 11", menPerShift: 2 },
  "Laying 5": { group: "Laying", makes: "All laying", runs: "Day and night", speed: "300 sq mm: at most 3 km a day · other sizes: at most 7 km a day", feedFrom: "Insulated core from Extruder 22 and Extruder 35", note: "Laid cable is held to what sheathing and armouring can take", menPerShift: 2 },
  "Armouring 5": { group: "Armouring", makes: "Armouring of all cables", runs: "Day and night", speed: "7 km a day on big cables · 10 km a day on small cables", feedFrom: "Inner-sheathed cable from Extruder 52, made the day before", note: "Armour strip or wire size is taken from the material list of each cable", menPerShift: 3 },
  "Extruder 22": { group: "Extruder", makes: "XLPE insulation of 300, 150, 95 and 25 sq mm", runs: "Day and night", speed: "At most 3.5 t of XLPE a day", feedFrom: "Conductor from the skip and multistrand machines", note: "Insulated core is kept less than a day ahead of laying", menPerShift: 4 },
  "Extruder 35": { group: "Extruder", makes: "All insulation up to 70 sq mm (16, 35, 50, 70)", runs: "Day and night", speed: "At most 2.5 t of XLPE or 3.5 t of PVC a day", feedFrom: "Conductor from the skip machines", note: "XLPE and PVC are run in long batches to keep changes few", menPerShift: 3 },
  "Extruder 51": { group: "Extruder", makes: "Nothing in this period", runs: "At rest", note: "MD decision of 17-Nov: all sheathing is on Extruder 52. Takes work only if the plant asks", menPerShift: 0 },
  "Extruder 52": { group: "Extruder", makes: "All sheathing: inner and outer, big and small cables", runs: "Day and night", speed: "At most 5.5 t of HDPE or 7 t of PVC a day · about 10 km a day", feedFrom: "Inner sheath: laid cable from Laying 5 · Outer sheath: armoured cable from Armouring 5", note: "Extruder 51 is at rest. Jobs it could take are marked on this card", menPerShift: 4 },
  "Sioplas 4": { group: "Sioplas", makes: "HT core 300 sq mm, then covered conductor 120 sq mm", runs: "Day and night", speed: "HT core: 9 core km a day", feedFrom: "Conductor from MS-11 · covered conductor from MS-18", note: "Cured core goes on the daily HT Core Transfer Card", menPerShift: 7 },
} satisfies Record<string, MachineInfo>;

export type MachineName = keyof typeof MACHINES;
export const MACHINE_ORDER = Object.keys(MACHINES) as MachineName[];

/** The slowest step: this machine decides the finish date. */
export const BOTTLENECK: MachineName = "Extruder 52";

/** Wire drawing has no jobs of its own: it runs on the days the machines it feeds run. */
export const RUNS_WITH: Partial<Record<MachineName, MachineName[]>> = {
  WD14: ["Skip (12+7)-1", "Skip (12+7)-2", "Skip 8", "MS-14", "MS-11", "Skip 11", "MS-18"],
  WD17: ["Skip 10"],
};

/** Orders (short number) on Extruder 52 that Extruder 51 could take; the plant decides (MD, 17-Nov). */
export const EXT51_COULD_TAKE = ["265", "295", "278", "208", "192", "209"];
