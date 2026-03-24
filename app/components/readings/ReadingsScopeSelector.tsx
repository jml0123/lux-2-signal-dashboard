"use client";

export function ReadingsScopeSelector() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="font-display flex w-fit flex-wrap gap-px rounded-md border p-0.5 shadow-sm"
        style={{
          borderColor: "var(--app-card-border)",
          background: "var(--app-card-surface)",
        }}
        role="group"
        aria-label="Readings scope"
      >
        <button
          type="button"
          className="rounded-sm px-2 py-1 text-xs font-semibold leading-tight transition-colors"
          style={{
            background: "var(--app-page-bg-accent)",
            color: "var(--chart-title-date)",
          }}
          aria-pressed="true"
        >
          Day
        </button>
        <button
          type="button"
          disabled
          className="rounded-sm px-2 py-1 text-xs font-normal leading-tight"
          style={{
            color: "var(--app-text-subtle)",
            cursor: "not-allowed",
            opacity: 0.65,
          }}
          title="Multi-day mode — coming soon"
          aria-disabled="true"
        >
          Multi-day
          <span className="sr-only">(coming soon)</span>
        </button>
        {/* <button
          type="button"
          disabled
          className="rounded-none px-3 py-1.5 text-xs font-medium"
          style={{
            color: "var(--app-text-subtle)",
            cursor: "not-allowed",
            opacity: 0.65,
          }}
          title="MIDI mode — coming soon"
          aria-disabled="true"
        >
          MIDI
          <span className="sr-only">(coming soon)</span>
        </button>
        <button
          type="button"
          disabled
          className="rounded-none px-3 py-1.5 text-xs font-medium"
          style={{
            color: "var(--app-text-subtle)",
            cursor: "not-allowed",
            opacity: 0.65,
          }}
          title="Wavetable/LFO mode — coming soon"
          aria-disabled="true"
        >
          Wavetable/LFO
          <span className="sr-only">(coming soon)</span>
        </button> */}
      </div>
    </div>
  );
}
