import { ExternalLink } from './ExternalLink';
import { Icon, type IconName } from './Icon';
import { AutofillDemo } from './AutofillDemo';
import { NetworkLeak } from './NetworkLeak';
import { PhotoCheck } from './PhotoCheck';
import { SocialLoginNote } from './SocialLoginNote';
import { useDevice } from '../session/DeviceContext';
import { ACCURACY_LABEL, CANT_SEE, GROUPS, LEARN, type GroupId, type ReportItem } from '../lib/device/report';
import { resourceUrl } from '../lib/platforms/safeUrl';

const GROUP_ICON: Record<GroupId, IconName> = {
  network: 'globe',
  browser: 'monitor',
  hardware: 'chip',
  connection: 'wifi',
  privacy: 'sliders',
  fingerprint: 'fingerprint',
};

function Row({ item }: { item: ReportItem }) {
  const learn = LEARN[item.id];
  return (
    <details className={`report-row acc-${item.accuracy}`}>
      <summary>
        <span className="report-label">{item.label}</span>
        <span className="report-value">{item.value}</span>
        <span className="report-acc">{ACCURACY_LABEL[item.accuracy]}</span>
        <Icon name="chevron" size={14} className="chev" />
      </summary>
      {learn && (
        <dl className="report-learn">
          <dt>What it is</dt>
          <dd>{learn.what}</dd>
          <dt>Why it matters</dt>
          <dd>{learn.why}</dd>
          <dt>How to limit it</dt>
          <dd>{learn.limit}</dd>
        </dl>
      )}
    </details>
  );
}

export function DeviceReport() {
  const { items, whoStatus, extrasReady } = useDevice();
  const eff = resourceUrl('https://coveryourtracks.eff.org/');

  return (
    <div id="device-report" className="device-report">
      <div className="report-grid">
        {GROUPS.map((g) => {
          const rows = items.filter((i) => i.group === g.id);
          if (g.id === 'network' && rows.length === 0) {
            return (
              <section key={g.id} className="report-group">
                <h2 className="report-title">
                  <Icon name={GROUP_ICON[g.id]} size={18} /> {g.title}
                </h2>
                <p className="report-blurb">
                  {whoStatus === 'loading' ? 'Looking up your connection…' : 'We couldn’t look up your connection right now. Sites you visit still can.'}
                </p>
              </section>
            );
          }
          if (rows.length === 0) {
            return g.id === 'fingerprint' && !extrasReady ? (
              <section key={g.id} className="report-group">
                <h2 className="report-title">
                  <Icon name={GROUP_ICON[g.id]} size={18} /> {g.title}
                </h2>
                <p className="report-blurb">Calculating…</p>
              </section>
            ) : null;
          }
          return (
            <section key={g.id} className={`report-group group-${g.id}`}>
              <h2 className="report-title">
                <Icon name={GROUP_ICON[g.id]} size={18} /> {g.title}
              </h2>
              <p className="report-blurb">{g.blurb}</p>
              <div className="report-rows">
                {rows.map((r) => (
                  <Row key={r.id} item={r} />
                ))}
              </div>
              {g.id === 'fingerprint' && eff && (
                <ExternalLink href={eff} className="text-link">
                  How unique is it? Test at EFF’s Cover Your Tracks
                </ExternalLink>
              )}
            </section>
          );
        })}
      </div>

      <section className="report-group cant-see">
        <h2 className="report-title">
          <Icon name="shield" size={18} /> What sites can’t see
        </h2>
        <ul>
          {CANT_SEE.map((c) => (
            <li key={c.title}>
              <strong>{c.title}.</strong> {c.detail}
            </li>
          ))}
        </ul>
      </section>

      <PhotoCheck />

      <div className="report-demos">
        <p className="demos-intro">
          <Icon name="info" size={15} /> Live demonstrations of what a page can do without asking. Everything below runs on your
          device and is shown only to you.
        </p>
        <div className="report-grid">
          <NetworkLeak />
          <AutofillDemo />
          <SocialLoginNote />
        </div>
      </div>
    </div>
  );
}
