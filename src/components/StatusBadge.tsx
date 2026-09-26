import { Icon, type IconName } from './Icon';
import type { DisplayRetrieval } from '../lib/report/summary';
import type { Provenance } from '../lib/report/provenance';
import { PROVENANCE_LABEL } from '../lib/report/provenance';
import type { IdentityStatus } from '../lib/types';

type Tone = 'api' | 'candidate' | 'neutral' | 'waiting' | 'mine' | 'unsure' | 'user';

const RETRIEVAL: Record<DisplayRetrieval | 'search', { icon: IconName; label: string; tone: Tone }> = {
  'api-returned': { icon: 'check-circle', label: 'API-confirmed', tone: 'api' },
  candidate: { icon: 'external', label: 'Open to check', tone: 'candidate' },
  search: { icon: 'search', label: 'Search shortcut', tone: 'candidate' },
  'user-reviewed': { icon: 'eye', label: 'You reviewed this', tone: 'user' },
  'not-found': { icon: 'dash-circle', label: 'Not found by API', tone: 'neutral' },
  unable: { icon: 'pause', label: 'Unable to check right now', tone: 'waiting' },
  checking: { icon: 'spinner', label: 'Checking…', tone: 'neutral' },
};

const IDENTITY: Record<IdentityStatus, { icon: IconName; label: string; tone: Tone }> = {
  mine: { icon: 'check', label: 'Mine', tone: 'mine' },
  'not-mine': { icon: 'x', label: 'Not mine', tone: 'neutral' },
  unsure: { icon: 'question', label: 'Unsure', tone: 'unsure' },
  awaiting: { icon: 'dash-circle', label: 'Awaiting review', tone: 'neutral' },
};

const PROVENANCE_STYLE: Record<Provenance, { icon: IconName; tone: Tone }> = {
  api: { icon: 'check-circle', tone: 'api' },
  'api-empty': { icon: 'dash-circle', tone: 'neutral' },
  'user-yes': { icon: 'user', tone: 'user' },
  'user-no': { icon: 'user', tone: 'neutral' },
  'not-checked': { icon: 'dash-circle', tone: 'neutral' },
};

function Badge({ icon, label, tone, small }: { icon: IconName; label: string; tone: Tone; small?: boolean }) {
  return (
    <span className={`badge badge-${tone}${small ? ' badge-sm' : ''}`}>
      <Icon name={icon} size={small ? 14 : 16} />
      <span>{label}</span>
    </span>
  );
}

export function RetrievalBadge({ status }: { status: DisplayRetrieval | 'search' }) {
  return <Badge {...RETRIEVAL[status]} />;
}

export function IdentityBadge({ status }: { status: IdentityStatus }) {
  return <Badge {...IDENTITY[status]} small />;
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return <Badge {...PROVENANCE_STYLE[provenance]} label={PROVENANCE_LABEL[provenance]} small />;
}
