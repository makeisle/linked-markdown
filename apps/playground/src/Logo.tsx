/**
 * The Linked Markdown mark — a Sandevaux-brand logo (primary teal #227995 +
 * accent tan #d1a987, the same two brand colours as the design system).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="Linked Markdown" role="img">
      <svg viewBox="88 40 640 552" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
        <g fill="#227995">
          <rect x="286" y="70" width="46" height="350" />
          <rect x="146" y="136" width="140" height="46" />
          <rect x="240" y="136" width="46" height="130" />
          <rect x="176" y="220" width="110" height="46" />
          <rect x="176" y="220" width="46" height="126" />
          <rect x="176" y="300" width="110" height="46" />
          <circle cx="309" cy="486" r="78" />
          <rect x="548" y="70" width="46" height="276" />
          <rect x="594" y="234" width="76" height="46" />
          <rect x="404" y="130" width="150" height="150" />
          <rect x="404" y="300" width="144" height="46" />
          <rect x="502" y="300" width="46" height="140" />
          <rect x="404" y="394" width="144" height="46" />
          <rect x="404" y="394" width="46" height="166" />
          <rect x="404" y="514" width="144" height="46" />
          <rect x="594" y="300" width="76" height="46" />
          <rect x="624" y="300" width="46" height="260" />
        </g>
        <circle cx="309" cy="486" r="32" fill="#d1a987" />
        <rect x="450" y="176" width="58" height="58" fill="#d1a987" />
      </svg>
    </span>
  );
}
