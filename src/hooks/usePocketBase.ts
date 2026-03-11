/**
 * usePocketBase.ts
 * React hook for PocketBase authentication.
 * Token stored in localStorage, validated on app load.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface PBUser {
    id: string;
    email: string;
    name: string;
}

interface UsePocketBaseReturn {
    user: PBUser | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    error: string | null;
    clearError: () => void;
}

const TOKEN_KEY = 'instainsight_pb_token';
const USER_KEY = 'instainsight_pb_user';

export function usePocketBase(): UsePocketBaseReturn {
    const [user, setUser] = useState<PBUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Validate stored token on mount
    useEffect(() => {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
            // Validate token with backend
            apiFetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${storedToken}` },
            })
                .then((res) => {
                    if (res.ok) return res.json();
                    throw new Error('Invalid token');
                })
                .then((data) => {
                    setUser(data.user);
                    setToken(storedToken);
                })
                .catch(() => {
                    // Token expired or invalid — clear
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(USER_KEY);
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setError(null);
        try {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            setUser(data.user);
            setToken(data.token);
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const register = useCallback(async (email: string, password: string, name: string) => {
        setError(null);
        try {
            const res = await apiFetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            setUser(data.user);
            setToken(data.token);
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return { user, token, isLoading, login, register, logout, error, clearError };
}
