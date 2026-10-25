import axios from 'axios';
import type { DNAReport, EntityDNA, CampaignList } from '../types/dna';
import type { CaseSummary } from '../types/reports';
import type {
  AccountDetail,
  Complaint,
  GraphData,
  RiskResult,
  TraceOptions,
  TraceResult,
  TimelineData,
  TimelineEvent,
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
export async function fetchTimeline(
  id: string,
  options: TraceOptions,
  signal: AbortSignal,
): Promise<TimelineData> {
  const response = await api.get<TimelineEvent[]>(`/timeline/${encodeURIComponent(id)}`, {
    signal,
    params: options,
  });
  const version = response.headers['x-dataset-version'];
  if (typeof version !== 'string' || !version)
    throw new Error('The timeline has no dataset version. Restart the backend and retry.');
  return { dataset_version: version, events: response.data };
}
export const fetchTopRisks = async (limit: number, signal: AbortSignal) =>
  (await api.get<RiskResult[]>('/risk/top', { signal, params: { limit } })).data;
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error))
    return (
      error.response?.data?.error?.message ||
      'Backend connection failed. Start the server and refresh, or retry.'
    );
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
export { sameDataset } from './dataset';

export const fetchDNAReport = async (id: string, options: TraceOptions, signal: AbortSignal) =>
  (await api.get<DNAReport>(`/dna/${encodeURIComponent(id)}`, { params: options, signal })).data;
export const fetchEntityDNA = async (id: string, options: TraceOptions, signal: AbortSignal) =>
  (await api.get<EntityDNA>(`/dna/entity/${encodeURIComponent(id)}`, { params: options, signal }))
    .data;
export const fetchCampaigns = async (options: TraceOptions, signal: AbortSignal) =>
  (await api.get<CampaignList>('/dna/campaigns', { params: options, signal })).data;

export const fetchCaseSummary = async (id: string, options: TraceOptions, signal: AbortSignal) =>
  (
    await api.get<CaseSummary>(`/report/${encodeURIComponent(id)}/summary`, {
      params: options,
      signal,
    })
  ).data;

export async function fetchReport(trace: TraceResult, signal: AbortSignal) {
  try {
    const response = await api.post<Blob>(
      `/report/${encodeURIComponent(trace.complaint_id!)}`,
      {
        ...trace.options,
        expected_dataset_version: trace.dataset_version,
      },
      { responseType: 'blob', signal },
    );
    return {
      blob: response.data,
      version: response.headers['x-dataset-version'],
      type: response.headers['content-type'],
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const value = await error.response.data.text();
      let message: string | undefined;
      try {
        message = JSON.parse(value)?.error?.message;
      } catch {
        /* Non-JSON failures use the standard API message. */
      }
      if (message) throw new Error(message);
    }
    throw error;
  }
}
