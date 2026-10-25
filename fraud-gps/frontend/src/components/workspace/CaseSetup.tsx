import { useEffect, useRef } from 'react';
import { ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import type { InvestigationWorkspace } from '../../hooks/useInvestigationWorkspace';
import type { ViewMode } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { TrailStats } from '../cards/TrailStats';

export function CaseSetup({ model: m }: { model: InvestigationWorkspace }) {
  const panel = useRef<HTMLElement>(null);
  const close = () => m.setControlsOpen(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        m.setControlsOpen(false);
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const controls = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
      ];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      previous?.focus();
    };
  }, [m.setControlsOpen]);
  return (
    <div className="setup-overlay">
      <button
        className="setup-backdrop"
        onClick={close}
        aria-label="Dismiss case settings"
        tabIndex={-1}
      />
      <aside
        ref={panel}
        className="case-setup"
        id="case-controls"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <header>
          <span>
            <SlidersHorizontal size={19} />
            <h2 id="setup-title">Case settings</h2>
          </span>
          <button aria-label="Close case settings" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="setup-body">
          {m.selected && (
            <article className="setup-case">
              <p className="eyebrow">{m.caseId}</p>
              <h3>{m.selected.victim_name}</h3>
              <strong>{formatCurrency(m.selected.amount_lost)}</strong>
              <p>
                {m.selected.scam_type} · {m.selected.victim_bank}
              </p>
              <small>Filed {formatDate(m.selected.complaint_date)}</small>
              <details>
                <summary>Complaint details</summary>
                <p>{m.selected.description}</p>
              </details>
            </article>
          )}
          <h3>Trace settings</h3>
          <p className="setup-note">
            Changing these settings clears the current analysis. Trace again to apply them.
          </p>
          <label className="slider-label" htmlFor="depth">
            Trace depth<output>{m.options.max_depth} hops</output>
          </label>
          <input
            id="depth"
            aria-label="Trace depth"
            type="range"
            min="1"
            max="7"
            value={m.options.max_depth}
            onChange={(e) => m.changeOptions({ ...m.options, max_depth: Number(e.target.value) })}
          />
          <div className="range-ends">
            <span>1 hop</span>
            <span>7 hops</span>
          </div>
          <label className="slider-label" htmlFor="min-amount">
            Minimum transfer<output>{formatCurrency(m.options.min_amount)}</output>
          </label>
          <input
            id="min-amount"
            aria-label="Minimum amount"
            type="range"
            min="0"
            max="100000"
            step="100"
            value={m.options.min_amount}
            onChange={(e) => m.changeOptions({ ...m.options, min_amount: e.target.value })}
          />
          <div className="range-ends">
            <span>₹0</span>
            <span>₹1,00,000</span>
          </div>
          <label className="slider-label" htmlFor="window">
            Forwarding window<output>{m.options.forwarding_window_hours} hours</output>
          </label>
          <input
            id="window"
            aria-label="Forwarding window"
            type="range"
            min="1"
            max="168"
            value={m.options.forwarding_window_hours}
            onChange={(e) =>
              m.changeOptions({ ...m.options, forwarding_window_hours: Number(e.target.value) })
            }
          />
          <div className="range-ends">
            <span>1 hour</span>
            <span>7 days</span>
          </div>
          <h3>Graph display</h3>
          <label className="field-label" htmlFor="view-mode">
            Layout
          </label>
          <select
            id="view-mode"
            aria-label="Graph layout"
            value={m.view}
            onChange={(e) => m.setView(e.target.value as ViewMode)}
          >
            {['Route', 'Graph', 'Cluster'].map((view) => (
              <option key={view}>{view}</option>
            ))}
          </select>
          <label className="toggle-row">
            <span>
              Only suspicious accounts<small>Risk ≥ 0.50 + victim</small>
            </span>
            <input
              aria-label="Show only suspicious nodes"
              type="checkbox"
              checked={m.suspicious}
              onChange={(e) => {
                m.setSuspicious(e.target.checked);
                m.setSelection(null);
              }}
            />
          </label>
          {m.investigation.trace && (
            <details className="trail-details">
              <summary>Full trail statistics</summary>
              <TrailStats trace={m.investigation.trace} />
            </details>
          )}
        </div>
        <footer>
          <button
            onClick={m.run}
            className="primary"
            disabled={!m.selected || m.investigation.loading}
          >
            Trace with these options
            <ArrowRight size={17} />
          </button>
          <button onClick={close}>Done</button>
        </footer>
      </aside>
    </div>
  );
}
