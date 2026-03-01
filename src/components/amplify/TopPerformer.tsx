import React from 'react';
import { Heart, Play, MessageCircle, AlertTriangle } from 'lucide-react';

interface TopPerformerProps {
    imageUrl?: string;
    type?: string;
    timestamp?: string;
    likes?: number;
    views?: number;
    comments?: number;
    intent?: number;
}

export const TopPerformer: React.FC<TopPerformerProps> = ({
    imageUrl = "https://images.unsplash.com/photo-1549439602-43ebca2327af?q=80&w=1000",
    type = "Reel",
    timestamp = "2 hours ago",
    likes = 1240,
    views = 42000,
    comments = 84,
    intent = 34
}) => {
    return (
        <div className="brutalist-card p-8 flex flex-col h-full !bg-white">
            <h3 className="text-sm font-black text-black uppercase tracking-widest mb-6 border-b-4 border-black pb-2">Top Performer</h3>

            <div className="relative aspect-video border-4 border-black overflow-hidden mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all">
                <img src={imageUrl} alt="Top Post" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-4 left-4">
                    <span className="pill-badge !bg-black !text-white !border-black">
                        {type}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8 border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex flex-col items-center gap-2">
                    <Heart size={18} className="text-black" />
                    <span className="text-xs font-black text-black">{likes.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center gap-2 border-x-4 border-black">
                    <Play size={18} className="text-black" />
                    <span className="text-xs font-black text-black">{views.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <MessageCircle size={18} className="text-black" />
                    <span className="text-xs font-black text-black">{comments.toLocaleString()}</span>
                </div>
            </div>

            <div className="mt-auto flex items-center justify-center gap-3 px-6 py-4 bg-accent border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all">
                <AlertTriangle size={20} className="text-black" />
                <span className="text-xs font-black uppercase tracking-widest text-black">
                    Buyer Intent: {intent}%
                </span>
            </div>
        </div>
    );
};

