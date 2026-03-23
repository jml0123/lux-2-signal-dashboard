import { ReadingDbDto } from "../readings.types";

const cacheSensorsList = async (sensorsList: string[]) => {
    localStorage.setItem('sensorsList', JSON.stringify(sensorsList));
    // Expiry: 1 day
}

const cacheReadingsForDate = async (readings: ReadingDbDto[], dayMonthYear: string) => {
    localStorage.setItem(`readings-${dayMonthYear}`, JSON.stringify(readings));
    // Expiry: 1 hour
}