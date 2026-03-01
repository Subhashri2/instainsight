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
        <div className="flex gap-8 overflow-x-auto pb-8 py-4 no-scrollbar">
            {cards.slice(0, 5).map((card) => (
                <div
                    key={card.id}
                    className="brutalist-card min-w-[340px] flex-1 flex flex-col justify-between group !bg-white !p-8"
                >
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 border-2 flex items-center justify-center transition-all group-hover:rotate-12 ${getStyles(card.type)}`}>
                            {getIcon(card.type)}
                        </div>
                        <h4 className="text-lg font-black text-black leading-none tracking-tighter uppercase line-clamp-1">{card.title}</h4>
                    </div>

                    <p className="text-sm text-black/70 leading-relaxed font-bold mb-6 line-clamp-2">
                        {card.action.primary}
                    </p>

                    <div className="flex justify-between items-center mt-auto pt-4 border-t-2 border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40 whitespace-nowrap">
                            Confidence: {card.confidence_score}%
                        </span>
                        <ArrowRight size={20} className="text-black group-hover:translate-x-2 transition-all" />
                    </div>
                </div>
            ))}
        </div>
    );
};

