import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

function calculatePace(hours: number, minutes: number, seconds: number, distance: number, paceDistance: number) {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0 || distance <= 0) {
        return "";
    }
    // prefer under-estimation than over-estimation
    let paceSeconds = Math.ceil(paceDistance / (distance / totalSeconds));
    const parts: string[] = [];

    const hoursPace = Math.floor(paceSeconds / 3600);
    if (hoursPace > 0) {
        parts.push(`${hoursPace} hour${hoursPace > 1 ? "s" : ""}`);
        paceSeconds -= hoursPace * 3600;
    }
    const minutesPace = Math.floor(paceSeconds / 60);
    if (minutesPace > 0) {
        parts.push(`${minutesPace} minute${minutesPace > 1 ? "s" : ""}`);
        paceSeconds -= minutesPace * 60;
    }
    if (paceSeconds > 0) {
        parts.push(`${paceSeconds} second${paceSeconds > 1 ? "s" : ""}`);
    }

    return parts.join(" ");
}

interface Props {
    paceData: any;
    vdotData: any;
}

function normalizeWholeNumber(value: string) {
    if (value === "") {
        return 0;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return 0;
    }
    return Math.max(0, parsed);
}

function handleLeadingZeroKeydown(
    e: KeyboardEvent<HTMLInputElement>,
    currentValue: number,
    setValue: (value: number) => void,
) {
    if (currentValue !== 0 || e.ctrlKey || e.metaKey || e.altKey) {
        return;
    }
    if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setValue(Number(e.key));
    }
}

function WholeNumberInput({
    id,
    label,
    value,
    setValue,
}: {
    id: string;
    label: string;
    value: number;
    setValue: (value: number) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <label htmlFor={id}>{label}</label>
            <input
                type="number"
                id={id}
                className="border-b border-gray-700"
                inputMode="numeric"
                min={0}
                step={1}
                value={value}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => handleLeadingZeroKeydown(e, value, setValue)}
                onChange={(e) => setValue(normalizeWholeNumber(e.target.value))}
            />
        </div>
    );
}

export default function ({ paceData, vdotData }: Props) {
    const customDistanceValue = "custom";
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [seconds, setSeconds] = useState(0);
    const [distanceSelection, setDistanceSelection] = useState(String(paceData.metadata.distances[0]));
    const [customDistance, setCustomDistance] = useState(0);
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [age, setAge] = useState(0);

    const distance = distanceSelection === customDistanceValue ? customDistance : Number(distanceSelection);

    const paceKm = useMemo(() => {
        const pace = calculatePace(hours, minutes, seconds, distance, 1000);
        return pace ? `${pace} / km` : null;
    }, [hours, minutes, seconds, distance]);
    const paceMile = useMemo(() => {
        const pace = calculatePace(hours, minutes, seconds, distance, 1609.344);
        return pace ? `${pace} / mi` : null;
    }, [hours, minutes, seconds, distance]);
    const paceClassification = useMemo(() => {
        if (gender === null || age === 0) {
            return null;
        }
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        if (totalSeconds === 0) {
            return null;
        }

        const distanceData = paceData.data[distance];
        if (!distanceData) {
            return null;
        }

        const data = distanceData[gender];
        if (!data) {
            return null;
        }
        for (const [ageRange, ageRangeData] of Object.entries(data)) {
            const [minAge, maxAge] = ageRange.split("-").map(Number);
            if (age < minAge || age > maxAge) {
                continue;
            }

            const classifications = Object.keys(ageRangeData as any);
            for (const [classification, pace] of Object.entries(ageRangeData as any).toReversed()) {
                // pace is either mm:ss or hh:mm:ss, so we need to convert it to seconds
                const paceParts = (pace as string).split(":").map(Number);
                let paceSeconds = 0;
                if (paceParts.length === 2) {
                    paceSeconds = paceParts[0] * 60 + paceParts[1];
                } else if (paceParts.length === 3) {
                    paceSeconds = paceParts[0] * 3600 + paceParts[1] * 60 + paceParts[2];
                }

                if (totalSeconds <= paceSeconds || classification === classifications[0]) {
                    return classification;
                }
            }
        }
        return null;
    }, [gender, age, hours, minutes, seconds, distance, paceData]);

    const [vdotLevels, setVdotLevels] = useState<Record<string, any>>({});
    const vdot = useMemo(() => {
        if (distance === 0) {
            return 0;
        }

        const totalMinutes = hours * 60 + minutes + seconds / 60.0;
        const velocity = distance / totalMinutes;
        const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
        const vo2MaxSustained = 0.8 + 0.1894393 * Math.exp(-0.012778 * totalMinutes) + 0.2989558 * Math.exp(-0.1932605 * totalMinutes);
        const vdot = vo2 / vo2MaxSustained;
        return vdot;
    }, [hours, minutes, seconds, distance]);
    const vdotTier = useMemo(() => {
        for (const data of Object.values(vdotLevels).toReversed()) {
            if (vdot >= data.vdot) {
                return data.tier;
            }
        }
        return "Unknown";
    }, [vdot, vdotLevels]);

    useEffect(() => {
        if (paceData) {
            setDistanceSelection(String(paceData.metadata.distances[0]));
        }
    }, [paceData]);

    useEffect(() => {
        if (vdotData) {
            setVdotLevels(vdotData.data);
        }
    }, [vdotData]);

    return (
        <>
            <form className="grid gap-4 bangers-regular text-xl">
                <select
                    className="w-full border-b border-gray-700"
                    value={distanceSelection}
                    onChange={(e) => setDistanceSelection(e.target.value)}
                >
                    {Object.keys(paceData.metadata.distanceLabels).map((distance) => (
                        <option key={distance} value={distance}>{paceData.metadata.distanceLabels[distance]}</option>
                    ))}
                    <option value={customDistanceValue}>Custom</option>
                </select>
                {distanceSelection === customDistanceValue && (
                    <WholeNumberInput
                        id="customDistance"
                        label="Meters"
                        value={customDistance}
                        setValue={setCustomDistance}
                    />
                )}
                <div className="grid grid-cols-3 gap-4 time-input-div">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="hours">Hours</label>
                        <input
                            type="number"
                            id="hours"
                            className="border-b border-gray-700"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={hours}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleLeadingZeroKeydown(e, hours, setHours)}
                            onChange={(e) => setHours(normalizeWholeNumber(e.target.value))}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="minutes">Minutes</label>
                        <input
                            type="number"
                            id="minutes"
                            className="border-b border-gray-700"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={minutes}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleLeadingZeroKeydown(e, minutes, setMinutes)}
                            onChange={(e) => setMinutes(normalizeWholeNumber(e.target.value))}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="seconds">Seconds</label>
                        <input
                            type="number"
                            id="seconds"
                            className="border-b border-gray-700"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={seconds}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleLeadingZeroKeydown(e, seconds, setSeconds)}
                            onChange={(e) => setSeconds(normalizeWholeNumber(e.target.value))}
                        />
                    </div>
                </div>
            </form>
            <div className="h-5 w-full"></div>
            <h4 className="text-2xl text-gray-500 bangers-regular">Optional Fields (For Pace Classification)</h4>
            <div className="bangers-regular text-xl flex flex-row">
                <p>Gender: </p>
                <select
                    className="w-full border-b border-gray-700"
                    value={gender ?? ""}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                            setGender(null);
                        } else {
                            setGender(v as 'male' | 'female');
                        }
                    }}
                >
                    <option value="">Do not use</option>
                    {paceData.metadata.genders.map((g: string) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>
            </div>
            <div className="bangers-regular text-xl flex flex-row">
                <p>Age: </p>
                <input
                    type="text"
                    className="border-b border-gray-700"
                    value={age ?? ""}
                    onChange={(e) => setAge(e.target.value ? Number(e.target.value) : 0)}
                />
            </div>
            <div className="h-5 w-full"></div>
            <div className="text-3xl bangers-regular">
                {!paceKm && <p className="text-gray-500 bangers-regular">Enter time to calculate your pace and VDOT</p>}
                {paceKm && <p className="bangers-regular">{paceKm}</p>}
                {paceMile && <p className="bangers-regular">{paceMile}</p>}
                {paceClassification && <p className="bangers-regular">Your pace is considered {paceClassification}</p>}
                {paceKm && <p className="bangers-regular">Your VDOT is {vdot.toFixed(1)} ({vdotTier})</p>}
            </div>
        </>
    );
}