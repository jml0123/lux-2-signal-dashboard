// Get readings from supabase

import { GetReadingRequest, ReadingDbDto } from "../readings.types";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!);

export const getReadingsSupabase = async (request: GetReadingRequest): Promise<ReadingDbDto[]> => {
    const { data, error } = await supabase.from('readings').select('*').in('timestamp', request.timestamps).eq('location', request.location);
    if (error) {
        throw new Error(error.message);
    }
    return data;
}


export const getSensorNamesSupabase = async (): Promise<string[]> => {
    const { data, error } = await supabase.from('sensor_list').select('*');
    if (error) {
        throw new Error(error.message);
    }
    return data.map((row: { sensor: string }) => row.sensor);
}