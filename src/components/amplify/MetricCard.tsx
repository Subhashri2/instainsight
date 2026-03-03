import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface MetricCardProps {
    label: string;
    value: string | number;
    badgeText: string;
    icon: LucideIcon;
    variant: 'amber' | 'emerald' | 'violet' | 'blue';
}

export const MetricCard: React.FC<MetricCardProps> = ({
    label,
    value,
    badgeText,
    icon: Icon,
    variant
}) => {
    const variants = {
        amber: {
            badge: "bg-amber text-black",
            icon: "text-amber",
        },
        emerald: {
            badge: "bg-emerald text-black",
            icon: "text-emerald",
        },
        violet: {
            badge: "bg-accent text-black",
            icon: "text-black",
        },
        blue: {
            badge: "bg-blue !text-white",
            icon: "text-blue",
        }
    };

    const style = variants[variant];

    return (
        <div className={cn(
            "brutalist-card flex flex-col justify-between min-h-[160px] relative overflow-hidden group"
        )}>
            <div className="flex justify-between items-start">
                <span className="label-tiny text-black/80">{label}</span>
                <Icon size={20} className={cn("transition-transform group-hover:scale-125 group-hover:rotate-12", style.icon)} />
            </div>

            <div className="my-4">
                <h3 className="text-huge !text-5xl text-black">{value}</h3>
            </div>

            <div>
                <span className={cn("pill-badge !shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]", style.badge)}>
                    {badgeText}
                </span>
            </div>
        </div>
    );
};

