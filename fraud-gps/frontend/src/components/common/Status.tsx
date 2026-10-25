import { LoaderCircle, TriangleAlert } from 'lucide-react';

export function Loading({ children = 'Loading evidence…' }: { children?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={18} />
      {children}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <TriangleAlert size={19} />
      <p>{message}</p>
      <button onClick={retry}>Retry</button>
    </div>
  );
}
export function Badge({ text, level = '' }: { text: string; level?: string }) {
  return <span className={`badge ${level.toLowerCase()}`}>{text}</span>;
}

export function EvidenceSkeleton({ children }: { children: string }) {
  return (
    <div className="evidence-skeleton" role="status" aria-busy="true">
      <span className="skeleton-label">{children}</span>
      <div aria-hidden="true">
        <i className="skeleton-block skeleton-heading" />
        <i className="skeleton-block" />
        <i className="skeleton-block" />
        <i className="skeleton-block skeleton-card" />
        <i className="skeleton-block" />
        <i className="skeleton-block" />
      </div>
    </div>
  );
}
