import axios from 'axios';
import type {
  AccountDetail,
  Complaint,
  Detection,
  GraphData,
  RiskResult,
  TraceOptions,
  TraceResult,
} from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  timeout: 20000,
});
export async function fetchComplaints(signal: AbortSignal): Promise<Complaint[]> {
  const items: Complaint[] = [];
  let total = Infinity;
  while (items.length < total) {
    const { data } = await api.get<{ total: number; items: Complaint[] }>('/complaints', {
      params: { offset: items.length, limit: 200 },
      signal,
    });
    total = data.total;
    if (!data.items.length) break;
    items.push(...data.items);
  }
  return items;
}
export const fetchGraphData = async (
  signal: AbortSignal,
  complaintId?: string,
  options?: TraceOptions,
) =>
  (
    await api.get<GraphData>(
      complaintId ? `/graph/trail/${encodeURIComponent(complaintId)}` : '/graph/full',
      { signal, params: options },
    )
  ).data;
export const traceComplaint = async (
  complaintId: string,
  options: TraceOptions,
  signal: AbortSignal,
) =>
  (await api.post<TraceResult>('/trace', { complaint_id: complaintId, ...options }, { signal }))
    .data;
export const fetchRiskScore = async (id: string, signal: AbortSignal) =>
  (await api.get<RiskResult>(`/risk/${encodeURIComponent(id)}`, { signal })).data;
export const fetchAccount = async (id: string, signal: AbortSignal) =>
  (await api.get<AccountDetail>(`/accounts/${encodeURIComponent(id)}`, { signal })).data;
export const fetchNeighborhood = async (id: string, signal: AbortSignal) =>
  (
    await api.get<GraphData>(`/graph/subgraph/${encodeURIComponent(id)}`, {
      signal,
      params: { depth: 1 },
    })
  ).data;
export const fetchTimeline = async (id: string, options: TraceOptions, signal: AbortSignal) =>
  (
    await api.get<(Detection & { step: number })[]>(`/timeline/${encodeURIComponent(id)}`, {
      signal,
      params: options,
    })
  ).data;
export const fetchTopRisks = async (limit: number, signal: AbortSignal) =>
  (await api.get<RiskResult[]>('/risk/top', { signal, params: { limit } })).data;
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error))
    return (
      error.response?.data?.error?.message ||
      'Could not reach the investigation API. Check that the backend is running, then retry.'
    );
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
export function sameDataset(...versions: string[]) {
  if (new Set(versions).size > 1)
    throw new Error('The dataset changed. Reload the workspace to continue.');
}
