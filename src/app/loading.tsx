import { Skeleton } from "@/components/ui/skeleton"

/**
 * Next loading.md: this file wraps page.tsx in Suspense. Slot-shaped cards.
 */
export default function PublicLoading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-8">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </main>
  )
}
