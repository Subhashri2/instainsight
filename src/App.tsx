import React, { useState, useMemo } from 'react';
import { Search, Loader2, TrendingUp, Heart, MessageCircle, PlaySquare, Image as ImageIcon, AlertCircle, Zap, BarChart3, Clock, Timer, Sparkles, Hash, Lightbulb, ArrowUpRight, Share2, Layout } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<{ message: string; details?: string; suggestion?: string } | null>(null);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'strategy' | 'feed'>('dashboard');

  // Sync with URL query parameter on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u');
    if (u) {
      setUsername(u);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent, overrideUsername?: string) => {
    e.preventDefault();
    let targetUsername = (overrideUsername || username).trim();
    if (!targetUsername) return;

    if (targetUsername.includes('instagram.com/')) {
      try {
        const urlPath = targetUsername.split('instagram.com/')[1];
        targetUsername = urlPath.split('/')[0].split('?')[0];
        setUsername(targetUsername);
      } catch (err) {
        console.error("URL parsing error:", err);
      }
    }

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('u', targetUsername);
    window.history.pushState({}, '', newUrl);

    setLoading(true);
    setLoadingStage('Scraping Instagram profile...');
    setError(null);
    setData(null);

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: targetUsername }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw {
          message: result.error || 'Failed to fetch Instagram data',
          details: result.details,
          suggestion: result.suggestion
        };
      }

      setData(result);
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError({
        message: err.message || 'An unexpected error occurred',
        details: err.details || (err instanceof Error ? err.message : String(err)),
        suggestion: err.suggestion || "Please try again later or check your connection."
      });
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const metrics = useMemo(() => {
    if (!data || !data.posts) return null;
    const posts = data.posts;
    const totalLikes = posts.reduce((acc: number, p: any) => acc + (p.likesCount || 0), 0);
    const totalComments = posts.reduce((acc: number, p: any) => acc + (p.commentsCount || 0), 0);
    const totalViews = posts.reduce((acc: number, p: any) => acc + (p.videoViewCount || p.videoPlayCount || 0), 0);
    const avgLikes = Math.round(totalLikes / posts.length);
    const avgViews = Math.round(totalViews / posts.length);

    const engagementRate = (((totalLikes + totalComments) / (totalViews || 1)) * 100).toFixed(2);
    const growthScore = Math.min(100, Math.round((avgLikes / 500) * 100));
    const viralProb = Math.min(100, Math.round((totalViews / (totalLikes || 1)) * 1.5));

    const bestPost = [...posts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];

    const hours = posts.map((p: any) => p.timestamp ? new Date(p.timestamp).getHours() : 12);
    const bestHour = hours.sort((a: number, b: number) =>
      hours.filter((v: number) => v === a).length - hours.filter((v: number) => v === b).length
    ).pop();

    return {
      totalPosts: posts.length,
      avgLikes,
      avgViews,
      engagementRate,
      growthScore,
      viralProb,
      bestPost,
      bestPostingTime: `${bestHour}:00`,
      bestReelDuration: "12-18s"
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#020203] text-zinc-200 font-sans selection:bg-indigo-500/30 selection:text-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0], x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full"
        />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="w-11 h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center transition-all group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10">
              <TrendingUp size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">CORTEX<span className="text-indigo-500">.AI</span></h1>
              <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Social Intelligence Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <form onSubmit={handleSearch} className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or profile link..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm placeholder:text-zinc-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 shrink-0"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Run Engine'}
              </button>
            </form>
            {data && (
              <button
                onClick={() => { setData(null); setUsername(''); window.history.pushState({}, '', '/'); }}
                className="p-3 bg-white/5 border border-white/10 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
                title="New Analysis"
              >
                <Layout size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {loading && (
          <div className="flex flex-col items-center justify-center py-40 space-y-8">
            <div className="relative">
              <div className="w-24 h-24 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="text-indigo-400 animate-pulse" size={32} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Processing Intelligence</h2>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">{loadingStage}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto bg-red-500/5 border border-red-500/10 rounded-3xl p-10 backdrop-blur-xl">
            <div className="flex gap-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="text-red-500" size={32} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white">{error.message}</h3>
                <p className="text-zinc-500 text-sm font-mono bg-white/5 p-4 rounded-xl break-all border border-white/5">{error.details}</p>
                <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {error.suggestion}
                </div>
                <button onClick={() => setError(null)} className="pt-4 text-zinc-400 hover:text-white text-sm font-bold transition-colors">Dismiss and Retry</button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="flex flex-col items-center justify-center py-48 text-center">
            <div className="w-32 h-32 bg-white/5 rounded-[40px] flex items-center justify-center mb-10 border border-white/10 shadow-2xl relative group">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <BarChart3 className="text-zinc-600 group-hover:text-indigo-400 transition-colors relative" size={64} />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter mb-6">Social Intelligence.</h2>
            <p className="text-zinc-500 text-lg max-w-lg leading-relaxed mx-auto">
              Institutional-grade analytics and AI-driven content strategies for any public Instagram profile.
            </p>
          </div>
        )}

        {data && metrics && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            {/* Tab Switcher */}
            <div className="flex items-center justify-center">
              <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl shadow-2xl shadow-indigo-500/5">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
                  { id: 'strategy', label: 'AI Strategy', icon: <Sparkles size={18} /> },
                  { id: 'feed', label: 'Content Feed', icon: <PlaySquare size={18} /> }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 z-10 ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30 -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {/* DASHBOARD TAB: Combined Metrics + Analytics */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-8">
                    {/* Hero Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <HeroCard
                        label="Engagement Rate"
                        value={`${metrics.engagementRate}%`}
                        trend="+12.4%"
                        icon={<Zap size={24} className="text-amber-400" />}
                        color="from-amber-500/10 to-transparent"
                        borderColor="border-amber-500/20"
                      />
                      <HeroCard
                        label="Growth Index"
                        value={metrics.growthScore}
                        trend="Optimal"
                        icon={<TrendingUp size={24} className="text-emerald-400" />}
                        color="from-emerald-500/10 to-transparent"
                        borderColor="border-emerald-500/20"
                      />
                      <HeroCard
                        label="Viral Probability"
                        value={`${metrics.viralProb}%`}
                        trend="High"
                        icon={<Sparkles size={24} className="text-indigo-400" />}
                        color="from-indigo-500/10 to-transparent"
                        borderColor="border-indigo-500/20"
                      />
                      <HeroCard
                        label="Post Velocity"
                        value={metrics.totalPosts}
                        trend="Consistent"
                        icon={<Timer size={24} className="text-purple-400" />}
                        color="from-purple-500/10 to-transparent"
                        borderColor="border-purple-500/20"
                      />
                    </div>

                    {/* Performance Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-8">
                        {/* Area Chart */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-10 backdrop-blur-xl relative overflow-hidden">
                          <div className="flex items-center justify-between mb-10">
                            <div className="space-y-1">
                              <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <BarChart3 size={24} className="text-indigo-500" />
                                Engagement Performance
                              </h3>
                              <p className="text-xs text-zinc-500 font-medium">Historical data from last {data.posts.length} posts</p>
                            </div>
                          </div>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={data.posts.slice().reverse().map((p: any, i: number) => ({ name: i, val: p.likesCount || 0 }))}>
                                <defs>
                                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff03" />
                                <XAxis hide />
                                <YAxis hide />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '12px' }}
                                  itemStyle={{ color: '#fff' }}
                                  labelStyle={{ display: 'none' }}
                                />
                                <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Secondary metrics grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <MetricCard label="Avg. Likes" value={metrics.avgLikes.toLocaleString()} icon={<Heart size={18} />} />
                          <MetricCard label="Avg. Views" value={metrics.avgViews.toLocaleString()} icon={<PlaySquare size={18} />} />
                          <MetricCard label="Best Time" value={metrics.bestPostingTime} icon={<Clock size={18} />} />
                          <MetricCard label="Best Duration" value={metrics.bestReelDuration} icon={<Timer size={18} />} />
                        </div>
                      </div>

                      {/* Best Content Block */}
                      <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl h-full flex flex-col">
                          <h3 className="text-xl font-black text-white mb-6">Top Performer</h3>
                          <div className="flex-1 rounded-2xl overflow-hidden relative mb-6 min-h-[200px] border border-white/5 group">
                            {metrics.bestPost?.displayUrl && (
                              <img
                                src={metrics.bestPost.displayUrl}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                              <div className="flex items-center gap-4 text-white font-black">
                                <span className="flex items-center gap-1.5"><Heart size={16} className="text-rose-500" /> {metrics.bestPost?.likesCount?.toLocaleString()}</span>
                                <span className="flex items-center gap-1.5"><MessageCircle size={16} className="text-blue-500" /> {metrics.bestPost?.commentsCount?.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <p className="text-xs text-zinc-500 font-medium line-clamp-2">{metrics.bestPost?.caption}</p>
                            <div className="flex flex-wrap gap-2">
                              {(metrics.bestPost?.hashtags || []).slice(0, 3).map((h: string) => (
                                <span key={h} className="text-[10px] bg-white/5 px-2.5 py-1 rounded-lg text-indigo-400 font-bold border border-white/5">#{h}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STRATEGY TAB */}
                {activeTab === 'strategy' && (
                  <div className="max-w-5xl mx-auto space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 backdrop-blur-xl">
                        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-10 border border-amber-500/20">
                          <Lightbulb size={28} className="text-amber-400" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-8">Growth Roadmap</h3>
                        <ul className="space-y-6">
                          {(data.insights?.advanced_analysis?.growth_opportunities || [
                            "Maintain consistent posting schedule during peak hours.",
                            "Increase focus on shared Reels to trigger discovery.",
                            "Optimize hashtags for niche engagement."
                          ]).map((opt: string, i: number) => (
                            <motion.li initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i} className="flex gap-4 group">
                              <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                {i + 1}
                              </div>
                              <p className="text-zinc-400 text-sm leading-relaxed group-hover:text-zinc-200 transition-colors">{opt}</p>
                            </motion.li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-8">
                        <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 backdrop-blur-xl">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-10 flex items-center gap-3">
                            <Sparkles size={18} className="text-indigo-500" />
                            Content Blueprint
                          </h4>
                          <div className="space-y-6">
                            {(data.insights?.reel_suggestions || [
                              { title: "Educational Insight", hook: "Did you know that viral content usually starts with...", hashtags: ["strategy", "growth"] },
                              { title: "Behind the Scenes", hook: "Let's take a look at how we build these...", hashtags: ["process", "inside"] }
                            ]).map((reel: any, i: number) => (
                              <div key={i} className="p-6 bg-white/5 rounded-[28px] border border-white/5 hover:border-indigo-500/30 transition-all group cursor-default">
                                <h5 className="font-bold text-white text-base mb-2 group-hover:text-indigo-400 transition-colors">{reel.title}</h5>
                                <p className="text-sm text-zinc-500 italic mb-4 leading-relaxed">"{reel.hook}"</p>
                                <div className="flex flex-wrap gap-2">
                                  {reel.hashtags?.map((h: string) => (
                                    <span key={h} className="text-[10px] font-black px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg">#{h}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[40px] p-10 text-white shadow-3xl shadow-indigo-600/20 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                            <Share2 size={120} />
                          </div>
                          <h4 className="text-3xl font-black tracking-tighter mb-4 relative">Neural Report</h4>
                          <p className="text-white/70 text-sm leading-relaxed mb-8 relative">
                            {data.aiUsed ? "Our Llama-3.3-70B model has analyzed your content velocity and engagement patterns." : "The AI model is currently offline. Basic dashboard insights are active."}
                          </p>
                          <button className="w-full py-4 bg-white text-indigo-700 rounded-2xl text-sm font-black hover:scale-[1.02] transition-all active:scale-95 shadow-xl relative">
                            Generate Campaign PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FEED TAB */}
                {activeTab === 'feed' && (
                  <section className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-2xl font-black text-white px-2">Content Inventory</h3>
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">{data.posts.length} Items</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {data.posts.map((post: any, i: number) => (
                        <FeedItem key={i} post={post} index={i} />
                      ))}
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>
    </div >
  );
}

function FeedItem({ post, index }: { post: any, index: number }) {
  const [isBroken, setIsBroken] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="aspect-[3/4] rounded-[32px] overflow-hidden relative group border border-white/10 bg-zinc-900 shadow-xl"
    >
      {!isBroken && post.displayUrl ? (
        <img
          src={post.displayUrl}
          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setIsBroken(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800 bg-zinc-900/50 gap-2">
          <ImageIcon size={48} className="opacity-10" />
          <span className="text-[10px] font-black uppercase tracking-tighter opacity-20">Media Unavailable</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6 z-20">
        <div className="flex items-center justify-between text-sm font-black text-white">
          <span className="flex items-center gap-2"><Heart size={16} className="text-rose-500" /> {post.likesCount?.toLocaleString() || 0}</span>
          <span className="flex items-center gap-2"><MessageCircle size={16} className="text-blue-500" /> {post.commentsCount?.toLocaleString() || 0}</span>
        </div>
      </div>
      {post.type === 'Video' && (
        <div className="absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 z-10">
          <PlaySquare size={18} className="text-white" />
        </div>
      )}
    </motion.div>
  );
}

function HeroCard({ label, value, trend, icon, color, borderColor }: { label: string, value: string | number, trend: string, icon: React.ReactNode, color: string, borderColor: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} ${borderColor} border rounded-[32px] p-8 backdrop-blur-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-500`}>
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity group-hover:scale-110 transition-transform duration-700">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">{label}</p>
      <div className="flex items-baseline gap-4">
        <h3 className="text-5xl font-black text-white tracking-tighter">{value}</h3>
        <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${trend === 'Optimal' || trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
          {trend}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, delay = 0 }: { label: string, value: string | number, icon: React.ReactNode, delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-md hover:bg-white/[0.08] transition-all group cursor-default relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all border border-white/5">
          {icon}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      </div>
      <p className="text-2xl font-black text-white tracking-tight">{value}</p>
    </motion.div>
  );
}
