import React from 'react';
import { Clock, Sparkles } from 'lucide-react';

interface NextPostPlanProps {
    title?: string;
    time?: string;
    type?: string;
    collab?: boolean;
    hook?: string;
    caption?: string;
    hashtags?: string[];
    onViewStrategy?: () => void;
}

export const NextPostPlan: React.FC<NextPostPlanProps> = ({
    title = "Bridal Wear Collection",
    time = "11:00 AM",
    type = "Video",
    collab = true,
    hook = "Ever wondered how to find the perfect lehenga for your big day?",
    caption = "Step into a world of elegance with our new collection. Handcrafted for the modern bride who values tradition. Our Bridal 2024 series is now live!",
    hashtags = ["BridalFashion", "LehengaLove", "WeddingVibes"],
    onViewStrategy
}) => {
    return (
        <div className="brutalist-card p-8 flex flex-col h-full !bg-white">
            <div className="flex justify-between items-start mb-8">
                <span className="pill-badge !bg-accent !text-black !border-black scale-110 origin-left !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    NEXT POST PLAN
                </span>
                <Sparkles size={24} className="text-black animate-pulse" />
            </div>

            <h3 className="text-3xl font-black text-black mb-2 tracking-tighter uppercase">{title}</h3>

            <div className="flex items-center gap-3 text-xs font-black text-black/80 mb-8 uppercase tracking-widest">
                <Clock size={14} className="text-black" />
                <span>{time} · {type} {collab && "· Collab"}</span>
            </div>

            <div className="flex-1 bg-white border-4 border-black p-6 space-y-6 mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div>
                    <span className="brutalist-label block mb-2">HOOK</span>
                    <p className="text-sm italic text-black leading-relaxed font-black">"{hook}"</p>
                </div>
                <div className="border-t-2 border-black/10 pt-4">
                    <span className="brutalist-label block mb-2">CAPTION</span>
                    <p className="text-xs text-black/70 leading-relaxed font-bold line-clamp-3">{caption}</p>
                </div>
                <div className="border-t-2 border-black/10 pt-4">
                    <span className="brutalist-label block mb-3">HASHTAGS</span>
                    <div className="flex flex-wrap gap-2">
                        {hashtags.map((tag, i) => (
                            <span key={i} className="pill-badge !text-[9px] !bg-black !text-white !border-black">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <button
                onClick={onViewStrategy}
                className="brutalist-button !w-full !bg-black !text-white hover:!bg-accent hover:!text-black"
            >
                VIEW FULL STRATEGY
            </button>
        </div>
    );
};

