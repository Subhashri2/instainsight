import React from 'react';
import { ActionCardData } from '../../types/ActionCard';
import { Rocket, Clock, Flame, Users, ArrowRight, Zap, TrendingUp, Target } from 'lucide-react';

interface ActionStripProps {
    cards?: ActionCardData[];
}

export const ActionStrip: React.FC<ActionStripProps> = ({ cards = [] }) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'growth': return <Rocket size={20} />;
            case 'sales': return <Flame size={20} />;
            case 'engagement': return <TrendingUp size={20} />;
            case 'opportunity': return <Zap size={20} />;
            case 'warning': return <Target size={20} />;
            default: return <Rocket size={20} />;
        }
    };

    const getStyles = (type: string) => {
        switch (type) {
            case 'growth': return 'bg-emerald border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
            case 'sales': return 'bg-blue-500 border-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
            case 'engagement': return 'bg-accent border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
            case 'opportunity': return 'bg-orange-500 border-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
            case 'warning': return 'bg-red-500 border-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
            default: return 'bg-white border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
        }
    };

    if (cards.length === 0) return null;

    return (
        <div className="flex gap-4 overflow-x-auto pb-6 py-2 no-scrollbar">
            {cards.slice(0, 5).map((card) => (
                <div
                    key={card.id}
                    className="brutalist-card min-w-[280px] max-w-[320px] flex-1 flex flex-col justify-between group !bg-white !p-4"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 border-2 flex items-center justify-center transition-all group-hover:rotate-12 ${getStyles(card.type)}`}>
                            {getIcon(card.type)}
                        </div>
                        <h4 className="text-base font-black text-black leading-none tracking-tighter uppercase line-clamp-1">{card.title}</h4>
                    </div>

                    <p className="text-xs text-black/70 leading-relaxed font-bold mb-4 line-clamp-2">
                        {card.action.primary}
                    </p>

                    <div className="flex justify-between items-center mt-auto pt-3 border-t-2 border-black/5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-black/40 whitespace-nowrap">
                            Confidence: {card.confidence_score}%
                        </span>
                        <ArrowRight size={16} className="text-black group-hover:translate-x-2 transition-all" />
                    </div>
                </div>
            ))}
        </div>
    );
};

