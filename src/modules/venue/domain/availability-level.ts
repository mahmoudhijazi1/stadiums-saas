/** How full a day looks in the day strip: 3 dots plenty, 2 some, 1 almost gone, 0 an empty ring. */
export type AvailabilityLevel = 0 | 1 | 2 | 3;

/** From the number of free times a day still has (closed and full days both have none). */
export function availabilityLevel(freeCount: number): AvailabilityLevel {
  if (freeCount <= 0) return 0;
  if (freeCount === 1) return 1;
  if (freeCount <= 3) return 2;
  return 3;
}
