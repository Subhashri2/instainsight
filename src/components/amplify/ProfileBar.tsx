import React from 'react';
import { RefreshCcw } from 'lucide-react';

interface ProfileBarProps {
    username?: string;
    fullName?: string;
    avatarUrl?: string;
    followers?: string | number;
    following?: string | number;
    posts?: string | number;
    categoryName?: string;
    onRefresh?: () => void;
    isLoading?: boolean;
}

export const ProfileBar: React.FC<ProfileBarProps> = ({
    username = "badshastore.in",
    fullName = "Bridal Lehenga Store",
    avatarUrl,
    followers = "12.4K",
    following = "842",
    posts = "156",
    categoryName,
    onRefresh,
    isLoading = false
}) => {
    return (
        <div className="brutalist-card mb-8 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-6 !bg-white">
            <div className="flex items-center gap-6">
                <div className="w-20 h-20 border-4 border-black overflow-hidden bg-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-black font-black text-2xl">
                            {username[0]?.toUpperCase()}
                        </div>
                    )}
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-black leading-none tracking-tighter uppercase">@{username}</h2>
                        {categoryName && categoryName.toLowerCase() !== 'none' && (
                            <span className="pill-badge !bg-black !text-white !border-black">
                                {categoryName}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-black font-bold uppercase tracking-widest mt-2">{fullName}</p>
                </div>
            </div>

            <div className="flex items-center gap-10">
                <div className="flex items-center gap-8 text-[11px] font-black tracking-[0.2em] text-black">
                    <div className="flex flex-col items-center">
                        <span className="text-2xl tracking-tighter">{followers}</span>
                        <span className="uppercase text-[9px] text-black/60">Followers</span>
                    </div>
                    <div className="w-1 h-8 bg-black" />
                    <div className="flex flex-col items-center">
                        <span className="text-2xl tracking-tighter">{following}</span>
                        <span className="uppercase text-[9px] text-black/60">Following</span>
                    </div>
                    <div className="w-1 h-8 bg-black" />
                    <div className="flex flex-col items-center">
                        <span className="text-2xl tracking-tighter">{posts}</span>
                        <span className="uppercase text-[9px] text-black/60">Posts</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onRefresh}
                disabled={isLoading}
                className="brutalist-button !bg-accent !text-black flex items-center gap-3"
            >
                <RefreshCcw size={18} className={cn("transition-transform", isLoading ? "animate-spin" : "")} />
                <span className="text-xs">Scrape Now</span>
            </button>
        </div>
    );
};

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}

