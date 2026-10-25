import { useEffect, useRef, useState } from 'react';
import type { TraceResult } from '../types';
import type { ToastMessage } from '../types/reports';
import { errorMessage, fetchReport, sameDataset } from '../utils/api';

export function useReportDownload(
  trace: TraceResult | undefined,
  notify: (message: ToastMessage) => void,
) {
  const current = useRef(trace);
  current.current = trace;
  const pending = useRef<AbortController | null>(null);
  const urls = useRef(new Map<string, number>());
  const [state, setState] = useState<{ source?: TraceResult; loading: boolean; error?: string }>({
    loading: false,
  });
  useEffect(() => {
    const objectUrls = urls.current;
    setState({ source: trace, loading: false });
    return () => {
      pending.current?.abort();
      objectUrls.forEach((timer, url) => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      });
      objectUrls.clear();
    };
  }, [trace]);
  async function download() {
    if (!trace?.complaint_id) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ source: trace, loading: true });
    try {
      const { blob, version, type } = await fetchReport(trace, controller.signal);
      if (controller.signal.aborted || current.current !== trace) return;
      sameDataset(trace.dataset_version, version);
      if (
        typeof type !== 'string' ||
        !type.startsWith('application/pdf') ||
        !(await blob.slice(0, 5).text()).startsWith('%PDF-')
      )
        throw new Error('The server did not return a valid PDF. Retry report generation.');
      if (controller.signal.aborted || current.current !== trace) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FraudGPS-${trace.complaint_id}-Investigation.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      urls.current.set(
        url,
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.current.delete(url);
        }, 1000),
      );
      setState({ source: trace, loading: false });
      notify({
        id: 'report-downloaded',
        kind: 'system',
        tone: 'success',
        title: 'Report downloaded',
        detail: `${trace.complaint_id} · PDF investigation report`,
      });
    } catch (error) {
      if (!controller.signal.aborted && current.current === trace) {
        const message = errorMessage(error);
        setState({ source: trace, loading: false, error: message });
        notify({
          id: 'report-failed',
          kind: 'system',
          tone: 'danger',
          title: 'Report download failed',
          detail: message,
        });
      }
    }
  }
  return { ...(state.source === trace ? state : { loading: false }), download };
}
