/** Server-rendered heading so the title is not hydrated inside `ReadingsDashboard` (avoids text mismatches). */
export function ReadingsDashboardHeader() {
  return (
    <header className="relative z-[1] flex flex-col gap-4">
      <div className="min-w-0 max-w-[66vw]">
        <h1
          className="text-xl font-bold tracking-tight sm:text-2xl"
          style={{
            color: "var(--readings-header-title-color)",
            fontFamily: "var(--font-doto), ui-monospace, monospace",
          }}
        >
          Light Readings from my Brooklyn Apartment
        </h1>
        <p
          className="mt-1 text-sm font-normal"
          style={{
            color: "var(--app-text-subtle)",
            fontFamily: "var(--font-archivo), serif",
          }}
        >
          I am living in a long apartment in Bushwick that has windows that face east and west (southeast and northwest). I've installed LDR + ESP32 sensors on these windows, which sends light readings over my home network to a local server that writes to a database. This website shows the light readings collected overtime from these sensors. These lux values are then converted to music data in my studio.
        </p>
        <a
         style={{
          fontFamily: "var(--font-archivo), serif",
        }}
         href="https://github.com/lux2signal/lux2signal" className="text-sm text-blue-500 italic hover:underline">📝 Docs</a>
      </div>
    </header>
  );
}
