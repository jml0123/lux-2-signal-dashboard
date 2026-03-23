import { getReadingsSupabase, getSensorNamesSupabase } from "./api/readings.repo";
import { PlotData, ReadingDbDto } from "./readings.types";


export const getReadings = async (): Promise<ReadingDbDto[]> => {
    return getReadingsSupabase({ timestamps: [], location: '' });
}

export const getReadingsPlotData = async (): Promise<PlotData[]> => {
    const readings = await getReadings();
    return readings.map(reading => ({
        x: reading.timestamp,
        y: reading.value,
    }));
}

export const getAvailableSensors = async (): Promise<string[]> => {
    return getSensorNamesSupabase();
}