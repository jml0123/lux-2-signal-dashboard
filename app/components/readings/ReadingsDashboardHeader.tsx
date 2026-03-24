import { ThemeToggle } from "@/app/components/theme/ThemeToggle";

/** Server-rendered heading so the title is not hydrated inside `ReadingsDashboard` (avoids text mismatches). */
export function ReadingsDashboardHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1
          className="font-display text-xl font-bold tracking-[-0.02em] sm:text-2xl"
          style={{ color: "var(--chart-title-date)" }}
        >
          Lux 2 Signal
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--app-text-subtle)" }}
        />
      </div>
      <ThemeToggle />
    </header>
  );
}
