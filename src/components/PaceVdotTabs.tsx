import React, { useEffect, useState } from "react";
import PaceChart from "./PaceChart";
import VdotChart from "./VdotChart";

interface Props {
    paceData: any;
    vdotData: any;
}

export default function PaceVdotTabs({ paceData, vdotData }: Props) {
    const [active, setActive] = useState<'pace' | 'vdot'>('pace');

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
            <div className="bg-black text-white text-3xl flex flex-row items-stretch p-8 cossette-titre-regular">
                <div
                    className={`flex-1 pr-8 ${active === 'pace' ? 'active' : ''}`}
                    data-tab-trigger="pace"
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive('pace')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive('pace'); } }}
                >
                    <h2 className="cossette-titre-bold mb-4 text-center">Distance Pace</h2>
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
                    <h2 className="cossette-titre-bold mb-4 text-center">VDOT Metric</h2>
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
                <PaceChart data={paceData} />
                {
                    Object.entries(paceData.metadata.skill_level_definitions).map(
                        ([level, definition]: [string, any]) => (
                            <p key={level}>
                                {level}: {definition}
                            </p>
                        ),
                    )
                }
            </div>

            <div className="p-8 text-xl bangers-regular" data-tab-content="vdot" style={{ display: active === 'vdot' ? 'block' : 'none' }}>
                <VdotChart data={vdotData} />
                {
                    Object.entries(vdotData.metadata.tier_definitions).map(
                        ([tier, definitionObject]: [string, any]) => (
                            <p key={tier}>
                                {tier}: {definitionObject.definition}
                            </p>
                        ),
                    )
                }
                {
                    Object.values(vdotData.metadata.training_zones).map((zone: any) => (
                        <p key={zone.name}>
                            {zone.name}: {zone.purpose}
                        </p>
                    ))
                }
            </div>
        </div>
    );
}
