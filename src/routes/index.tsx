import { createFileRoute } from '@tanstack/react-router';
import { Panel } from '@/shared/ui/Panel/Panel';
import { Pill } from '@/shared/ui/Pill/Pill';
import { Badge } from '@/shared/ui/Badge/Badge';
import { StatCard } from '@/shared/ui/StatCard/StatCard';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { SectionLabel } from '@/shared/ui/SectionLabel/SectionLabel';
import { BarMeter } from '@/shared/ui/BarMeter/BarMeter';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';

// Temporary smoke page for Phase 1 — replaced by the real home page in Phase 4.
function Smoke() {
  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: 'var(--gutter)', display: 'grid', gap: 22 }}>
      <PageTitle suffix="2025" kicker="shared/ui primitives smoke test">
        M$G League
      </PageTitle>
      <SectionLabel>Section heading</SectionLabel>
      <Panel label="Standings" action={<span>Full table →</span>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge tone="red">Champion</Badge>
            <Badge tone="win">Playoffs</Badge>
            <Badge tone="shame">Sacko</Badge>
            <Badge>Neutral</Badge>
          </div>
          <BarMeter ratio={0.72} />
          <span className="uMono">1,847.62 PF</span>
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        <StatCard label="Points For" value="1,847.62" sub="league high" />
        <StatCard label="Record" value="11–3" sub="best in league" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Pill active>2025</Pill>
        <Pill>2024</Pill>
        <Pill>2023</Pill>
      </div>
      <EmptyState title="Offseason">Rosters empty, egos full.</EmptyState>
      <LoadingQuip />
      <ErrorPanel error={new Error('Sleeper said no (503) on /league/…')} onRetry={() => {}} />
    </div>
  );
}

export const Route = createFileRoute('/')({ component: Smoke });
