const rawApiBase = import.meta.env.VITE_API_BASE_URL;
const NORMALIZED_API_BASE = rawApiBase?.replace(/\/+$/, "") ?? "";

const normalizeEndpoint = (endpoint: string) => endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

export const API_BASE_URL = NORMALIZED_API_BASE;

export const getApiUrl = (endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  return NORMALIZED_API_BASE ? `${NORMALIZED_API_BASE}${normalized}` : normalized;
};

export const apiFetch = (endpoint: string, options?: RequestInit) => {
  return fetch(getApiUrl(endpoint), options);
};
