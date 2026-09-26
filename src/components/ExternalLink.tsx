import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Every outbound link: new tab, no opener, no referrer — so the platform
 * doesn't learn you came from here, and this page's URL is never shared.
 * `href` must already be an allowlisted URL from lib/platforms/safeUrl.
 */
export function ExternalLink({
  href,
  children,
  className = 'btn btn-secondary',
  onOpen,
  describedBy,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onOpen?: () => void;
  describedBy?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={className}
      onClick={onOpen}
      aria-describedby={describedBy}
    >
      <span>{children}</span>
      <Icon name="external" size={16} />
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}
