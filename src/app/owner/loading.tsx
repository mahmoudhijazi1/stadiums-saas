import { Skeleton } from "@/components/ui/skeleton"

/**
 * Next loading.md: this file wraps page.tsx in Suspense. Skeleton cards for Today.
 */
export default function OwnerLoading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-11 w-24" />
      </div>
      <section className="flex flex-col gap-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </section>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </main>
  )
}
