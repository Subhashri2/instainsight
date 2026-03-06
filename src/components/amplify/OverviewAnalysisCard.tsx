import React from 'react';
import { Activity, TrendingUp, Zap, Timer, Eye, MessageSquare, Share2 } from 'lucide-react';
import { MetricCard } from './MetricCard';

interface OverviewAnalysisData {
  engagement: string | number;
  growth: number;
  viral: number;
  velocity: number;
  reelCount: number;
  imageCount: number;
  totalViews: string;
  totalInteractions: string;
  avgViews: string;
  avgLikes: string;
}

interface OverviewAnalysisCardProps {
  data: OverviewAnalysisData;
}

export const OverviewAnalysisCard: React.FC<OverviewAnalysisCardProps> = ({ data }) => {
  return (
    <div className="brutalist-card p-6 md:p-8 flex flex-col h-full !bg-white">
      <div className="flex justify-between items-start mb-8">
        <span className="pill-badge !bg-emerald-400 !text-black !border-black scale-110 origin-left !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          INTELLIGENCE OVERVIEW
        </span>
        <Activity size={24} className="text-black" />
      </div>

      <h3 className="text-3xl font-black text-black mb-8 tracking-tighter uppercase">Account Analytics</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Core Metrics */}
        <MetricCard
          label="Engagement Rate"
          value={data.engagement}
          badgeText={parseFloat(String(data.engagement)) > 3 ? "Strong" : "Low"}
          variant="amber"
          icon={Activity}
        />
        <MetricCard
          label="Growth Index"
          value={data.growth}
          badgeText={data.growth > 60 ? "Optimal" : "Needs Work"}
          variant="emerald"
          icon={TrendingUp}
        />
        <MetricCard
          label="Viral Probability"
          value={`${data.viral}%`}
          badgeText={data.viral > 40 ? "High" : "Moderate"}
          variant="violet"
          icon={Zap}
        />
        <MetricCard
          label="Posts Analyzed"
          value={data.velocity}
          badgeText={`${data.reelCount}R · ${data.imageCount}P`}
          variant="blue"
          icon={Timer}
        />
        {/* Aggregate Totals */}
        <MetricCard
          label="Total Views"
          value={data.totalViews}
          badgeText="All Posts"
          variant="violet"
          icon={Eye}
        />
        <MetricCard
          label="Total Interactions"
          value={data.totalInteractions}
          badgeText="Likes + Comments"
          variant="amber"
          icon={MessageSquare}
        />
        <MetricCard
          label="Avg Views / Post"
          value={data.avgViews}
          badgeText="Per Content"
          variant="emerald"
          icon={Activity}
        />
        <MetricCard
          label="Avg Likes / Post"
          value={data.avgLikes}
          badgeText="Per Content"
          variant="blue"
          icon={Share2}
        />
      </div>
    </div>
  );
};
