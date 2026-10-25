import { ArrowUpRight, Dna, FileText, FolderOpen, Radar, Route, ShieldCheck } from 'lucide-react';
import { workspaceSections, type WorkspaceSection } from '../../hooks/useWorkspaceNavigation';

export function WorkspaceNav({
  section,
  navigate,
  ready,
}: {
  section: WorkspaceSection;
  navigate: (section: WorkspaceSection) => void;
  ready: boolean;
}) {
  const icons = { cases: FolderOpen, trace: Route, dna: Dna, summary: FileText };
  return (
    <nav className="workspace-nav" aria-label="Workspace sections">
      <a
        className="nav-brand"
        href="#/cases"
        onClick={(event) => {
          event.preventDefault();
          navigate('cases');
        }}
      >
        <span>
          <Radar size={24} />
        </span>
        <div>
          Fraud<span>GPS</span>
          <small>FOLLOW THE EVIDENCE</small>
        </div>
      </a>
      <p className="nav-caption">INVESTIGATION</p>
      <div
        role="tablist"
        aria-label="Investigation panels"
        aria-orientation="vertical"
        className="module-tabs"
      >
        {workspaceSections.map((item, index) => {
          const Icon = icons[item.id];
          return (
            <a
              key={item.id}
              id={`${item.id}-tab`}
              role="tab"
              href={`#/${item.id}`}
              aria-controls={`${item.id}-panel`}
              aria-selected={section === item.id}
              tabIndex={section === item.id ? 0 : -1}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.id);
              }}
              onKeyDown={(event) => {
                if (
                  !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 3
                      : (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : 3)) % 4;
                navigate(workspaceSections[next].id);
                document.getElementById(`${workspaceSections[next].id}-tab`)?.focus();
              }}
            >
              <Icon size={19} />
              <span>
                <strong>{item.label}</strong>
                <small aria-hidden="true">{item.hint}</small>
              </span>
              <i />
            </a>
          );
        })}
      </div>
      <div className="nav-bottom">
        <div className="nav-note">
          <ShieldCheck size={19} />
          <strong>Evidence first.</strong>
          <p>Every insight, connected to its source.</p>
          <ArrowUpRight size={16} />
        </div>
        <div className="nav-status">
          <i className={ready ? 'online' : ''} />
          {ready ? 'LOCAL WORKSPACE' : 'CONNECTING'}
          <small>Synthetic data</small>
        </div>
      </div>
    </nav>
  );
}
