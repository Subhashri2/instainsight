import React, { useState } from 'react';
import { Clock, Sparkles, Copy, Check, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../lib/api';

interface NextPostPlanProps {
    topic?: string;
    time?: string;
    type?: string;
    collab?: boolean;
    hook?: string;
    caption?: string;
    hashtags?: string[];
    onViewStrategy?: () => void;
    // Context for specific plan generation
    userProfile?: any;
    summaryData?: any;
    playbook?: any;
    isDevMode?: boolean;
    posts?: any[];
}

export const NextPostPlan: React.FC<NextPostPlanProps> = ({
    topic: initialTopic = "Bridal Wear Collection",
    time: initialTime = "11:00 AM",
    type: initialType = "Video",
    collab: initialCollab = true,
    hook: initialHook = "Ever wondered how to find the perfect lehenga for your big day?",
    caption: initialCaption = "Step into a world of elegance with our new collection. Handcrafted for the modern bride who values tradition. Our Bridal 2024 series is now live!",
    hashtags: initialHashtags = ["BridalFashion", "LehengaLove", "WeddingVibes"],
    onViewStrategy,
    userProfile,
    summaryData,
    playbook,
    isDevMode = false,
    posts = []
}) => {
    const [copiedSec, setCopiedSec] = useState<string | null>(null);
    const [productDetails, setProductDetails] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Local state for the plan to allow updates
    const [plan, setPlan] = useState({
        topic: initialTopic,
        time: initialTime,
        type: initialType,
        collab: initialCollab,
        hook: initialHook,
        caption: initialCaption,
        hashtags: initialHashtags
    });

    // Sync local state when props change (e.g. on fresh analysis)
    React.useEffect(() => {
        setPlan({
            topic: initialTopic,
            time: initialTime,
            type: initialType,
            collab: initialCollab,
            hook: initialHook,
            caption: initialCaption,
            hashtags: initialHashtags
        });
    }, [initialTopic, initialTime, initialType, initialCollab, initialHook, initialCaption, initialHashtags]);

    const handleCopy = (text: string, section: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSec(section);
        setTimeout(() => setCopiedSec(null), 2000);
    };

    const generateSpecificPlan = async () => {
        if (!productDetails.trim()) return;
        setIsGenerating(true);
        try {
            console.log("[SpecificPlan] Requesting for:", productDetails);
            const res = await apiFetch('/api/generate-specific-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userProfile,
                    summaryData,
                    playbook,
                    productDetails,
                    posts,
                    dryRun: isDevMode
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                console.error("[SpecificPlan] Error:", data.error || "Unknown error");
                return;
            }

            if (data.dryRun) {
                console.log("[SpecificPlan] DRY RUN - PROMPT GENERATED:");
                console.log(data.prompt);
                
                // Mock update so user sees it "working" in dev mode
                setPlan(prev => ({
                    ...prev,
                    topic: productDetails,
                    hook: "[DEV MODE] AI would generate a hook here based on the prompt shown in terminal.",
                    caption: "[DEV MODE] AI would generate a full caption here."
                }));
                return;
            }

            if (data.next_post_plan) {
                const p = data.next_post_plan;
                setPlan({
                    topic: p.topic || "Specific Plan",
                    time: p.time || "11:00 AM",
                    type: p.type || "Video",
                    collab: initialCollab,
                    hook: p.hook || "",
                    caption: p.caption || "",
                    hashtags: p.hashtags || []
                });
            }
        } catch (err) {
            console.error("Failed to generate specific plan:", err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="brutalist-card p-5 sm:p-8 flex flex-col h-full !bg-white">
            <div className="flex justify-between items-start mb-6">
                <span className="pill-badge !bg-accent !text-black !border-black scale-110 origin-left !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    NEXT POST PLAN
                </span>
                <Sparkles size={24} className="text-black animate-pulse" />
            </div>

            {/* Specific Product Input Area */}
            <div className="mb-6 space-y-3">
                <div className="text-[10px] font-black text-black uppercase tracking-widest pl-1">📦 Plan for specific product</div>
                <textarea
                    value={productDetails}
                    onChange={(e) => setProductDetails(e.target.value)}
                    placeholder="Describe your next product (e.g., Banarasi Silk Saree collection)..."
                    className="w-full h-24 p-4 border-4 border-black font-black text-sm uppercase placeholder:text-black/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all outline-none"
                />
                <button
                    onClick={generateSpecificPlan}
                    disabled={isGenerating || !productDetails.trim()}
                    className="w-full py-3 bg-black text-white font-black uppercase text-xs tracking-[0.2em] border-4 border-black hover:bg-accent hover:text-black transition-all flex items-center justify-center gap-2 group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />}
                    <span>{isGenerating ? 'ANALYZING...' : 'GENERATE CUSTOM PLAN'}</span>
                </button>
            </div>

            <div className="border-t-4 border-black pt-6">
                <h3 className="text-2xl sm:text-3xl font-black text-black mb-2 tracking-tighter uppercase">{plan.topic}</h3>

                <div className="flex items-center gap-3 text-xs font-black text-black/80 mb-6 uppercase tracking-widest">
                    <Clock size={14} className="text-black" />
                    <span>{plan.time} · {plan.type} {plan.collab && "· Collab"}</span>
                </div>

                <div className="flex-1 bg-white border-4 border-black p-4 sm:p-6 space-y-5 sm:space-y-6 mb-6 sm:mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-y-auto max-h-[300px] sm:max-h-[400px]">
                    <div className="relative group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="brutalist-label">HOOK</span>
                            <button
                                onClick={() => handleCopy(plan.hook, 'hook')}
                                className="p-1 hover:bg-accent border-2 border-transparent hover:border-black transition-all"
                                title="Copy Hook"
                            >
                                {copiedSec === 'hook' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                        <p className="text-sm italic text-black leading-relaxed font-black">"{plan.hook}"</p>
                    </div>

                    <div className="border-t-4 border-black pt-4 relative group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="brutalist-label">CAPTION</span>
                            <button
                                onClick={() => handleCopy(plan.caption, 'caption')}
                                className="p-1 hover:bg-accent border-2 border-transparent hover:border-black transition-all"
                                title="Copy Caption"
                            >
                                {copiedSec === 'caption' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                        <p className="text-xs text-black/70 leading-relaxed font-bold whitespace-pre-wrap">{plan.caption}</p>
                    </div>

                    <div className="border-t-4 border-black pt-4 relative group">
                        <div className="flex justify-between items-center mb-3">
                            <span className="brutalist-label">HASHTAGS</span>
                            <button
                                onClick={() => handleCopy((Array.isArray(plan.hashtags) ? plan.hashtags : []).map(t => `#${t}`).join(' '), 'hashtags')}
                                className="p-1 hover:bg-accent border-2 border-transparent hover:border-black transition-all"
                                title="Copy Hashtags"
                            >
                                {copiedSec === 'hashtags' ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(Array.isArray(plan.hashtags) ? plan.hashtags : []).map((tag, i) => (
                                <span key={i} className="pill-badge !text-[9px] !bg-black !text-white !border-black">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 mt-auto">
                <button
                    onClick={onViewStrategy}
                    className="brutalist-button !w-full !bg-black !text-white hover:!bg-accent hover:!text-black !py-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                    FULL STRATEGY
                </button>
            </div>
        </div>
    );
};
