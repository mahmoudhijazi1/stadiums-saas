function EmptyState({ title, next }: { title: string; next: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-sheet)] border border-dashed border-line-strong px-6 py-8 text-center">
      <p className="font-display text-2xl leading-tight font-extrabold">{title}</p>
      <p className="text-sm text-ink-muted">{next}</p>
    </div>
  )
}

export { EmptyState }
