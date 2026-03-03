import React, { useState, useMemo } from 'react';
import { Search, Loader2, Zap, TrendingUp, Sparkles, Timer, Activity, MessageSquare, Share2, AlertCircle, ArrowRight, Terminal, Bug, Code, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Amplify Components
import { ProfileBar } from './components/amplify/ProfileBar';
import { MetricCard } from './components/amplify/MetricCard';
import { AccountHealth } from './components/amplify/AccountHealth';
import { NextPostPlan } from './components/amplify/NextPostPlan';
import { TopPerformer } from './components/amplify/TopPerformer';
import { ContentChart } from './components/amplify/ContentChart';
import { ActionStrip } from './components/amplify/ActionStrip';
import { ActionCard } from './components/ActionCard';

export default function App() {
  const [username, setUsername] = useState('');
  const [contentType, setContentType] = useState<'all' | 'posts' | 'reels' | 'stories'>('all');
  const [enableAI, setEnableAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<{ message: string; details?: string; suggestion?: string } | null>(null);
  const [data, setData] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'actions' | 'strategy' | 'dev'>('dashboard');
  const [devMode, setDevMode] = useState(false);
  const [activeMetric, setActiveMetric] = useState<'likes' | 'comments' | 'views' | 'shares'>('views');

  const handleSearch = async (e: React.FormEvent, overrideUsername?: string) => {
    e.preventDefault();
    let targetUsername = (overrideUsername || username).trim();
    if (!targetUsername) return;

    // Handle URL pastes
    if (targetUsername.includes('instagram.com/')) {
      try {
        const urlPath = targetUsername.split('instagram.com/')[1];
        targetUsername = urlPath.split('/')[0].split('?')[0];
        setUsername(targetUsername);
      } catch (err) {
        console.error("URL parsing error:", err);
      }
    }

    setLoading(true);
    setLoadingStage('Analyzing Social Intelligence...');
    setError(null);

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername,
          contentType: contentType,
          enableAI: enableAI
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              const chunk = JSON.parse(line);
              if (chunk.type === "error") {
                throw new Error(chunk.details || chunk.error);
              } else if (chunk.type === "basic") {
                setData(chunk.data);
                setLoading(false);
                setActiveTab('dashboard');
                if (enableAI) {
                  setAiLoading(true);
                  setLoadingStage('AI analysis in progress...');
                } else {
                  setLoadingStage('');
                }
              } else if (chunk.type === "ai") {
                setData((prev: any) => ({
                  ...prev,
                  insights: chunk.data.insights,
                  aiUsed: chunk.data.aiUsed,
                  dev: {
                    ...prev.dev,
                    prompt: chunk.data.dev.prompt,
                    usage: chunk.data.dev.usage
                  }
                }));
                setAiLoading(false);
                setLoadingStage('');
              } else if (chunk.type === "enriched") {
                setData((prev: any) => ({
                  ...prev,
                  posts: chunk.data.posts || prev?.posts || [],
                  insights: chunk.data.insights || prev?.insights || {},
                  dev: {
                    ...prev?.dev,
                    summaryData: chunk.data.dev?.summaryData || prev?.dev?.summaryData,
                    rawItems: chunk.data.dev?.rawItems ?? prev?.dev?.rawItems
                  }
                }));
              }
            }
          }
          if (done) break;
        }
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError({
        message: err.message || 'Quantum Connection Error',
        details: err.details || (err instanceof Error ? err.message : String(err)),
        suggestion: err.suggestion || "Ensure target profile is public and retry."
      });
      setLoading(false);
      setLoadingStage('');
    }
  };

  const dashboardData = useMemo(() => {
    if (!data) return null;
    const posts = data.posts || [];
    const insights = data.insights || {};
    const summary = insights.account_summary || {};

    // Sort posts using the Algorithm v3 formula (Likes + Comments*2.5) / Max(Views, 1) to identify true Top Performer
    const bestPost = [...posts].sort((a, b) => {
      const scoreA = ((a.likesCount || 0) + ((a.commentsCount || 0) * 2.5)) / Math.max(a.videoViewCount || 1, 1);
      const scoreB = ((b.likesCount || 0) + ((b.commentsCount || 0) * 2.5)) / Math.max(b.videoViewCount || 1, 1);
      return scoreB - scoreA;
    })[0];

    return {
      engagement: insights.dashboard?.engagement_rate_avg || "0.00%",
      growth: insights.dashboard?.growth_score || 0,
      viral: insights.dashboard?.viral_potential_score || 0,
      velocity: posts.length || 0,
      score: insights.account_score || 0,
      // Aggregates from real server calculation
      totalViews: summary.total_views_fmt || summary.total_views?.toLocaleString() || "0",
      totalInteractions: summary.total_interactions_fmt || summary.total_interactions?.toLocaleString() || "0",
      avgViews: summary.avg_views_fmt || summary.avg_views?.toLocaleString() || "0",
      avgLikes: summary.avg_likes_fmt || summary.avg_likes?.toLocaleString() || "0",
      reelCount: summary.reel_count ?? 0,
      imageCount: summary.image_count ?? 0,
      healthMetrics: [
        { label: "Engagement", value: Math.round(parseFloat(insights.dashboard?.engagement_rate_avg || "0") * 10) || 0 },
        { label: "Growth", value: insights.dashboard?.growth_score || 0 },
        { label: "Viral", value: insights.dashboard?.viral_potential_score || 0 },
        { label: "Intent", value: insights.buyer_intent_score || 0 },
        { label: "Consistency", value: Math.min(100, (posts.length / 12) * 100) || 0 }
      ],
      nextPlan: insights.next_post_plan || {
        topic: "Trending Topic",
        time: "12:00",
        type: "Video",
        hook: "Analyze posts to get a personalized hook.",
        caption: "Your next post plan will appear here after analysis.",
        hashtags: []
      },
      topPerformer: {
        imageUrl: `/api/image-proxy?url=${encodeURIComponent(bestPost?.displayUrl || "https://images.unsplash.com/photo-1549439602-43ebca2327af?q=80&w=1000")}`,
        type: bestPost?.type === 'Video' ? 'Reel' : 'Post',
        likes: bestPost?.likesCount || 0,
        views: bestPost?.videoViewCount || 0,
        comments: bestPost?.commentsCount || 0,
        hook: bestPost?.caption?.split('\n')[0]?.substring(0, 80) || bestPost?.hook_text,
        timestamp: "Top Post",
        intent: insights.buyer_intent_score || 0,
        recommendation: insights.buyer_intent_metadata?.recommendation
      },
      profile: {
        username: data.user?.username || username,
        fullName: data.user?.fullName || "Amplify User",
        avatarUrl: data.user?.profilePicUrl ? `/api/image-proxy?url=${encodeURIComponent(data.user?.profilePicUrl)}` : undefined,
        followers: data.user?.followersCount?.toLocaleString() || "0",
        following: data.user?.followingCount?.toLocaleString() || "0",
        posts: data.user?.postsCount?.toLocaleString() || posts.length,
        categoryName: data.user?.categoryName
      },
      actionCards: insights.action_cards || [],
      growthRoadmap: insights.advanced_analysis?.growth_opportunities || [],
      contentBlueprint: insights.reel_suggestions || []
    };
  }, [data, username]);

  return (
    <div className="min-h-screen font-sans selection:bg-primary/30 selection:text-white pb-12">
      {/* Helper Background Animations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="bg-geometric absolute inset-0" />
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, 30, 0], rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 left-[10%] w-32 h-32 border-4 border-black/5 rounded-full"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 60, 0], rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-40 right-[15%] w-48 h-48 border-4 border-black/5"
        />
        <motion.div
          animate={{ y: [0, -100, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/4 w-12 h-12 bg-accent opacity-10 rotate-45"
        />
      </div>

      {/* Search Overlay (Landing Page) */}
      <AnimatePresence>
        {!data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-white"
          >
            <div className="w-full max-w-4xl text-center space-y-16 relative">
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 20 }}
                className="space-y-6"
              >
                <div className="flex justify-center mb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-24 h-24 bg-accent border-4 border-black flex items-center justify-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Activity size={48} className="text-black" />
                  </motion.div>
                </div>
                <h1 className="text-8xl font-black text-black tracking-tighter uppercase leading-none">
                  So-IT<span className="text-accent" style={{ WebkitTextStroke: '4px black' }}>Works.ai</span>
                </h1>
                <p className="text-black font-black text-xl uppercase tracking-[0.2em]">Next-Gen Social Intelligence Engine</p>
              </motion.div>

              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="max-w-2xl mx-auto"
              >
                <form onSubmit={handleSearch} className="space-y-8">
                  <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-black" size={24} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter Profile Username..."
                      className="brutalist-input pl-16 pr-40 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={!username.trim()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 brutalist-button !px-6 !py-2 !text-xs"
                    >
                      IDENTIFY
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-6">
                    <div className="flex bg-white border-4 border-black p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      {([
                        { id: 'all', label: 'ALL' },
                        { id: 'posts', label: 'POSTS' },
                        { id: 'reels', label: 'REELS' },
                        { id: 'stories', label: 'STORIES' }
                      ] as const).map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setContentType(type.id)}
                          className={`px-6 py-2 text-[10px] font-black tracking-widest transition-all ${contentType === type.id ? 'bg-black text-white' : 'text-black/40 hover:text-black/80'}`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>



                    <button
                      type="button"
                      onClick={() => setEnableAI(!enableAI)}
                      className={`flex items-center gap-2 px-6 py-2 border-4 border-black font-black transition-all ${enableAI ? 'bg-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white opacity-40 shadow-none'}`}
                    >
                      <Sparkles size={16} className={enableAI ? "animate-pulse" : ""} />
                      <span className="text-[10px] uppercase tracking-widest">AI: {enableAI ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-500 text-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-lg mx-auto flex gap-4 text-left"
                >
                  <AlertCircle size={32} className="shrink-0" />
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tighter">{error.message}</h4>
                    <p className="text-white/90 text-xs mt-1 font-bold">{error.suggestion}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playful Loading State */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white"
          >
            <div className="relative flex gap-4 mb-16">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -40, 0],
                    rotate: [0, 90, 180, 270, 360],
                    backgroundColor: i === 1 ? ["#000", "#fce300", "#000"] : ["#fce300", "#000", "#fce300"]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                  className={`w-16 h-16 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${i === 0 ? 'rounded-full' : i === 2 ? 'rounded-[2rem] rotate-45' : ''}`}
                />
              ))}
            </div>

            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-center"
            >
              <h2 className="text-4xl font-black text-black tracking-tighter uppercase mb-4">{loadingStage}</h2>
              <div className="flex items-center justify-center gap-2">
                <div className="w-12 h-1 bg-black animate-pulse" />
                <p className="text-black text-[10px] font-black uppercase tracking-[0.5em]">Neural Scraping Engine v3.0</p>
                <div className="w-12 h-1 bg-black animate-pulse" />
              </div>
            </motion.div>

            {/* Helper floating shapes while loading */}
            <div className="absolute inset-0 pointer-events-none">
              <motion.div
                animate={{ rotate: 360, x: [0, 100, 0], y: [0, 50, 0] }}
                transition={{ duration: 10, repeat: Infinity }}
                className="absolute top-1/4 left-1/4 w-8 h-8 bg-accent border-2 border-black"
              />
              <motion.div
                animate={{ rotate: -360, x: [0, -80, 0], y: [0, -60, 0] }}
                transition={{ duration: 12, repeat: Infinity }}
                className="absolute bottom-1/4 right-1/4 w-6 h-6 rounded-full bg-black"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Main Dashboard Layout */}
      {data && dashboardData && (
        <main className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-1000">
          <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8 border-b-8 border-black pb-12">
            <div>
              <h1 className="text-5xl font-black text-black tracking-tighter uppercase leading-none">So-It Works.ai<span className="text-accent underline decoration-black decoration-8 underline-offset-8">.</span></h1>
              <p className="text-black/60 text-[10px] font-black uppercase tracking-[0.4em] mt-4">Institutional Grade Intelligence v3.0</p>
            </div>

            {aiLoading && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 px-6 py-3 bg-black text-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(252,227,0,1)]"
              >
                <Loader2 size={20} className="text-accent animate-spin" />
                <span className="text-xs font-black tracking-widest uppercase">
                  AI Analyzing Patterns...
                </span>
              </motion.div>
            )}

            {/* Tab Switcher */}
            <div className="flex bg-white border-4 border-black p-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative z-10 transition-all hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'actions', label: 'Action Cards' },
                { id: 'strategy', label: 'AI Strategy' },
                ...(devMode ? [{ id: 'dev', label: 'Dev Mode' }] : [])
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-8 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all z-10 ${activeTab === tab.id ? 'text-black' : 'text-black/60 hover:text-black/80'}`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabAmplify"
                      className="absolute inset-0 bg-accent -z-10"
                      transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                    />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  const nextMode = !devMode;
                  setDevMode(nextMode);
                  if (!nextMode && activeTab === 'dev') setActiveTab('dashboard');
                }}
                className={`brutalist-button !p-3 transition-all ${devMode ? '!bg-black !text-white' : '!bg-white !text-black'}`}
                title="Toggle Dev Mode"
              >
                {devMode ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
              <button onClick={() => { setData(null); setUsername(''); }} className="brutalist-button !bg-black !text-white hover:!bg-accent hover:!text-black !px-6 !py-3">
                New Analysis
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-12">
                  {/* Profile Bar */}
                  <ProfileBar
                    {...dashboardData.profile}
                    onRefresh={() => handleSearch({ preventDefault: () => { } } as any)}
                    isLoading={loading}
                  />

                  {/* Row 1A - Performance Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                      label="Engagement Rate"
                      value={dashboardData.engagement}
                      badgeText={parseFloat(dashboardData.engagement) > 3 ? "Strong" : "Low"}
                      variant="amber"
                      icon={Activity}
                    />
                    <MetricCard
                      label="Growth Index"
                      value={dashboardData.growth}
                      badgeText={dashboardData.growth > 60 ? "Optimal" : "Needs Work"}
                      variant="emerald"
                      icon={TrendingUp}
                    />
                    <MetricCard
                      label="Viral Probability"
                      value={`${dashboardData.viral}%`}
                      badgeText={dashboardData.viral > 40 ? "High" : "Moderate"}
                      variant="violet"
                      icon={Zap}
                    />
                    <MetricCard
                      label="Posts Analyzed"
                      value={dashboardData.velocity}
                      badgeText={`${dashboardData.reelCount}R · ${dashboardData.imageCount}P`}
                      variant="blue"
                      icon={Timer}
                    />
                  </div>

                  {/* Row 1B - Aggregate Totals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                      label="Total Views"
                      value={dashboardData.totalViews}
                      badgeText="All Posts"
                      variant="violet"
                      icon={Eye}
                    />
                    <MetricCard
                      label="Total Interactions"
                      value={dashboardData.totalInteractions}
                      badgeText="Likes + Comments"
                      variant="amber"
                      icon={MessageSquare}
                    />
                    <MetricCard
                      label="Avg Views / Post"
                      value={dashboardData.avgViews}
                      badgeText="Per Content"
                      variant="emerald"
                      icon={Activity}
                    />
                    <MetricCard
                      label="Avg Likes / Post"
                      value={dashboardData.avgLikes}
                      badgeText="Per Content"
                      variant="blue"
                      icon={Share2}
                    />
                  </div>

                  {/* Row 2 Analytics Chart */}
                  <ContentChart
                    data={data.posts}
                  />

                  {/* Row 3 Main Content */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                    <div className="lg:col-span-3">
                      <AccountHealth score={dashboardData.score} metrics={dashboardData.healthMetrics} />
                    </div>
                    <div className="lg:col-span-5">
                      <NextPostPlan {...dashboardData.nextPlan} onViewStrategy={() => setActiveTab('strategy')} />
                    </div>
                    <div className="lg:col-span-4">
                      <TopPerformer {...dashboardData.topPerformer} />
                    </div>
                  </div>

                  {/* Row 3 Activity Strip */}
                  <div className="space-y-4">
                    <h3 className="label-tiny">Real-Time Action Engine</h3>
                    <ActionStrip cards={dashboardData.actionCards} />
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setActiveTab('actions')}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-2 group"
                      >
                        View All Action Cards <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'actions' && (
                <div className="space-y-12">
                  <div className="max-w-4xl mx-auto space-y-12">
                    <div className="text-center space-y-4">
                      <h2 className="text-6xl font-black text-black tracking-tighter uppercase underline decoration-accent decoration-[12px] underline-offset-4">High-Impact Actions</h2>
                      <p className="text-black/70 text-xs font-black tracking-[0.4em] uppercase">Intelligence Priority Analysis</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {dashboardData.actionCards.map((card: any) => (
                        <ActionCard
                          key={card.id}
                          card={card}
                          onDismiss={(id) => {
                            const updatedData = {
                              ...data,
                              insights: {
                                ...data.insights,
                                action_cards: data.insights.action_cards.filter((c: any) => c.id !== id)
                              }
                            };
                            setData(updatedData);
                          }}
                        />
                      ))}
                    </div>

                    {dashboardData.actionCards.length === 0 && (
                      <div className="py-24 text-center border-8 border-dashed border-black/10 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
                        <Zap size={64} className="text-black/10 mx-auto mb-6" />
                        <p className="text-black/60 font-black uppercase tracking-[0.4em] text-sm">No Active Protocols Found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'strategy' && (
                <div className="space-y-12">
                  <div className="max-w-6xl mx-auto">
                    <div className="text-center space-y-4 mb-16">
                      <h2 className="text-6xl font-black text-black tracking-tighter uppercase leading-none">Neural Strategy <span className="text-accent underline decoration-black decoration-[12px] underline-offset-4">Blueprints</span></h2>
                      <p className="text-black/70 text-xs font-black tracking-[0.4em] uppercase">Advanced Audience Acquisition Vector v3.3</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                      {/* Growth Roadmap */}
                      <div className="brutalist-card !p-12 !bg-white flex flex-col hover:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <div className="w-20 h-20 bg-accent border-4 border-black flex items-center justify-center mb-12 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                          <TrendingUp size={40} className="text-black" />
                        </div>
                        <h3 className="text-4xl font-black text-black mb-12 tracking-tighter uppercase leading-none underline decoration-accent decoration-8">Growth Roadmap</h3>
                        <div className="space-y-8 flex-1">
                          {dashboardData.growthRoadmap.map((opt: string, i: number) => (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              key={i}
                              className="flex gap-8 items-start group p-6 border-4 border-transparent hover:border-black hover:bg-black/5 transition-all"
                            >
                              <span className="text-6xl font-black text-black/10 group-hover:text-accent transition-colors leading-none select-none">0{i + 1}</span>
                              <p className="text-black font-black text-lg leading-tight pt-2 uppercase tracking-tighter">{opt}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Content Blueprint */}
                      <div className="space-y-12">
                        <div className="brutalist-card !p-12 !bg-white flex flex-col border-accent hover:shadow-[16px_16px_0px_0px_rgba(252,227,0,1)] transition-all">
                          <div className="w-20 h-20 bg-black border-4 border-black flex items-center justify-center mb-12 shadow-[6px_6px_0px_0px_rgba(252,227,0,1)]">
                            <Sparkles size={40} className="text-accent" />
                          </div>
                          <h3 className="text-4xl font-black text-black mb-12 tracking-tighter uppercase leading-none">Content Blueprints</h3>
                          <div className="space-y-8">
                            {dashboardData.contentBlueprint.map((reel: any, i: number) => (
                              <div key={i} className="p-8 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:translate-x-[-4px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all group">
                                <h4 className="text-xl font-black text-black mb-4 uppercase tracking-tighter group-hover:text-accent group-hover:bg-black p-2 inline-block transition-all">{reel.title}</h4>
                                <p className="text-md italic font-black text-black/70 mb-6 leading-relaxed border-l-4 border-black pl-6">"{reel.hook}"</p>
                                <div className="flex flex-wrap gap-3">
                                  {reel.hashtags?.map((h: string) => (
                                    <span key={h} className="pill-badge !bg-black !text-white !border-black">#{h}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Neural Report Card */}
                        <div className="brutalist-card !bg-black !p-12 text-white shadow-[16px_16px_0px_0px_rgba(252,227,0,1)] relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-150 transition-transform duration-1000 rotate-12">
                            <Share2 size={160} />
                          </div>
                          <h4 className="text-5xl font-black tracking-tighter mb-6 uppercase leading-none underline decoration-white decoration-8">Neural Report v3.0</h4>
                          <p className="text-white/80 text-lg leading-tight mb-12 font-black uppercase tracking-tight">
                            Llama-3.3-70B high-intelligence cross-referenced niche viral signals.
                          </p>
                          <button className="brutalist-button !w-full !bg-accent !text-black !py-6 hover:!bg-white">
                            DOWNLOAD CAMPAIGN PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'dev' && (
                <div className="space-y-12 pb-20">
                  <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center border border-white/20">
                        <Terminal size={24} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Diagnostic Portal</h2>
                        <p className="text-white/60 text-sm font-black tracking-widest uppercase">Raw Payload Inspection & Neural Cycles</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                      {/* Sending to AI Section */}
                      <div className="bg-zinc-900 p-8 border-4 border-white/20">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <Share2 size={18} className="text-accent" />
                            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Outgoing Prompt</h3>
                          </div>
                          <span className="pill-badge bg-white/10 text-white border border-white/20">Sent to AI</span>
                        </div>
                        <div className="bg-[#05070a] p-6 border-2 border-white/10 overflow-hidden">
                          <pre className="text-[11px] text-accent/80 font-mono whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto no-scrollbar">
                            {data.dev?.prompt}
                          </pre>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Normalized Data */}
                        <div className="bg-zinc-900 p-8 border-4 border-white/20">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <Activity size={18} className="text-emerald" />
                              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Normalized Data</h3>
                            </div>
                            <span className="pill-badge bg-emerald/10 text-emerald border border-emerald/20">Apify Data</span>
                          </div>
                          <div className="bg-[#05070a] p-6 border-2 border-white/10 overflow-hidden">
                            <pre className="text-[11px] text-emerald/80 font-mono whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto no-scrollbar">
                              {JSON.stringify(data.dev?.summaryData, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Received JSON */}
                        <div className="bg-zinc-900 p-8 border-4 border-white/20">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <Sparkles size={18} className="text-amber" />
                              <h3 className="text-xl font-bold text-white uppercase tracking-tight">AI Interpretation</h3>
                            </div>
                            <span className="pill-badge bg-amber/10 text-amber border border-amber/20">Received JSON</span>
                          </div>
                          <div className="bg-[#05070a] p-6 border-2 border-white/10 overflow-hidden">
                            <pre className="text-[11px] text-amber/80 font-mono whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto no-scrollbar">
                              {JSON.stringify(data.insights, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Meta Context */}
                      <div className="bg-zinc-900 p-6 border-4 border-white/20 flex flex-wrap gap-8 items-center justify-center">
                        <div className="text-center">
                          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Raw Items</p>
                          <p className="text-white font-black">{data.dev?.rawItems || 0}</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">AI Engine</p>
                          <p className="text-white font-black">{data.aiUsed ? "Active" : "Baseline Fallback"}</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Algorithm</p>
                          <p className="text-white font-black">v2.0 Beta</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Tokens (I/O)</p>
                          <p className="text-white font-black text-[10px]">
                            {data.dev?.usage?.promptTokens || data.dev?.usage?.prompt_tokens || 0} / {data.dev?.usage?.completionTokens || data.dev?.usage?.completion_tokens || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      )}
    </div>
  );
}
