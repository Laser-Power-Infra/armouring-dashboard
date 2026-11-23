// Values both the server and the browser need. No imports: the browser bundle must not pull in the query layer.

export const PAGE_SIZES = [5, 10, 25, 50] as const;

/** Filter value for "no value" (NULL or empty); the table labels it "(blank)". */
export const BLANK = "";
