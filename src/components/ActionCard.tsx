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

    const getTypeColorClass = () => {
        switch (card.type) {
            case 'growth': return 'bg-emerald text-black';
            case 'sales': return 'bg-blue-500 text-white';
            case 'engagement': return 'bg-accent text-black';
            case 'opportunity': return 'bg-orange-500 text-white';
            case 'warning': return 'bg-red-500 text-white';
            default: return 'bg-black text-white';
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="brutalist-card !p-0 !bg-white mb-6 overflow-hidden group"
        >
            {/* Top Header Section with Color Type */}
            <div className={`p-4 border-b-4 border-black flex justify-between items-center ${getTypeColorClass()}`}>
                <div className="flex items-center gap-2">
                    <Rocket size={20} className="animate-float" />
                    <h3 className="text-lg font-black uppercase tracking-tighter leading-none">{card.title}</h3>
                </div>
                <div className="pill-badge !bg-white !text-black !border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {card.type}
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* Confidence Score & Trigger Header */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-black text-white p-3 border-2 border-black flex justify-between items-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-accent" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Confidence Index</span>
                        </div>
                        <span className="text-xl font-black tracking-tighter underline decoration-accent decoration-2">{card.confidence_score}%</span>
                    </div>

                    <div className="flex-[2] space-y-2">
                        <h4 className="label-tiny !text-black flex items-center gap-1 !tracking-[0.1em]">
                            <AlertCircle size={12} /> Intelligence Trigger
                        </h4>
                        <p className="text-sm font-black text-black leading-tight border-l-4 border-accent pl-3 py-1 bg-black/5">
                            {card.trigger}
                        </p>
                    </div>
                </div>

                {/* Action Items */}
                <div className="space-y-3">
                    <h4 className="label-tiny !text-black flex items-center gap-1 !tracking-[0.1em]">
                        <Sparkles size={12} /> Strategic Moves
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full border-2 border-black bg-accent flex items-center justify-center font-black text-[10px] shrink-0">1</span>
                            <p className="text-xs font-black text-black leading-snug pt-0.5">{card.action.primary}</p>
                        </div>
                        {card.action.secondary && (
                            <div className="p-4 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-3 items-start hover:bg-black group/item transition-all">
                                <span className="w-6 h-6 rounded-full border-2 border-black bg-white flex items-center justify-center font-black text-[10px] shrink-0 group-hover/item:bg-accent group-hover/item:text-black">2</span>
                                <p className="text-xs font-black text-black group-hover/item:text-white leading-snug pt-0.5">{card.action.secondary}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Copyable Hook Section */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <h4 className="label-tiny !text-black tracking-[0.1em] uppercase">Post Protocol Script</h4>
                        <button
                            onClick={handleCopy}
                            className={`brutalist-button !px-3 !py-1 !text-[8px] !shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${copied ? '!bg-emerald !text-black' : '!bg-white !text-black hover:!bg-accent'}`}
                        >
                            {copied ? 'Copied' : 'Copy Full Script'}
                        </button>
                    </div>
                    <div className="p-4 bg-black text-accent font-black italic text-base leading-snug relative border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <span className="absolute -top-3 left-3 text-2xl text-accent opacity-50 underline decoration-white decoration-2">“</span>
                        <p className="line-clamp-2">{card.ready_to_copy.hook}</p>
                    </div>
                </div>

                {/* Footer Logistics */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-black/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border-2 border-black bg-accent flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <Clock size={16} className="text-black" />
                        </div>
                        <div>
                            <p className="label-tiny !text-black/40 !text-[8px]">Time</p>
                            <p className="text-[10px] font-black text-black tracking-tighter uppercase">{card.post_time.date}, {card.post_time.time}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                        <div className="text-right">
                            <p className="label-tiny !text-black/40 !text-[8px]">Expectation</p>
                            <p className="text-[10px] font-black text-black tracking-tighter uppercase whitespace-nowrap">
                                {card.expected_result.metric ? card.expected_result.metric :
                                    card.expected_result.followers_increase ? `+${card.expected_result.followers_increase} Followers` :
                                        card.expected_result.engagement_increase ? `+${card.expected_result.engagement_increase} Engagement` :
                                            card.expected_result.sales_increase ? `+${card.expected_result.sales_increase} Sales` : 'Impact Grade A'}
                            </p>
                        </div>
                        <div className={`w-8 h-8 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${getTypeColorClass()}`}>
                            <TrendingUp size={16} />
                        </div>
                    </div>
                </div>

                {/* Interaction Footer */}
                <div className="grid grid-cols-6 gap-2 mt-4">
                    <button
                        onClick={() => onAction && onAction(card)}
                        className="col-span-5 brutalist-button !bg-black !text-white hover:!bg-accent hover:!text-black flex items-center justify-center gap-2 !py-3"
                    >
                        <Sparkles size={16} />
                        <span className="text-xs">Execute Protocol</span>
                    </button>
                    <button
                        onClick={() => onDismiss && onDismiss(card.id)}
                        className="col-span-1 brutalist-button !bg-white !text-black hover:!bg-red-500 hover:!text-white flex items-center justify-center !p-0"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

