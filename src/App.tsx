import React, { useState } from 'react';
import { Search, Loader2, TrendingUp, Heart, MessageCircle, PlaySquare, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<{ message: string; details?: string; suggestion?: string } | null>(null);
  const [data, setData] = useState<any>(null);

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
      setLoadingStage('Generating AI insights...');
      const prompt = `Analyze the following recent Instagram posts for the user @${username} and provide actionable insights. 
      Data: ${JSON.stringify(result.summaryData)}
      
      Provide a concise, professional analysis including:
      1. Overall engagement trends (likes, comments, views).
      2. Content format performance (Reels/Videos vs Images).
      3. 3-4 actionable suggestions for improvement.
      Format as Markdown. Keep it structured and easy to read.`;

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

      setData({
        ...result,
        insights: aiResponse.text
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
              {loadingStage} <br/>
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

              {/* Gemini Insights Section */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-6 text-white shadow-lg sticky top-24">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <TrendingUp size={16} className="text-white" />
                    </div>
                    <h3 className="text-lg font-semibold">AI Insights</h3>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-medium">
                    <Markdown>{data.insights}</Markdown>
                  </div>
                </div>
              </div>
            </div>
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
