import { useEffect, useState } from 'react';
import { errorMessage, fetchAccount, fetchRiskScore, sameDataset } from '../utils/api';
import type { AccountDetail, RiskResult } from '../types';

export function useRisk(id: string | undefined, version: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    loading: boolean;
    error?: string;
    account?: AccountDetail;
    risk?: RiskResult;
  }>({ key: '', loading: false });
  const key = `${id || ''}:${version}`;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setState({ key, loading: true });
    Promise.all([fetchAccount(id, controller.signal), fetchRiskScore(id, controller.signal)])
      .then(([account, risk]) => {
        sameDataset(version, account.dataset_version, risk.dataset_version);
        if (!controller.signal.aborted) setState({ key, loading: false, account, risk });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, loading: false, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [id, version, key, attempt]);
  return {
    ...(state.key === key
      ? state
      : { key, loading: !!id, error: undefined, account: undefined, risk: undefined }),
    retry: () => setAttempt((n) => n + 1),
  };
}
