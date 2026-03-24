"use client";

export function ReadingsScopeSelector() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-sm font-medium"
        style={{ color: "var(--app-text-muted)" }}
      >
        Scope
      </span>
      <div
        className="flex w-fit flex-wrap rounded-none border p-0.5"
        style={{
          borderColor: "var(--app-card-border)",
          background: "var(--app-field-surface)",
        }}
        role="group"
        aria-label="Readings scope"
      >
        <button
          type="button"
          className="rounded-none px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: "var(--app-page-bg-accent)",
            color: "var(--app-text)",
          }}
          aria-pressed="true"
        >
          Single day
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
          title="Multi-day mode — coming soon"
          aria-disabled="true"
        >
          Multi-day
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
        </button>
      </div>
    </div>
  );
}
