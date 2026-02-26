import React, { useState } from 'react';
import { ActionCardData } from '../types/ActionCard';
import { Copy, Save, Trash2, Rocket, Clock, CheckCircle2, AlertCircle, Info, Sparkles, TrendingUp, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

interface ActionCardProps {
    card: ActionCardData;
    onAction?: (card: ActionCardData) => void;
    onSave?: (card: ActionCardData) => void;
    onDismiss?: (id: string) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ card, onAction, onSave, onDismiss }) => {
    const [copied, setCopied] = useState(false);

    const getTypeStyles = () => {
        switch (card.type) {
            case 'growth': return 'border-emerald-500/50 shadow-emerald-500/10';
            case 'sales': return 'border-blue-500/50 shadow-blue-500/10';
            case 'engagement': return 'border-purple-500/50 shadow-purple-500/10';
            case 'opportunity': return 'border-orange-500/50 shadow-orange-500/10';
            case 'warning': return 'border-red-500/50 shadow-red-500/10';
            default: return 'border-white/10 shadow-white/5';
        }
    };

    const getTypeColorClass = () => {
        switch (card.type) {
            case 'growth': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'sales': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'engagement': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'opportunity': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'warning': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-zinc-400 bg-white/5 border-white/10';
        }
    };

    const getProgressColorClass = () => {
        switch (card.type) {
            case 'growth': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
            case 'sales': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
            case 'engagement': return 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]';
            case 'opportunity': return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]';
            case 'warning': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
            default: return 'bg-zinc-500';
        }
    };

    const handleCopy = () => {
        const text = `Hook:\n${card.ready_to_copy.hook}\n\nCaption:\n${card.ready_to_copy.caption}\n\nCTA:\n${card.ready_to_copy.cta}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={`flex flex-col rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-[#09090b]/40 backdrop-blur-2xl mb-6 relative group ${getTypeStyles()}`}
        >
            {/* Color Strip Indicator */}
            <div className={`h-1.5 w-full ${getProgressColorClass()}`} />

            <div className="p-8 flex flex-col gap-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="space-y-3">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-black tracking-[0.1em] uppercase ${getTypeColorClass()}`}>
                            {card.type}
                        </div>
                        <h3 className="text-2xl font-black text-white leading-tight tracking-tight">{card.title}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-2 bg-white/5 p-3 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Confidence</span>
                            <span className="text-xs font-black text-white">{card.confidence_score}%</span>
                        </div>
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${card.confidence_score}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className={`h-full ${getProgressColorClass()}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Trigger */}
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 group-hover:bg-white/[0.08] transition-colors">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase mb-3 flex items-center gap-2">
                        <Info size={14} className="text-indigo-400" /> DATA TRIGGER
                    </h4>
                    <p className="text-sm font-bold text-zinc-300 leading-relaxed">{card.trigger}</p>
                </div>

                {/* Action Section */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Rocket size={14} /> ACTION PLAN
                    </h4>
                    <div className="space-y-3">
                        <div className="flex gap-4 items-start p-4 bg-indigo-500/10 rounded-[20px] border border-indigo-500/20">
                            <div className="w-7 h-7 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0 text-xs font-black shadow-lg shadow-indigo-500/20">1</div>
                            <p className="text-sm font-black text-white leading-tight pt-1">{card.action.primary}</p>
                        </div>
                        {card.action.secondary && (
                            <div className="flex gap-4 items-start p-4 bg-white/5 rounded-[20px] border border-white/5">
                                <div className="w-7 h-7 rounded-xl bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                                <p className="text-sm font-bold text-zinc-400 leading-tight pt-1">{card.action.secondary}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ready Hook Section */}
                <div className="relative pt-2">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">READY-TO-USE HOOK</h4>
                        <button
                            onClick={handleCopy}
                            className={`px-3 py-1.5 rounded-xl flex items-center gap-2 font-black text-[10px] transition-all border ${copied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                        >
                            {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                            {copied ? 'COPIED' : 'COPY'}
                        </button>
                    </div>
                    <div className="p-5 rounded-[24px] bg-indigo-500/5 border border-indigo-500/10 italic text-white text-sm relative group-hover:bg-indigo-500/10 transition-colors">
                        <span className="absolute -top-3 left-4 bg-[#09090b] px-2 text-2xl text-indigo-500/40 font-serif leading-none">“</span>
                        {card.ready_to_copy.hook}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                            <Clock size={16} className="text-zinc-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-0.5">Optimal Time</p>
                            <p className="text-xs font-black text-white">{card.post_time.date}, {card.post_time.time}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-0.5">Expectation</p>
                            <p className="text-xs font-black text-emerald-400">
                                {card.expected_result.followers_increase ? `+${card.expected_result.followers_increase} Followers` :
                                    card.expected_result.engagement_increase ? `+${card.expected_result.engagement_increase} Engagement` :
                                        card.expected_result.sales_increase ? `+${card.expected_result.sales_increase} Sales` : 'Impact Grade A'}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                            <TrendingUp size={16} className="text-emerald-400" />
                        </div>
                    </div>
                </div>

                {/* Main Action Button */}
                <div className="grid grid-cols-5 gap-3 mt-4">
                    <button
                        onClick={() => onAction && onAction(card)}
                        className="col-span-4 py-4 bg-indigo-600 text-white rounded-[20px] font-black text-[11px] tracking-[0.1em] uppercase shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        <Sparkles size={16} />
                        GENERATE POST ASSETS
                    </button>
                    <button
                        onClick={() => onDismiss && onDismiss(card.id)}
                        className="col-span-1 py-4 bg-white/5 border border-white/10 text-zinc-500 rounded-[20px] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
