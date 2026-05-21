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

    useEffect(() => {
        const seriesMapping: Record<string, number[]> = {};
        const obj = data.data[distance][gender];
        if (!obj) {
            return;
        }

        // Since we're adding to each series in order, we can just push to the end
        for (const [_ageRange, ageRangeData] of Object.entries(obj)) {
            for (const [skillLevel, time] of Object.entries(ageRangeData as any)) {
                const timeParts = (time as string).split(":");
                let seconds = 0;
                if (timeParts.length === 3) {
                    seconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
                } else if (timeParts.length === 2) {
                    seconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
                }
                if (!seriesMapping[skillLevel]) {
                    seriesMapping[skillLevel] = [];
                }
                seriesMapping[skillLevel].push(seconds);
            }
        }
        const series: echarts.SeriesOption[] = Array.from(Object.entries(seriesMapping).map(([name, data]) => ({
            type: 'line',
            name,
            data,
        })));

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
    }, [distance, gender, data])

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