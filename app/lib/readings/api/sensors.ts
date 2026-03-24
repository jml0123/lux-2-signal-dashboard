import { getSensorNamesSupabase } from "./readings.repo";

export async function fetchSensorNames(): Promise<string[]> {
  return getSensorNamesSupabase();
}
