import { API_BASE_URL } from './api-url';
import { authenticatedFetch } from './authenticated-fetch';

export interface AiRecommendation {
  id: number;
  farmlandId?: number;
  summary: string;
  detailed_advice: string;
  step_by_step_steps: string[];
  action_type: string;
  weather_snapshot?: any[];
  created_at: string;
  farmland?: {
    id: number;
    name: string;
    adm4_code?: string;
    user_id?: number;
    farmer_group_id?: number | null;
    commodity?: { id: number; name: string } | null;
  };
}

export interface AiRecommendationHistory {
  data: AiRecommendation[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface MarketAnalysis {
  id: number;
  province_code: string;
  commodity_name: string;
  surplus_percentage: number;
  price_trend: string;
  analysis_summary: string;
  prediction_meta?: {
    simple_summary_for_farmers?: string;
    bps_baseline_used?: boolean;
    weather_impact_assessment?: string;
    next_month_surplus_percentage?: number;
    price_forecast_reason?: string;
    historical_analogy_context?: string;
  };
  related_farmlands?: Array<{ id: number; name: string; adm4_code: string }>;
  created_at: string;
}

export interface MarketAnalysisHistory {
  data: MarketAnalysis[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

async function getJson<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Gagal mengambil analisis lahan.');
  return data;
}

export async function getFarmlandRecommendation(id: string | number): Promise<AiRecommendation | null> {
  const result = await getJson<{ data: AiRecommendation[] }>(`/ai-recommendations/farmlands/${id}/recommendations?limit=1`);
  return result.data?.[0] || null;
}

export function getRecommendationDetail(id: string | number): Promise<AiRecommendation> {
  return getJson<AiRecommendation>(`/ai-recommendations/recommendations/${id}`);
}

export function getMyFarmlandRecommendations(page = 1, limit = 12): Promise<AiRecommendationHistory> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return getJson<AiRecommendationHistory>(`/ai-recommendations/recommendations/my-farmlands?${query.toString()}`);
}

export async function getFarmlandMarketAnalysis(id: string | number): Promise<MarketAnalysis | null> {
  const result = await getJson<{ data?: MarketAnalysis[] } | MarketAnalysis[]>(`/ai-recommendations/farmlands/${id}/market-analysis?limit=1&refresh=${Date.now()}`);
  const data = Array.isArray(result) ? result : result.data;
  return data?.[0] || null;
}

export function getMyFarmlandMarketAnalyses(page = 1, limit = 12): Promise<MarketAnalysisHistory> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return getJson<MarketAnalysisHistory>(`/ai-recommendations/market-analysis/my-farmlands?${query.toString()}`);
}

export function getMarketAnalysisDetail(id: string | number): Promise<MarketAnalysis> {
  return getJson<MarketAnalysis>(`/ai-recommendations/market-analysis/${id}`);
}