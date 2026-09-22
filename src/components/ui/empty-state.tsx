function EmptyState({ title, next }: { title: string; next: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{next}</p>
    </div>
  )
}

export { EmptyState }
