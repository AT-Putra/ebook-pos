import { ReactNode, CSSProperties } from 'react';

/**
 * Shared dashboard UI primitives. EVERY admin page should compose its content
 * from these so cards are visually consistent (same width, padding, radius,
 * shadow, header typography) across all menus. See PRD §20.12.
 */

/** The max content width for a dashboard page — keeps cards a consistent size. */
export const CONTENT_MAX_WIDTH = 880;

const shell: CSSProperties = {
  background: '#fff',
  border: '1px solid #e7ebf0',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.05)',
  width: '100%',
  boxSizing: 'border-box',
  overflow: 'hidden',
};

const PAD = '1.15rem 1.35rem';

type CardProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** Rendered at the top-right of the header (e.g. an action button). */
  headerRight?: ReactNode;
  /** Drop body padding (e.g. for a full-bleed table). */
  noBodyPadding?: boolean;
  children?: ReactNode;
};

/** A consistent content card. Optional header (title + description) above the body. */
export function Card({ title, description, headerRight, noBodyPadding, children }: CardProps) {
  const hasHeader = title != null || description != null || headerRight != null;
  return (
    <section style={shell}>
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            padding: PAD,
            borderBottom: children != null ? '1px solid #f1f5f9' : 'none',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title != null && <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{title}</h2>}
            {description != null && (
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0', lineHeight: 1.4 }}>{description}</p>
            )}
          </div>
          {headerRight != null && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
        </div>
      )}
      {children != null && <div style={{ padding: noBodyPadding ? 0 : PAD }}>{children}</div>}
    </section>
  );
}

/** Vertical stack of cards with a consistent max width + gap. Wrap a page's cards in this. */
export function CardStack({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
      {children}
    </div>
  );
}

/** Standard page header (title + optional subtitle), used at the top of every admin page. */
export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>{title}</h1>
        {subtitle != null && <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '3px 0 0' }}>{subtitle}</p>}
      </div>
      {right != null && <div>{right}</div>}
    </div>
  );
}
