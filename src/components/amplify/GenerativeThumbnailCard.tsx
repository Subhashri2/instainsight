import React, { useState, ChangeEvent } from 'react';
import { Image as ImageIcon, Copy, Check, ExternalLink, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../lib/api';

interface GenerativeThumbnailProps {
  topic?: string;
  hook?: string;
  caption?: string;
  niche?: string;
  isDevMode?: boolean;
}

export const GenerativeThumbnailCard: React.FC<GenerativeThumbnailProps> = ({
  topic = "Bridal Wear",
  hook = "Example hook",
  caption = "Example caption",
  niche = "Fashion",
  isDevMode = false
}) => {
  const [copiedSec, setCopiedSec] = useState<string | null>(null);
  const [thumbnailPrompt, setThumbnailPrompt] = useState<{ PROMPT: string; NEGATIVE_PROMPT: string } | null>(null);
  const [loadingThumbnail, setLoadingThumbnail] = useState(false);
  const [dryRunPrompt, setDryRunPrompt] = useState<string | null>(null);
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSec(section);
    setTimeout(() => setCopiedSec(null), 2000);
  };

  const handleReferenceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImageData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const generateThumbnail = async () => {
    setLoadingThumbnail(true);
    setDryRunPrompt(null);
    try {
      const res = await apiFetch('/api/generate-thumbnail-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          productName: topic,
          caption,
          keyDetails: hook,
          dryRun: isDevMode
        })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.dryRun) {
          setDryRunPrompt(result.prompt);
          setGeneratedImageUrl(null);
        } else if (result.PROMPT) {
          setThumbnailPrompt(result);
          setGeneratedImageUrl(null);
          setImageError(null);

          try {
            const imageBody: Record<string, any> = { prompt: result.PROMPT };
            if (referenceImageData) imageBody.referenceImage = referenceImageData;
            if (result.NEGATIVE_PROMPT) imageBody.negativePrompt = result.NEGATIVE_PROMPT;
            const imageRes = await apiFetch('/api/generate-thumbnail-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(imageBody),
            });
            if (!imageRes.ok) {
              const errBody = await imageRes.json().catch(() => null);
              throw new Error(errBody?.error || "Image generation failed");
            }
            const imagePayload = await imageRes.json();
            setGeneratedImageUrl(imagePayload.imageUrl || null);
          } catch (imageErr: any) {
            console.error("Thumbnail image generation error:", imageErr);
            setImageError(imageErr?.message || "Image generation failed");
          }
        } else {
          console.error("Malformed AI response:", result);
          setGeneratedImageUrl(null);
          setImageError("Malformed AI response");
        }
      }
    } catch (err) {
      console.error("Thumbnail generation error:", err);
    } finally {
      setLoadingThumbnail(false);
    }
  };

  return (
    <div className="brutalist-card p-8 flex flex-col h-full !bg-[#fce300]">
      <div className="flex justify-between items-start mb-8">
        <span className="pill-badge !bg-black !text-white !border-black scale-110 origin-left !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          GENERATIVE THUMBNAIL
        </span>
        <ImageIcon size={24} className="text-black" />
      </div>

      <h3 className="text-3xl font-black text-black mb-2 tracking-tighter uppercase">AI Visual Creator</h3>
      <p className="text-sm font-black text-black/60 mb-8 uppercase tracking-widest">
        Generate high-converting thumbnails using AI
      </p>

      <div className="flex-1 space-y-4">
        <button
          onClick={generateThumbnail}
          disabled={loadingThumbnail}
          className="brutalist-button !w-full !bg-white !text-black hover:!bg-black hover:!text-white !py-6 flex items-center justify-center gap-3 transition-all"
        >
          {loadingThumbnail ? <Loader2 size={24} className="animate-spin" /> : <ImageIcon size={24} />}
          <span className="text-lg font-black uppercase tracking-widest">
            {loadingThumbnail ? 'GENERATING PROMPT...' : 'GENERATE THUMBNAIL PROMPT'}
          </span>
        </button>

        {isDevMode && <div className="text-[10px] font-black uppercase text-center text-blue-800 bg-blue-200 border border-blue-800 p-1">Dev Mode mock enabled</div>}

        <div className="border-4 border-black p-4 bg-white space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-black/70">Reference image (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleReferenceUpload}
            className="w-full border-2 border-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.3em] bg-white focus:outline-none"
          />
          {referenceImageData && (
            <div className="mt-2">
              <p className="text-[10px] font-black text-black/60 uppercase tracking-[0.3em] mb-1">Uploaded preview</p>
              <img src={referenceImageData} alt="Reference" className="w-full h-40 object-cover border-2 border-black" />
            </div>
          )}
        </div>

        <AnimatePresence>
          {dryRunPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="border-4 border-black pt-4 bg-white px-6 pb-4 mt-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="brutalist-label !bg-blue-600 !text-white uppercase">Dev: Outgoing Prompt</span>
                  <button
                    onClick={() => handleCopy(dryRunPrompt, 'dryrun')}
                    className="p-1 hover:bg-black hover:text-white border-2 border-black transition-all text-black"
                  >
                    {copiedSec === 'dryrun' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="bg-[#f8f9fa] border-2 border-black p-3 text-[9px] font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto text-black">
                  {dryRunPrompt}
                </div>
              </div>
            </motion.div>
          )}

          {thumbnailPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="border-4 border-black pt-4 bg-white px-6 pb-4 mt-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-4">
                  <span className="pill-badge !bg-black !text-white !border-black">
                    ✨ READY PROMPT
                  </span>
                  <button
                    onClick={() => {
                      const text = `PROMPT:\n${thumbnailPrompt.PROMPT}\n\nNEGATIVE PROMPT:\n${thumbnailPrompt.NEGATIVE_PROMPT || 'N/A'}`;
                      navigator.clipboard.writeText(text);
                      setCopiedSec('all');
                      setTimeout(() => setCopiedSec(null), 2000);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-[#fce300] border-2 border-black font-black uppercase tracking-widest text-xs hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 text-black"
                  >
                    {copiedSec === 'all' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSec === 'all' ? 'COPIED!' : 'COPY BOTH PROMPTS'}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-black/50 uppercase tracking-widest mb-2">
                      Visual Strategy (Paste in Leonardo/Midjourney)
                    </p>
                    <div className="bg-[#f8f9fa] border-2 border-black p-4 text-xs font-bold leading-relaxed shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black">
                      {thumbnailPrompt.PROMPT}
                    </div>
                  </div>

                  {thumbnailPrompt.NEGATIVE_PROMPT && (
                    <div>
                      <p className="text-[10px] font-black text-red-600/50 uppercase tracking-widest mb-1">
                        Negative Signals
                      </p>
                      <div className="bg-red-50 p-2 border border-red-200 text-red-600 text-[10px] font-bold">
                        {thumbnailPrompt.NEGATIVE_PROMPT}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t-4 border-black flex items-center justify-between mt-4">
                    <span className="text-xs font-black text-black/60 uppercase">Powered by Gemini AI</span>
                    <a
                      href="https://gemini.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm font-black text-black hover:text-[#005fb8] underline decoration-4 underline-offset-4 decoration-black/10 hover:decoration-black transition-all"
                    >
                      OPEN GEMINI <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {generatedImageUrl && (
          <div className="border-4 border-black pt-4 bg-white px-6 pb-4 mt-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/60">Generated Thumbnail</p>
            <div className="w-full border-2 border-black">
              <img src={generatedImageUrl} alt="Generated thumbnail" className="w-full object-contain" />
            </div>
            <a
              href={generatedImageUrl}
              download="generative-thumbnail.png"
              className="inline-flex items-center gap-2 px-3 py-2 border-2 border-black font-black uppercase text-xs tracking-[0.4em] hover:bg-black hover:text-white transition-all"
            >
              <Download size={14} />
              Download
            </a>
          </div>
        )}

        {imageError && (
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-700">
            {imageError}
          </p>
        )}
      </div>
    </div>
  );
};
