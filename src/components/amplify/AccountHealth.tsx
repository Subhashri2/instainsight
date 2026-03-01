import React from 'react';
import { motion } from 'framer-motion';

interface HealthMetric {
    label: string;
    value: number;
}

interface AccountHealthProps {
    score: number;
    metrics: HealthMetric[];
}

export const AccountHealth: React.FC<AccountHealthProps> = ({
    score = 42,
    metrics = [
        { label: "Engagement", value: 65 },
        { label: "Growth", value: 48 },
        { label: "Viral", value: 32 },
        { label: "Conversion", value: 24 },
        { label: "Content Mix", value: 78 }
    ]
}) => {
    return (
        <div className="brutalist-card p-8 flex flex-col items-center h-full !bg-white">
            <h4 className="text-sm font-black text-black uppercase tracking-widest mb-8 border-b-4 border-black pb-2 w-full text-center">
                Account Health
            </h4>

            <div className="relative w-48 h-48 mb-8 border-8 border-black rounded-full flex items-center justify-center bg-accent shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-center">
                    <span className="text-6xl font-black text-black tracking-tighter">{score}</span>
                    <p className="brutalist-label">Score</p>
                </div>
                {/* Decorative border elements */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-black rounded-full" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-black" />
            </div>

            <div className="w-full space-y-6">
                {metrics.map((m, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black tracking-widest uppercase">
                            <span className="brutalist-label">{m.label}</span>
                            <span className="text-black">{m.value}%</span>
                        </div>
                        <div className="w-full h-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${m.value}%` }}
                                transition={{ duration: 1, delay: i * 0.1 }}
                                className="h-full bg-black"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

