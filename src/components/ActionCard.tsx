import React, { useState } from 'react';
import { ActionCardData } from '../types/ActionCard';
import { Copy, Save, Trash2, Rocket, Clock, CheckCircle2, AlertCircle, Info, Sparkles, TrendingUp, DollarSign } from 'lucide-react';

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
            case 'growth': return 'border-emerald-500';
            case 'sales': return 'border-blue-500';
            case 'engagement': return 'border-purple-500';
            case 'opportunity': return 'border-orange-500';
            case 'warning': return 'border-red-500';
            default: return 'border-gray-500';
        }
    };

    const getTypeColorClass = () => {
        switch (card.type) {
            case 'growth': return 'text-emerald-600 bg-emerald-50';
            case 'sales': return 'text-blue-600 bg-blue-50';
            case 'engagement': return 'text-purple-600 bg-purple-50';
            case 'opportunity': return 'text-orange-600 bg-orange-50';
            case 'warning': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const getProgressColorClass = () => {
        switch (card.type) {
            case 'growth': return 'bg-emerald-500';
            case 'sales': return 'bg-blue-500';
            case 'engagement': return 'bg-purple-500';
            case 'opportunity': return 'bg-orange-500';
            case 'warning': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const handleCopy = () => {
        const text = `Hook:\n${card.ready_to_copy.hook}\n\nCaption:\n${card.ready_to_copy.caption}\n\nCTA:\n${card.ready_to_copy.cta}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex flex-col rounded-[2rem] overflow-hidden border-t-[10px] shadow-sm bg-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ${getTypeStyles()}`}>
            <div className="p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-md ${getTypeColorClass()} mb-2`}>
                            <span className="text-[10px] uppercase font-black tracking-widest">{card.type}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">{card.title}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Confidence</span>
                            <span className="text-xs font-black text-gray-900">{card.confidence_score}%</span>
                        </div>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${getProgressColorClass()}`}
                                style={{ width: `${card.confidence_score}%` }}
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-gray-50" />

                {/* Trigger */}
                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                        <Info size={12} /> The Insight
                    </h4>
                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">{card.trigger}</p>
                </div>

                {/* Action Section */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1.5">
                        <Rocket size={12} /> Action Plan
                    </h4>
                    <div className="space-y-2.5">
                        <div className="flex gap-3 items-start p-3 bg-indigo-50/30 rounded-xl border border-indigo-50">
                            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                            <p className="text-sm font-bold text-gray-900 leading-tight pt-0.5">{card.action.primary}</p>
                        </div>
                        {card.action.secondary && (
                            <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-gray-100">
                                <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                                <p className="text-sm font-medium text-gray-600 leading-tight pt-0.5">{card.action.secondary}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ready Hook Section */}
                <div className="relative pt-2">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase">Ready-to-use Hook</h4>
                        <button
                            onClick={handleCopy}
                            className={`p-1.5 rounded-lg flex items-center gap-1 font-bold text-[10px] transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        >
                            {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                            {copied ? 'COPIED' : 'COPY'}
                        </button>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-50/20 italic text-gray-700 text-sm border-2 border-dashed border-indigo-100/50 relative">
                        <span className="absolute -top-3 left-3 bg-white px-1 text-2xl text-indigo-200 font-serif">“</span>
                        {card.ready_to_copy.hook}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    {/* Post Time */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0">
                            <Clock size={18} className="text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">When to post</p>
                            <p className="text-xs font-black text-gray-900">{card.post_time.date}, {card.post_time.time}</p>
                        </div>
                    </div>

                    {/* Expected Result */}
                    <div className="flex items-center gap-3 text-right">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Expected growth</p>
                            <p className="text-xs font-black text-emerald-600">
                                {card.expected_result.followers_increase ? `+${card.expected_result.followers_increase}` :
                                    card.expected_result.engagement_increase ? `+${card.expected_result.engagement_increase}` :
                                        card.expected_result.sales_increase ? `+${card.expected_result.sales_increase}` : 'High Impact'}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <TrendingUp size={18} className="text-emerald-500" />
                        </div>
                    </div>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-6 gap-3 mt-2">
                    <button
                        onClick={() => onAction && onAction(card)}
                        className="col-span-4 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} />
                        CREATE THIS POST
                    </button>
                    <button
                        onClick={() => onSave && onSave(card)}
                        className="col-span-1 py-4 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 hover:text-indigo-500 transition-all border border-gray-100"
                    >
                        <Save size={18} />
                    </button>
                    <button
                        onClick={() => onDismiss && onDismiss(card.id)}
                        className="col-span-1 py-4 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 hover:text-red-500 transition-all border border-gray-100"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
