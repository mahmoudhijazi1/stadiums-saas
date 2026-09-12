import { Skeleton } from "@/components/ui/skeleton"

function TodayListsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-36 w-full rounded-xl" />
    </div>
  )
}

function BookSlotsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function OwnerRestSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  )
}

export {
  TodayListsSkeleton,
  BookSlotsSkeleton,
  OwnerRestSkeleton,
}
