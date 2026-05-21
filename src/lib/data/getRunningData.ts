import { readFile } from "node:fs/promises";

const PACE_DATA_PATH = new URL("../../../public/data/pace.json", import.meta.url);
const VDOT_DATA_PATH = new URL("../../../public/data/vdot.json", import.meta.url);

async function getJsonData(path: URL): Promise<any> {
    const contents = await readFile(path, "utf8");
    return JSON.parse(contents);
}

export async function getRunningData() {
    const paceData = await getJsonData(PACE_DATA_PATH);
    const vdotData = await getJsonData(VDOT_DATA_PATH);
    return { paceData, vdotData };
}