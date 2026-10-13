"use client";

/**
 * Back to wherever the visitor was (an owner stays in the owner app, a player on the stadium page).
 * Only when there is no earlier page in this tab does it go to "/" of the same host.
 */
export function BackButton({ label, className }: { label: string; className: string }) {
  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }
  return (
    <button type="button" className={className} onClick={goBack}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 rtl:-scale-x-100">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
