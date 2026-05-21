import * as echarts from "echarts";
import { useEffect, useMemo, useRef } from "react";

function getTierOrder(vdotRange: string) {
    const match = vdotRange.match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function getTierColor(index: number) {
    const colors = [
        "#d97706",
        "#f59e0b",
        "#84cc16",
        "#06b6d4",
        "#3b82f6",
        "#8b5cf6",
    ];

    return colors[index % colors.length];
}

interface Props {
    data: any;
}

export default function VdotChart({ data }: Props) {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);

    const tiers = useMemo(() => {
        return Object.entries(data.metadata.tier_definitions)
            .sort(([, left], [, right]) => getTierOrder((left as any).vdot_range) - getTierOrder((right as any).vdot_range))
            .map(([tier, definition]: [string, any], index) => {
                const values = Object.values(data.data)
                    .filter((entry: any) => entry.tier === tier)
                    .map((entry: any) => entry.vdot)
                    .sort((left: number, right: number) => left - right);

                return {
                    tier,
                    range: definition.vdot_range,
                    values,
                    color: getTierColor(index),
                };
            });
    }, [data]);

    useEffect(() => {
        if (!chartRef.current) {
            return;
        }

        const chart = echarts.init(chartRef.current);
        chartInstanceRef.current = chart;

        const options: echarts.EChartsOption = {
            title: {
                text: "VDOT Values by Tier",
            },
            grid: {
                left: "4%",
                right: "4%",
                containLabel: true,
            },
            xAxis: {
                type: "category",
                name: "VDOT Tier",
                nameLocation: "middle",
                nameGap: 30,
                data: tiers.map((tier) => tier.tier),
                axisLabel: {
                    interval: 0,
                    rotate: 0,
                },
            },
            yAxis: {
                type: "value",
                name: "VDOT Value",
                nameLocation: "middle",
                nameGap: 40,
                nameRotate: 90,
                min: 0,
            },
            tooltip: {
                trigger: "item",
                formatter: (params) => {
                    const item = params as any;
                    const tier = tiers.find((entry) => entry.tier === item.seriesName);
                    const range = tier?.range ? ` (${tier.range})` : "";
                    const value = Array.isArray(item.value) ? item.value[1] : item.value;
                    return `${item.seriesName}${range}<br/>VDOT: ${Number(value).toFixed(0)}`;
                },
            },
            series: tiers.map((tier) => ({
                name: tier.tier,
                type: "custom",
                dimensions: ["tier", "vdot", "index"],
                encode: {
                    x: "tier",
                    y: "vdot",
                    tooltip: ["tier", "vdot"],
                },
                data: tier.values.map((value, index) => [tier.tier, value, index]),
                renderItem: (params: any, api: any) => {
                    const value = Number(api.value(1));
                    const count = tier.values.length;
                    const categoryPoint = api.coord([tier.tier, value]);
                    const zeroPoint = api.coord([tier.tier, 0]);
                    const bandWidth = api.size([1, 0])[0];
                    const barWidth = Math.max(6, Math.min(18, bandWidth / Math.max(count * 1.5, 1)));
                    const totalWidth = barWidth * count;
                    const x = categoryPoint[0] - totalWidth / 2 + params.dataIndex * barWidth;
                    const y = Math.min(categoryPoint[1], zeroPoint[1]);
                    const height = Math.abs(zeroPoint[1] - categoryPoint[1]);

                    return {
                        type: "rect",
                        shape: {
                            x,
                            y,
                            width: barWidth * 0.82,
                            height,
                        },
                        style: api.style({
                            fill: tier.color,
                        }),
                    };
                },
                itemStyle: {
                    color: tier.color,
                },
            })),
        };

        chart.setOption(options);
        chart.resize();

        const onResize = () => chartInstanceRef.current?.resize();
        window.addEventListener("resize", onResize);

        return () => {
            chart.dispose();
            chartInstanceRef.current = null;
            window.removeEventListener("resize", onResize);
        };
    }, [tiers]);

    return <div ref={chartRef} className="w-full aspect-video" />;
}