/** Set `READINGS_DEBUG_LOGS=1` in .env / Vercel to enable. */
export function readingsDebugLog(tag: string, payload: unknown): void {
  if (process.env.READINGS_DEBUG_LOGS !== "1") return;
  console.log(
    `[readings] ${tag}`,
    typeof payload === "object" && payload !== null
      ? JSON.stringify(payload)
      : payload,
  );
}
