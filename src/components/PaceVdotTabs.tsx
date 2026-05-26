import React, { useEffect, useState } from "react";
import PaceChart from "./PaceChart";
import VdotChart from "./VdotChart";

interface Props {
    paceData: any;
    vdotData: any;
}

export default function PaceVdotTabs({ paceData, vdotData }: Props) {
    const [active, setActive] = useState<'pace' | 'vdot'>('pace');
    const [selectedZone, setSelectedZone] = useState<string>('Easy');

    useEffect(() => {
        const saved = localStorage.getItem('pace_active_tab');
        if (saved) setActive(saved as 'pace' | 'vdot');
    }, []);

    useEffect(() => {
        localStorage.setItem('pace_active_tab', active);
        window.dispatchEvent(new CustomEvent('pace-tab-changed', { detail: active }));
    }, [active]);

    return (
        <div>
            <div className="bg-black text-white text-2xl flex flex-row items-stretch p-8 cossette-titre-regular">
                <div
                    className={`flex-1 pr-8 ${active === 'pace' ? 'active' : ''}`}
                    data-tab-trigger="pace"
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive('pace')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive('pace'); } }}
                >
                    <h1 className="cossette-titre-bold mb-4 text-center text-5xl">Distance Pace</h1>
                    <p className="mb-4">
                        Pace is the standard measurement of fitness level for a fixed
                        distance. Extremely effective for progressing at a specific
                        distance. Standardized training plans utilizes pace to further
                        currate individual training.
                    </p>
                </div>
                <div className="bg-white w-px self-stretch mx-6" aria-hidden="true"></div>
                <div
                    className={`flex-1 pl-8 ${active === 'vdot' ? 'active' : ''}`}
                    data-tab-trigger="vdot"
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive('vdot')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive('vdot'); } }}
                >
                    <h1 className="cossette-titre-bold mb-4 text-center text-5xl">VDOT Metric</h1>
                    <p className="mb-4">
                        VDOT is the absolute measurement of fitness level across
                        different distances. Originally created by Jack Daniels, VDOT
                        predicts both the aerobotic capacity and running economy in one
                        number from race results. VDOT provides different training plans
                        from Jack Daniel's five training zones.
                    </p>
                </div>
            </div>
            <div className="flex">
                <div className="flex-1 flex justify-center pr-8">
                    <div
                        className="border-l-18 border-r-18 border-t-30 border-l-transparent border-r-transparent border-t-black mx-2"
                        data-arrow-for="pace"
                        aria-hidden="true"
                        style={{ display: active === 'pace' ? 'block' : 'none' }}
                    />
                </div>
                <div className="bg-white w-px self-stretch mx-6" aria-hidden="true"></div>
                <div className="flex-1 flex justify-center pl-8">
                    <div
                        className="border-l-18 border-r-18 border-t-30 border-l-transparent border-r-transparent border-t-black mx-2"
                        data-arrow-for="vdot"
                        aria-hidden="true"
                        style={{ display: active === 'vdot' ? 'block' : 'none' }}
                    />
                </div>
            </div>

            <div className="p-8 text-xl bangers-regular" data-tab-content="pace" style={{ display: active === 'pace' ? 'block' : 'none' }}>
                <div className="flex flex-col lg:flex-row lg:gap-8">
                    <div className="lg:flex-1">
                        <PaceChart data={paceData} />
                    </div>
                    <div className="lg:flex-1 text-3xl flex flex-col gap-4">
                        {
                            Object.entries(paceData.metadata.skill_level_definitions).map(
                                ([level, definition]: [string, any]) => (
                                    <p key={level} style={{ color: paceData.metadata.skill_level_colors[level] }}>
                                        <span className="cossette-titre-bold">{level}</span>: <span className="cossette-titre-regular">{definition}</span>
                                    </p>
                                ),
                            )
                        }
                    </div>
                </div>
            </div>

            <div className="p-8 text-xl bangers-regular" data-tab-content="vdot" style={{ display: active === 'vdot' ? 'block' : 'none' }}>
                <div className="flex flex-col lg:flex-row lg:gap-16">
                    <div className="lg:flex-1">
                        <VdotChart data={vdotData} />
                    </div>
                    <div className="lg:flex-1 text-3xl flex flex-col gap-4">
                        {
                            Object.entries(vdotData.metadata.tier_definitions).map(
                                ([tier, definitionObject]: [string, any]) => (
                                    <p key={tier} style={{ color: (definitionObject as any).color }}>
                                        <span className="cossette-titre-bold">{tier}</span>: <span className="cossette-titre-regular">{definitionObject.definition}</span>
                                    </p>
                                ),
                            )
                        }
                    </div>
                </div>
            </div>
            <div className="p-8 text-xl bangers-regular bg-black text-white" data-tab-content="vdot" style={{ display: active === 'vdot' ? 'block' : 'none' }}>
                <h1 className="text-7xl cossette-titre-bold mb-10">Training Zones</h1>
                <div className="flex flex-col gap-8 lg:flex-row lg:gap-8">
                    <div className="lg:flex-1 flex flex-col gap-0 text-3xl">
                        {
                            Object.entries(vdotData.metadata.training_zones).map(([zoneName]: [string, any]) => (
                                <button
                                    key={zoneName}
                                    onClick={() => setSelectedZone(zoneName)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedZone(zoneName); } }}
                                    className={`text-left p-3 cursor-pointer transition-colors ${selectedZone === zoneName ? 'bg-white text-black' : 'hover:bg-gray-800'
                                        }`}
                                >
                                    <span className="cossette-titre-bold">{zoneName}</span>
                                </button>
                            ))
                        }
                    </div>
                    <div className="lg:flex-1">
                        {selectedZone && vdotData.metadata.training_zones[selectedZone] && (
                            <div className="flex flex-col gap-6">
                                <div>
                                    <h2 className="text-5xl cossette-titre-bold mb-4">{selectedZone}</h2>
                                    <p className="text-3xl cossette-titre-regular">{vdotData.metadata.training_zones[selectedZone].purpose}</p>
                                </div>
                                <div className="flex flex-col gap-4 text-2xl">
                                    <div>
                                        <span className="cossette-titre-bold">%VO2max:</span>
                                        <span className="cossette-titre-regular ml-2">{vdotData.metadata.training_zones[selectedZone].percent_vo2max}</span>
                                    </div>
                                    <div>
                                        <span className="cossette-titre-bold">%Max HR:</span>
                                        <span className="cossette-titre-regular ml-2">{vdotData.metadata.training_zones[selectedZone].percent_max_hr}</span>
                                    </div>
                                    <div>
                                        <span className="cossette-titre-bold">Typical Duration:</span>
                                        <span className="cossette-titre-regular ml-2">{vdotData.metadata.training_zones[selectedZone].typical_duration}</span>
                                    </div>
                                    {vdotData.metadata.training_zones[selectedZone].recommended_volume_share && (
                                        <div>
                                            <span className="cossette-titre-bold">Recommended Volume Share:</span>
                                            <span className="cossette-titre-regular ml-2">{vdotData.metadata.training_zones[selectedZone].recommended_volume_share}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
