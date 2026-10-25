import { CheckCircle2, Info, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import type { ToastMessage } from '../../types/reports';

export function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <ol
      className="toast-stack"
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => {
        const Icon = {
          danger: ShieldAlert,
          warning: TriangleAlert,
          info: Info,
          success: CheckCircle2,
        }[item.tone];
        return (
          <li
            key={item.id}
            className={`toast-card ${item.tone}`}
            data-toast-id={item.id}
            role="status"
          >
            <Icon size={17} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <button onClick={() => onDismiss(item.id)} aria-label={`Dismiss ${item.title}`}>
              <X size={14} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
