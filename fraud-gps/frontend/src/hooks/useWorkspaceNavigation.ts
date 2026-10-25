import { useEffect, useState } from 'react';

export const workspaceSections = [
  { id: 'cases', label: 'Cases', hint: 'Choose your investigation' },
  { id: 'trace', label: 'Money Trail', hint: 'Follow the movement' },
  { id: 'dna', label: 'Fraud DNA', hint: 'Connect the evidence' },
  { id: 'summary', label: 'Case Summary', hint: 'Review & report' },
] as const;
export type WorkspaceSection = (typeof workspaceSections)[number]['id'];
export function sectionFromHash(hash: string): WorkspaceSection {
  const id = hash.replace(/^#\/?/, '');
  return workspaceSections.some((section) => section.id === id)
    ? (id as WorkspaceSection)
    : 'cases';
}
export function useWorkspaceNavigation() {
  const [section, setSection] = useState(() => sectionFromHash(location.hash));
  useEffect(() => {
    const changed = () => setSection(sectionFromHash(location.hash));
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  function navigate(next: WorkspaceSection) {
    setSection(next);
    if (sectionFromHash(location.hash) !== next || !location.hash) location.hash = `/${next}`;
  }
  return { section, navigate };
}
