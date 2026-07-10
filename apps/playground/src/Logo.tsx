/**
 * The Rimalk (링맑 · Linked Mark Down) COMPACT MARK — a teal ring (ㅇ) beside a
 * teal square (ㅁ), each with a sand counter. Fills are driven by the design
 * tokens so the mark stays on-theme. Pairs with the wordmark to form the lockup.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="Linked Mark Down" role="img">
      <svg viewBox="0 0 296 140" xmlns="http://www.w3.org/2000/svg">
        <circle className="mk-accent" cx="78" cy="70" r="62" />
        <rect className="mk-accent" x="156" y="8" width="124" height="124" />
        <circle className="mk-sand" cx="78" cy="70" r="28" />
        <rect className="mk-sand" x="190" y="42" width="56" height="56" />
      </svg>
    </span>
  );
}
