import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";

function formatSeconds(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const parts: string[] = [];

    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds}s`);
    }

    return parts.join(" ");
}

export default function ({ data }: any) {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);
    const [distance, setDistance] = useState<number>(data.metadata.distances[0]);
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [initVersion, setInitVersion] = useState(0);

    useEffect(() => {
        const obj = data.data[distance][gender];
        if (!obj) {
            return;
        }

        // Use the canonical order from metadata.skill_level_definitions
        const skillLevels: string[] = Object.keys(data.metadata.skill_level_definitions);

        // Helper to find a skill value in either Title Case or lowercase keys
        const findSkillValue = (ageRangeData: any, skillLabel: string) => {
            if (ageRangeData.hasOwnProperty(skillLabel)) return ageRangeData[skillLabel];
            const lower = skillLabel.toLowerCase();
            if (ageRangeData.hasOwnProperty(lower)) return ageRangeData[lower];
            return undefined;
        };

        const seriesMapping: Record<string, number[]> = {};

        // Initialize arrays for each skill level to preserve order
        for (const s of skillLevels) seriesMapping[s] = [];

        // Iterate age groups in metadata order to collect values by skill level
        for (const ageRange of data.metadata.age_groups) {
            const ageRangeData = obj[ageRange];
            if (!ageRangeData) continue;
            for (const skillLabel of skillLevels) {
                const time = findSkillValue(ageRangeData, skillLabel);
                let seconds = 0;
                if (typeof time === 'string') {
                    const timeParts = time.split(":");
                    if (timeParts.length === 3) {
                        seconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
                    } else if (timeParts.length === 2) {
                        seconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
                    }
                }
                seriesMapping[skillLabel].push(seconds);
            }
        }

        const series: echarts.SeriesOption[] = skillLevels.map((name) => ({ type: 'line', name, data: seriesMapping[name] }));

        const chart = echarts.init(chartRef.current);
        chartInstanceRef.current = chart;
        const options: echarts.EChartsOption = {
            title: {
                text: "Finish Time Across Skill Levels",
            },
            legend: {
                data: Object.keys(data.metadata.skill_level_definitions),
                selectedMode: "multiple"
            },
            grid: {
                left: '5%',
                right: '5%'
            },
            xAxis: {
                type: "category",
                name: "Age Group",
                data: data.metadata.age_groups,
                nameLocation: 'middle',
            },
            yAxis: {
                type: "value",
                name: "Finish Time",
                nameLocation: 'middle',
                nameGap: 40,
                nameRotate: 90,
                axisLabel: {
                    formatter: (value: number) => formatSeconds(value),
                },
            },
            tooltip: {
                trigger: "axis",
                formatter: (params) => {
                    const items = Array.isArray(params) ? params : [params];
                    return items
                        .map((item: any) => `${item.seriesName}: ${formatSeconds(Number(item.value))}`)
                        .join("<br/>");
                },
            },
            series
        };
        chart.setOption(options);
        chart.resize(); // ensure initial render respects CSS size

        const onResize = () => chartInstanceRef.current?.resize();
        window.addEventListener('resize', onResize);

        return () => {
            chart.dispose();
            chartInstanceRef.current = null;
            window.removeEventListener('resize', onResize);
        };
    }, [distance, gender, data, initVersion])

    useEffect(() => {
        const handler = (e: any) => {
            const tab = e?.detail;
            if (tab !== 'pace') return;
            setInitVersion((v) => v + 1);
        };
        window.addEventListener('pace-tab-changed', handler as EventListener);
        return () => window.removeEventListener('pace-tab-changed', handler as EventListener);
    }, []);

    return (
        <div className="w-full mx-auto">
            <div className="flex gap-3 mb-3">
                <select className="border-b border-gray-700" value={distance} onChange={(e) => setDistance(Number(e.target.value))}>
                    {data.metadata.distances.map((d: number) => <option key={d} value={d}>{data.metadata.distanceLabels[d]}</option>)}
                </select>
                <select className="border-b border-gray-700" value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                </select>
            </div>
            <div id="pace-chart" ref={chartRef} className="w-full aspect-video" />
        </div>
    );
}