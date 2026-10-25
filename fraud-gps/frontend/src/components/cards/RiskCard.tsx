import type { RiskResult } from '../../types';
import { Badge } from '../common/Status';
import { AnimatedValue } from '../common/AnimatedValue';

export function RiskCard({ risk }: { risk: RiskResult }) {
  const color =
    risk.total_score >= 0.7
      ? '#fb7185'
      : risk.total_score >= 0.5
        ? '#fb923c'
        : risk.total_score >= 0.3
          ? '#facc15'
          : '#34d399';
  return (
    <section className="risk-card" aria-label="Risk assessment">
      <div className="risk-summary">
        <div
          className="score-ring"
          style={{
            background: `conic-gradient(${color} ${risk.total_score * 360}deg, #223046 0)`,
            boxShadow: `0 0 14px ${color}18`,
          }}
        >
          <div>
            <strong style={{ color }}>
              <AnimatedValue value={risk.total_score.toFixed(2)} />
            </strong>
            <small>RISK SCORE</small>
          </div>
        </div>
        <div>
          <Badge text={risk.risk_level} level={risk.risk_level} />
          <p className="muted">
            Evidence-based
            <br />
            heuristic score
          </p>
        </div>
      </div>
      <div className="risk-components">
        {Object.entries(risk.component_scores).map(([name, score]) => (
          <div key={name} title={risk.component_formulas[name]}>
            <span>{name}</span>
            <div className="meter">
              <i style={{ width: `${score * 100}%`, background: color }} />
            </div>
            <span>{score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
