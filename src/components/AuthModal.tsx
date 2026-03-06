import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, LogIn, UserPlus, Loader2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (email: string, password: string) => Promise<void>;
    onRegister: (email: string, password: string, name: string) => Promise<void>;
    error: string | null;
}

export function AuthModal({ isOpen, onClose, onLogin, onRegister, error }: AuthModalProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'login') {
                await onLogin(email, password);
            } else {
                await onRegister(email, password, name);
            }
            onClose();
        } catch {
            // Error is handled by the hook
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="relative w-full max-w-md bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-black text-white px-8 py-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tighter uppercase">
                                    {mode === 'login' ? 'Welcome Back' : 'Join So-It Works.ai'}
                                </h2>
                                <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                                    {mode === 'login' ? 'Sign in to save your analyses' : 'Create account to save data'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {mode === 'register' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-black/60">Name</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Your name"
                                            className="w-full pl-12 pr-4 py-3 border-4 border-black font-bold text-sm focus:outline-none focus:border-accent transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(252,227,0,1)]"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-black/60">Email</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        required
                                        className="w-full pl-12 pr-4 py-3 border-4 border-black font-bold text-sm focus:outline-none focus:border-accent transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(252,227,0,1)]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-black/60">Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={8}
                                        className="w-full pl-12 pr-4 py-3 border-4 border-black font-bold text-sm focus:outline-none focus:border-accent transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(252,227,0,1)]"
                                    />
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-500 text-white px-4 py-3 font-bold text-xs border-2 border-black"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-accent border-4 border-black py-4 font-black text-sm uppercase tracking-[0.2em] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:translate-x-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : mode === 'login' ? (
                                    <LogIn size={18} />
                                ) : (
                                    <UserPlus size={18} />
                                )}
                                {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={switchMode}
                                    className="text-[10px] font-black uppercase tracking-[0.2em] text-black/50 hover:text-black transition-colors"
                                >
                                    {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
