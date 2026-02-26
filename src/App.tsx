import React, { useState } from 'react';
import { Search, Loader2, TrendingUp, Heart, MessageCircle, PlaySquare, Image as ImageIcon, AlertCircle, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { ActionCard } from './components/ActionCard';
import { ActionCardData } from './types/ActionCard';

export default function App() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<{ message: string; details?: string; suggestion?: string } | null>(null);
  const [data, setData] = useState<{
    posts: any[];
    summaryData: any[];
    actionCards: ActionCardData[];
    insights: string;
    profile?: any;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'actions' | 'performance'>('actions');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setLoadingStage('Scraping Instagram profile...');
    setError(null);
    setData(null);

    try {
      // 1. Fetch data from backend
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw {
          message: result.error || 'Failed to fetch Instagram data',
          details: result.details,
          suggestion: result.suggestion
        };
      }

      // 2. Generate insights using Gemini
      setLoadingStage('Analyzing metrics & generating actions...');
      const prompt = `Analyze the following recent Instagram posts for the user @${username} and provide actionable Action UI Cards in JSON format.
      
      Data: ${JSON.stringify(result.summaryData)}
      
      CRITICAL: You MUST return a VALID JSON object with the following structure:
      {
        "action_cards": [
          {
            "id": "string",
            "type": "follower_growth | viral_opportunity | sales_opportunity | hook_improvement | best_post_time | content_gap | niche_winner | engagement_boost | conversion_opportunity | performance_warning",
            "title": "string",
            "priority": "high | medium | low",
            "confidence_score": 0-100,
            "trigger": "A description of what happened in the data that triggered this card",
            "action": { "primary": "What to do", "secondary": "Optional detail" },
            "ready_to_copy": { "hook": "The first sentence/line", "caption": "The main body", "cta": "Call to action" },
            "post_time": { "date": "Tomorrow | Today | Day of Week", "time": "HH:MM" },
            "expected_result": { "followers_increase": "+X%", "confidence_level": "High | Medium" },
            "meta": { "difficulty": "Easy | Medium | Hard", "estimated_time_to_create": "X minutes", "impact_score": 1-10, "urgency_score": 1-10 }
          }
        ],
        "overall_summary_markdown": "A brief overview of current performance in Markdown"
      }

      REQUIRED:
      - Minimum 3 cards, Maximum 7 cards.
      - Each card must answer: What happened? What to do? What to post? When to post? What result?
      - Use these types where appropriate: follower_growth, viral_opportunity, sales_opportunity, hook_improvement, best_post_time, content_gap, niche_winner, engagement_boost, conversion_opportunity, performance_warning.
      - Be specific with hooks and captions.
      - Sort mentally by (Impact Score * 0.5 + Confidence Score * 0.3 + Urgency Score * 0.2) but return all for frontend to sort.
      - Return ONLY the JSON object. No other text.`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw {
          message: "Gemini API Key missing",
          details: "The application couldn't find a valid Gemini API key in the environment.",
          suggestion: "Please ensure the GEMINI_API_KEY is correctly configured in AI Studio."
        };
      }

      const ai = new GoogleGenAI({ apiKey });
      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (!aiResponse || !aiResponse.text) {
        throw {
          message: "AI Generation failed",
          details: "The Gemini model returned an empty response.",
          suggestion: "Try again in a few moments."
        };
      }

      let parsedInsights;
      try {
        const text = aiResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedInsights = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse AI response as JSON:", aiResponse.text);
        throw {
          message: "AI Analysis Format Error",
          details: "The AI returned a response that couldn't be parsed correctly.",
          suggestion: "Please try again."
        };
      }

      const sortedCards = (parsedInsights.action_cards || []).sort((a: any, b: any) => {
        const scoreA = (a.meta.impact_score * 0.5) + (a.confidence_score * 0.3) + (a.meta.urgency_score * 0.2);
        const scoreB = (b.meta.impact_score * 0.5) + (b.confidence_score * 0.3) + (b.meta.urgency_score * 0.2);
        return scoreB - scoreA;
      });

      setData({
        ...result,
        actionCards: sortedCards,
        insights: parsedInsights.overall_summary_markdown
      });
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

  const processChartData = (posts: any[]) => {
    return posts
      .slice()
      .reverse()
      .map((post: any, index: number) => ({
        name: `Post ${index + 1}`,
        date: post.timestamp ? format(new Date(post.timestamp), 'MMM dd') : '',
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        views: post.videoViewCount || 0,
        type: post.type,
      }));
  };

  const getAverages = (posts: any[]) => {
    if (!posts || posts.length === 0) return { likes: 0, comments: 0, views: 0 };
    const totalLikes = posts.reduce((acc, post) => acc + (post.likesCount || 0), 0);
    const totalComments = posts.reduce((acc, post) => acc + (post.commentsCount || 0), 0);
    const totalViews = posts.reduce((acc, post) => acc + (post.videoViewCount || 0), 0);
    return {
      likes: Math.round(totalLikes / posts.length),
      comments: Math.round(totalComments / posts.length),
      views: Math.round(totalViews / posts.length),
    };
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
              <TrendingUp size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">InstaInsights</h1>
          </div>

          <form onSubmit={handleSearch} className="w-full sm:w-auto flex items-center">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Instagram username..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="ml-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Analyze
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <h2 className="text-lg font-medium">Analyzing @{username}</h2>
            <p className="text-gray-500 text-sm mt-2 text-center max-w-md">
              {loadingStage} <br />
              This usually takes 1-2 minutes depending on the profile size.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 max-w-2xl mx-auto">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <h3 className="text-red-800 font-semibold text-lg">{error.message}</h3>
              {error.details && (
                <p className="text-red-700 text-sm mt-2 font-mono bg-red-100/50 p-2 rounded-lg break-all">
                  {error.details}
                </p>
              )}
              {error.suggestion && (
                <div className="mt-4 flex items-center gap-2 text-red-600 text-sm font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error.suggestion}
                </div>
              )}
              <button
                onClick={() => setError(null)}
                className="mt-6 text-sm font-semibold text-red-800 hover:text-red-900 underline underline-offset-4"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="text-indigo-500" size={32} />
            </div>
            <h2 className="text-xl font-medium text-gray-900">Ready to analyze</h2>
            <p className="text-gray-500 mt-2">Enter an Instagram username above to get AI-powered insights.</p>
          </div>
        )}

        {data && data.posts && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Tab Navigation */}
            <div className="flex p-1 bg-gray-100 rounded-2xl w-fit mx-auto sm:mx-0">
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'actions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Next Best Actions
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'performance' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Performance Analysis
              </button>
            </div>

            {activeTab === 'actions' ? (
              <div className="space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                      Good Evening, {data.profile?.fullName || data.profile?.username || 'Content Creator'}
                    </h2>
                    <p className="text-gray-500 font-bold mt-1 flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-400" />
                      Your Next Best Actions
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Following Growth</p>
                      <p className="text-sm font-black text-emerald-600">{data.profile?.followersCount?.toLocaleString()} Followers</p>
                    </div>
                    {data.profile?.profilePicUrl && (
                      <img src={data.profile.profilePicUrl} alt="Avatar" className="w-10 h-10 rounded-xl object-cover border-2 border-indigo-50" referrerPolicy="no-referrer" />
                    )}
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {data.actionCards.map((card) => (
                    <ActionCard
                      key={card.id}
                      card={card}
                      onAction={(c) => console.log("Create post for:", c)}
                      onSave={(c) => console.log("Save card:", c)}
                      onDismiss={(id) => {
                        setData({
                          ...data,
                          actionCards: data.actionCards.filter(c => c.id !== id)
                        });
                      }}
                    />
                  ))}
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" size={24} />
                    Executive Summary
                  </h3>
                  <div className="prose prose-indigo max-w-none prose-p:text-gray-600">
                    <Markdown>{data.insights}</Markdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard
                    icon={<Heart className="text-rose-500" size={24} />}
                    label="Avg. Likes"
                    value={getAverages(data.posts).likes.toLocaleString()}
                    bgColor="bg-rose-50"
                  />
                  <StatCard
                    icon={<MessageCircle className="text-blue-500" size={24} />}
                    label="Avg. Comments"
                    value={getAverages(data.posts).comments.toLocaleString()}
                    bgColor="bg-blue-50"
                  />
                  <StatCard
                    icon={<PlaySquare className="text-purple-500" size={24} />}
                    label="Avg. Views (Reels)"
                    value={getAverages(data.posts).views.toLocaleString()}
                    bgColor="bg-purple-50"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Charts Section */}
                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                        <h4 className="text-emerald-800 font-bold mb-4 flex items-center gap-2">
                          <TrendingUp size={18} /> Best Performing Post
                        </h4>
                        {data.posts.length > 0 && (() => {
                          const best = [...data.posts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
                          return (
                            <div className="flex gap-4">
                              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 border border-emerald-100 shadow-sm">
                                <img src={best.displayUrl} alt="Best" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div>
                                <p className="text-2xl font-black text-emerald-700">{best.likesCount?.toLocaleString()} Likes</p>
                                <p className="text-sm text-emerald-600 line-clamp-2 mt-1">{best.caption}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                        <h4 className="text-rose-800 font-bold mb-4 flex items-center gap-2">
                          <AlertCircle size={18} /> Needs Improvement
                        </h4>
                        {data.posts.length > 0 && (() => {
                          const worst = [...data.posts].sort((a, b) => (a.likesCount || 0) - (b.likesCount || 0))[0];
                          return (
                            <div className="flex gap-4">
                              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 border border-rose-100 shadow-sm">
                                {worst.displayUrl ? (
                                  <img src={worst.displayUrl} alt="Worst" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                                    <ImageIcon size={24} />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-2xl font-black text-rose-700">{worst.likesCount?.toLocaleString()} Likes</p>
                                <p className="text-sm text-rose-600 line-clamp-2 mt-1">{worst.caption}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold mb-6">Engagement Trends (Recent Posts)</h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={processChartData(data.posts)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dx={-10} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                              cursor={{ stroke: '#f0f0f0', strokeWidth: 2 }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                            <Line yAxisId="left" type="monotone" dataKey="likes" name="Likes" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            <Line yAxisId="left" type="monotone" dataKey="comments" name="Comments" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold mb-6">Recent Posts Preview</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {data.posts.slice(0, 8).map((post: any, i: number) => (
                          <div key={i} className="group relative aspect-square bg-gray-100 rounded-2xl overflow-hidden">
                            {post.displayUrl ? (
                              <img src={post.displayUrl} alt="Post preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                {post.type === 'Video' ? <PlaySquare size={32} /> : <ImageIcon size={32} />}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                              <div className="flex items-center gap-1.5 text-sm font-medium"><Heart size={16} /> {post.likesCount}</div>
                              <div className="flex items-center gap-1.5 text-sm font-medium"><MessageCircle size={16} /> {post.commentsCount}</div>
                            </div>
                            {post.type === 'Video' && (
                              <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full text-white backdrop-blur-sm">
                                <PlaySquare size={14} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, bgColor }: { icon: React.ReactNode, label: string, value: string | number, bgColor: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-14 h-14 ${bgColor} rounded-2xl flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-gray-500 text-sm font-medium">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
