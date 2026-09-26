import { PROVENANCE_LABEL, fieldRows } from './provenance';
import { counts, displayRetrieval, identityOf, mineCandidates, nextFixes, reviewable, usernameReuse } from './summary';
import { DIRECTORY_VERSION, GUIDES_VERSION, platformName } from '../platforms/directory';
import type { SessionState } from '../session/state';

export interface ExportOptions {
  /** Include usernames/handles and profile links. */
  includeHandles: boolean;
  /** Include the actual values public APIs returned (name, location…). Off by default. */
  includeApiValues: boolean;
  /** Include profiles marked "Not mine" / "Unsure" / not yet reviewed. */
  includeUnconfirmed: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeHandles: true,
  includeApiValues: false,
  includeUnconfirmed: false,
};

const IDENTITY_LABEL = { mine: 'Mine', 'not-mine': 'Not mine', unsure: 'Unsure', awaiting: 'Awaiting review' } as const;
const RETRIEVAL_LABEL = {
  'api-returned': 'Public profile returned by supported API',
  candidate: 'Candidate link — not checked automatically',
  'user-reviewed': 'User-reviewed',
  'not-found': 'Not found by this supported check',
  unable: 'Unable to check',
  checking: 'Check in progress',
} as const;
const PLAN_LABEL = { keep: 'Keep public', edit: 'Edit', delete: 'Review deletion' } as const;

export function buildExport(state: SessionState, options: ExportOptions, now = new Date()) {
  const mine = new Set(mineCandidates(state).map((c) => c.id));
  const profiles = reviewable(state)
    .filter((c) => options.includeUnconfirmed || mine.has(c.id))
    .map((c, i) => {
      const isMine = mine.has(c.id);
      return {
        platform: platformName(c.platform),
        ...(options.includeHandles
          ? { handle: c.handle ?? null, searchTerms: c.query ?? null, link: c.url }
          : { label: `Profile ${i + 1}` }),
        linkType: c.kind === 'search' ? 'search shortcut' : c.kind === 'api' ? 'automatic check' : 'profile link',
        retrieval: RETRIEVAL_LABEL[displayRetrieval(c, state)],
        identity: IDENTITY_LABEL[identityOf(c, state)],
        ...(isMine
          ? {
              fields: fieldRows(c, state).map((r) => ({
                field: r.field,
                evidence: PROVENANCE_LABEL[r.provenance],
                ...(options.includeApiValues && r.apiValues.length
                  ? { apiValues: r.apiValues.map((v) => `${v.label}: ${v.value}`) }
                  : {}),
              })),
              plan: state.plans[c.id] ? PLAN_LABEL[state.plans[c.id]] : 'Not chosen',
            }
          : {}),
      };
    });

  const c = counts(state);
  const fixes = nextFixes(state).map((f) => ({
    suggestion: options.includeHandles ? f.title : f.title.replace(/\s\(@[^)]+\)/, ''),
    basis: f.basis,
    guide: f.guide?.url ?? null,
    status: state.done[f.id] ? 'Done (user-reported)' : 'Not marked done',
  }));

  return {
    app: 'The Web Knows Me — thewebknows.me',
    exportedAt: now.toISOString(),
    about:
      'A private self-check. "API-confirmed" means a supported public API returned it. Everything else is your own review. Candidate links are not found accounts, and a shared username is not proof that accounts belong to the same person.',
    versions: { platformDirectory: DIRECTORY_VERSION, guides: GUIDES_VERSION },
    goal: state.input.goal,
    counts: {
      profilesYouConfirmed: c.confirmed,
      profilesAwaitingReview: c.awaiting + c.unsure,
      selectedPrivacyActions: c.selectedActions,
      automaticChecksUnableToRun: c.apiUnable,
    },
    usernameReuse: options.includeHandles ? usernameReuse(state) : usernameReuse(state).length,
    nextFixes: fixes,
    profiles,
  };
}

export function exportAsJson(state: SessionState, options: ExportOptions): string {
  return JSON.stringify(buildExport(state, options), null, 2);
}

export function exportAsText(state: SessionState, options: ExportOptions): string {
  const data = buildExport(state, options);
  const lines: string[] = [];
  lines.push('THE WEB KNOWS ME — your footprint checklist', `Exported ${new Date(data.exportedAt).toLocaleString()}`, '');
  lines.push(data.about, '');
  lines.push(
    `${data.counts.profilesYouConfirmed} profiles you confirmed · ${data.counts.profilesAwaitingReview} awaiting review · ${data.counts.selectedPrivacyActions} selected privacy actions`,
    '',
  );
  if (data.nextFixes.length) {
    lines.push('NEXT FIXES');
    for (const f of data.nextFixes) {
      lines.push(`[${f.status.startsWith('Done') ? 'x' : ' '}] ${f.suggestion}`, `    Based on: ${f.basis}`);
      if (f.guide) lines.push(`    Guide: ${f.guide}`);
    }
    lines.push('');
  }
  lines.push('PROFILES');
  if (!data.profiles.length) lines.push('(none included)');
  for (const p of data.profiles) {
    const name = 'handle' in p ? (p.handle ? `@${p.handle}` : `search: ${p.searchTerms}`) : p.label;
    lines.push(`- ${p.platform} ${name} — ${p.identity}`, `    ${p.retrieval}`);
    if ('link' in p) lines.push(`    ${p.link}`);
    if ('plan' in p) lines.push(`    Plan: ${p.plan}`);
    if ('fields' in p && p.fields) {
      for (const f of p.fields) {
        lines.push(`    · ${f.field}: ${f.evidence}${'apiValues' in f && f.apiValues ? ` (${f.apiValues.join('; ')})` : ''}`);
      }
    }
  }
  lines.push('', 'Progress marked "done" is user-reported. The Web Knows Me does not change or delete anything on other sites.');
  return lines.join('\n');
}
