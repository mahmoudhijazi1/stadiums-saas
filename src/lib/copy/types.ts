export type CopyTable = Record<string, string>;

/** One area of the interface copy: the Arabic table and its English twin (same keys). */
export type CopyArea = { ar: CopyTable; en: CopyTable };
