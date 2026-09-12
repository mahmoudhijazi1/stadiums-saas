import { Skeleton } from "@/components/ui/skeleton"

/** Avoid inheriting the public hours skeleton on /login (root loading.tsx). */
export default function LoginLoading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-10">
      <Skeleton className="h-72 w-full max-w-sm rounded-xl" />
    </main>
  )
}
