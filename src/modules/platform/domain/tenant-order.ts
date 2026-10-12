/**
 * The order of the web admin's stadium list (DR-006): suspended first (they need a decision), then
 * overdue (they owe), then the rest, each group by name. The CLI list keeps its own order (by
 * slug); only the web page sorts with this.
 */
type Orderable = { name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; overdue: boolean };

function rank(row: Orderable): number {
  if (row.status === "SUSPENDED") return 0;
  return row.overdue ? 1 : 2;
}

export function orderTenantsForAdmin<T extends Orderable>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      a.slug.localeCompare(b.slug),
  );
}
