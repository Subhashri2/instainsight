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
            className="brutalist-card !p-0 !bg-white mb-8 overflow-hidden group"
        >
            {/* Top Header Section with Color Type */}
            <div className={`p-6 border-b-4 border-black flex justify-between items-center ${getTypeColorClass()}`}>
                <div className="flex items-center gap-3">
                    <Rocket size={24} className="animate-float" />
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-none">{card.title}</h3>
                </div>
                <div className="pill-badge !bg-white !text-black !border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {card.type}
                </div>
            </div>

            <div className="p-8 space-y-8">
                {/* Confidence Score Header */}
                <div className="flex justify-between items-center bg-black text-white p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all">
                    <div className="flex items-center gap-3">
                        <TrendingUp size={18} className="text-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Confidence Index</span>
                    </div>
                    <span className="text-2xl font-black tracking-tighter underline decoration-accent decoration-4">{card.confidence_score}%</span>
                </div>

                {/* Trigger Section */}
                <div className="space-y-4">
                    <h4 className="label-tiny !text-black flex items-center gap-2">
                        <AlertCircle size={14} /> Intelligence Trigger
                    </h4>
                    <p className="text-lg font-black text-black leading-tight border-l-8 border-accent pl-6 py-2">
                        {card.trigger}
                    </p>
                </div>

                {/* Action Items */}
                <div className="space-y-4">
                    <h4 className="label-tiny !text-black flex items-center gap-2">
                        <Sparkles size={14} /> Strategic Moves
                    </h4>
                    <div className="space-y-4">
                        <div className="p-6 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex gap-4 items-start">
                            <span className="w-8 h-8 rounded-full border-4 border-black bg-accent flex items-center justify-center font-black text-sm shrink-0">1</span>
                            <p className="text-sm font-black text-black leading-snug pt-1">{card.action.primary}</p>
                        </div>
                        {card.action.secondary && (
                            <div className="p-6 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex gap-4 items-start hover:bg-black group/item transition-all">
                                <span className="w-8 h-8 rounded-full border-4 border-black bg-white flex items-center justify-center font-black text-sm shrink-0 group-hover/item:bg-accent group-hover/item:text-black">2</span>
                                <p className="text-sm font-black text-black group-hover/item:text-white leading-snug pt-1">{card.action.secondary}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Copyable Hook Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="label-tiny !text-black tracking-widest uppercase">Content Hook</h4>
                        <button
                            onClick={handleCopy}
                            className={`brutalist-button !px-4 !py-1 !text-[9px] !shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${copied ? '!bg-emerald !text-black' : '!bg-white !text-black hover:!bg-accent'}`}
                        >
                            {copied ? 'Copied' : 'Copy Payload'}
                        </button>
                    </div>
                    <div className="p-6 bg-black text-accent font-black italic text-lg leading-relaxed relative border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <span className="absolute -top-4 left-4 text-4xl text-accent opacity-50 underline decoration-white decoration-2">“</span>
                        {card.ready_to_copy.hook}
                    </div>
                </div>

                {/* Footer Logistics */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t-4 border-black/5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 border-4 border-black bg-accent flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <Clock size={20} className="text-black" />
                        </div>
                        <div>
                            <p className="label-tiny !text-black/40">Optimal Hit</p>
                            <p className="text-sm font-black text-black tracking-tighter uppercase">{card.post_time.date}, {card.post_time.time}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 justify-end">
                        <div className="text-right">
                            <p className="label-tiny !text-black/40">Expectation</p>
                            <p className="text-sm font-black text-black tracking-tighter uppercase whitespace-nowrap">
                                {card.expected_result.metric ? card.expected_result.metric :
                                    card.expected_result.followers_increase ? `+${card.expected_result.followers_increase} Followers` :
                                        card.expected_result.engagement_increase ? `+${card.expected_result.engagement_increase} Engagement` :
                                            card.expected_result.sales_increase ? `+${card.expected_result.sales_increase} Sales` : 'Impact Grade A'}
                            </p>
                        </div>
                        <div className={`w-12 h-12 border-4 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${getTypeColorClass()}`}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </div>

                {/* Interaction Footer */}
                <div className="grid grid-cols-6 gap-4 mt-6">
                    <button
                        onClick={() => onAction && onAction(card)}
                        className="col-span-5 brutalist-button !bg-black !text-white hover:!bg-accent hover:!text-black flex items-center justify-center gap-3 !py-5"
                    >
                        <Sparkles size={20} />
                        <span className="text-sm">Initiate Post Protocol</span>
                    </button>
                    <button
                        onClick={() => onDismiss && onDismiss(card.id)}
                        className="col-span-1 brutalist-button !bg-white !text-black hover:!bg-red-500 hover:!text-white flex items-center justify-center !p-0"
                    >
                        <Trash2 size={24} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

