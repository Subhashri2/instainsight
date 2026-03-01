import React, { useMemo } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { Layers, Zap, MessageSquare, Eye, Share2 } from 'lucide-react';

interface ContentChartProps {
    data: any[];
}

export const ContentChart: React.FC<ContentChartProps> = ({
    data
}) => {
    const chartData = useMemo(() => {
        return [...data]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map(post => {
                const date = new Date(post.timestamp);
                return {
                    ...post,
                    displayDate: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
                    displayTime: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    views: post.videoViewCount || 0,
                    likes: post.likesCount || 0,
                    comments: post.commentsCount || 0,
                    shares: Math.floor((post.likesCount || 0) * 0.1), // Mocking shares if not available
                };
            });
    }, [data]);

    const metrics = [
        { id: 'views', label: 'Views', icon: Eye, color: '#6366f1' }, // Violet
        { id: 'likes', label: 'Likes', icon: Zap, color: '#fce300' }, // Signal Yellow
        { id: 'comments', label: 'Comments', icon: MessageSquare, color: '#00ff88' }, // Emerald
        { id: 'shares', label: 'Shares', icon: Share2, color: '#3b82f6' }, // Blue
    ] as const;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const post = payload[0].payload;
            return (
                <div className="brutalist-card !p-4 !bg-white !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[200px]">
                    <div className="flex items-center gap-2 mb-4 border-b-2 border-black pb-2">
                        <span className={`pill-badge !text-[8px] ${post.type === 'Video' ? '!bg-black !text-white' : '!bg-accent !text-black'}`}>
                            {post.type === 'Video' ? 'REEL' : 'POST'}
                        </span>
                        <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">{post.displayDate}</span>
                    </div>
                    <div className="space-y-3">
                        {payload.map((entry: any) => {
                            const config = metrics.find(m => m.id === entry.dataKey);
                            return (
                                <div key={entry.dataKey} className="flex justify-between items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config?.color }} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-black/60">{config?.label}</span>
                                    </div>
                                    <span className="text-sm font-black text-black">{(entry.value || 0).toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="brutalist-card p-8 !bg-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-accent border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Layers size={20} className="text-black" />
                        </div>
                        <h3 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">Content Flow</h3>
                    </div>
                    <p className="text-black/60 text-[10px] font-black uppercase tracking-[0.3em]">Temporal Intelligence Mapping</p>
                </div>

                <div className="flex flex-wrap gap-4 px-6 py-3 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    {metrics.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                            <m.icon size={14} style={{ color: m.color }} strokeWidth={3} />
                            <span className="text-[10px] font-black tracking-widest text-black uppercase">{m.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="h-[400px] w-full border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            {metrics.map(m => (
                                <linearGradient key={m.id} id={`gradient-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="0 0" stroke="rgba(0,0,0,0.05)" vertical={true} />
                        <XAxis
                            dataKey="displayDate"
                            axisLine={{ stroke: '#000', strokeWidth: 2 }}
                            tickLine={{ stroke: '#000', strokeWidth: 2 }}
                            tick={{ fill: '#000', fontSize: 10, fontWeight: 900 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={{ stroke: '#000', strokeWidth: 2 }}
                            tickLine={{ stroke: '#000', strokeWidth: 2 }}
                            tick={{ fill: '#000', fontSize: 10, fontWeight: 900 }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#000', strokeWidth: 2 }} />
                        {metrics.map(m => (
                            <Area
                                key={m.id}
                                type="monotone"
                                dataKey={m.id}
                                name={m.label}
                                stroke={m.color}
                                strokeWidth={4}
                                fill={`url(#gradient-${m.id})`}
                                fillOpacity={1}
                                animationDuration={1500}
                                stackId="metrics" // Optional: stack them or show overlay
                            // stackId is NOT used here to show absolute comparison
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-8 justify-center border-t-2 border-black/10 pt-8">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-black bg-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                    <span className="text-[10px] font-black text-black uppercase tracking-widest">Reels</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-black bg-accent shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                    <span className="text-[10px] font-black text-black uppercase tracking-widest">Static Posts</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                    <span className="text-[10px] font-black text-black uppercase tracking-widest">Carousel</span>
                </div>
            </div>
        </div>
    );
};

