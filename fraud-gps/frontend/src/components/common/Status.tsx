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
