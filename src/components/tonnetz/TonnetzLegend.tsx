import {
  MOVES,
  MOVE_NAMES,
  MOVE_STEPS,
  latticeToXY,
  movePosPath,
  triangleCorners,
  type Move,
  type TriPos,
} from '@/lib/theory/tonnetz';
import styles from './TonnetzLegend.module.scss';

/**
 * The Tonnetz legend, after the Wikipedia figure: a key of the two triangle
 * kinds with their edges named (top right), and the six moves drawn as the
 * triangles they connect (bottom right). Move diagrams come from the theory
 * core's own paths from C major, so they always match the lattice.
 */

const S3 = Math.sqrt(3) / 2;

/** Text along a triangle edge, pushed outward from the centroid `c`, kept upright. */
function EdgeLabel({ a, b, c, text }: { a: [number, number]; b: [number, number]; c: [number, number]; text: string }) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const dx = mx - c[0];
  const dy = my - c[1];
  const d = Math.hypot(dx, dy) || 1;
  const x = mx + (dx / d) * 6;
  const y = my + (dy / d) * 6;
  return (
    <text x={x} y={y} transform={`rotate(${ang} ${x} ${y})`} className={styles.edge}>
      {text}
    </text>
  );
}

/** Key: minor △ and major ▽, each edge named by its interval. */
export function LegendKey({ className }: { className?: string }) {
  const e = 58;
  const h = e * S3;
  // minor △: base A–E (fifth), left A–C (minor third), right C–E (major third)
  const m = { l: [6, h + 8] as [number, number], r: [6 + e, h + 8] as [number, number], t: [6 + e / 2, 8] as [number, number] };
  // major ▽: top C–G (fifth), left C–E (major third), right E–G (minor third)
  const x0 = 6 + e + 18;
  const M = { l: [x0, 8] as [number, number], r: [x0 + e, 8] as [number, number], b: [x0 + e / 2, h + 8] as [number, number] };
  const mc: [number, number] = [(m.l[0] + m.r[0] + m.t[0]) / 3, (m.l[1] + m.r[1] + m.t[1]) / 3];
  const Mc: [number, number] = [(M.l[0] + M.r[0] + M.b[0]) / 3, (M.l[1] + M.r[1] + M.b[1]) / 3];
  const pts = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ');
  return (
    <svg className={`${styles.key} ${className ?? ''}`} viewBox={`-8 -6 ${x0 + e + 16} ${h + 28}`} aria-label="Legend: minor and major triangles">
      <polygon points={pts([m.l, m.r, m.t])} className={styles.minor} />
      <text x={m.t[0]} y={8 + h * 0.7} className={styles.kind}>
        minor
      </text>
      <EdgeLabel a={m.l} b={m.r} c={mc} text="fifth" />
      <EdgeLabel a={m.l} b={m.t} c={mc} text="minor third" />
      <EdgeLabel a={m.t} b={m.r} c={mc} text="major third" />

      <polygon points={pts([M.l, M.r, M.b])} className={styles.major} />
      <text x={M.b[0]} y={8 + h * 0.4} className={styles.kind}>
        major
      </text>
      <EdgeLabel a={M.l} b={M.r} c={Mc} text="fifth" />
      <EdgeLabel a={M.l} b={M.b} c={Mc} text="major third" />
      <EdgeLabel a={M.b} b={M.r} c={Mc} text="minor third" />
    </svg>
  );
}

const START: TriPos = { i: 0, j: 0, major: true };
const UNIT = 13; // px per lattice step in the move diagrams

function MoveDiagram({ move }: { move: Move }) {
  const path = movePosPath(START, move);
  const polys = path.map((p) =>
    triangleCorners(p).map(([i, j]) => {
      const w = latticeToXY(i, j);
      return [w.x * UNIT, -w.y * UNIT] as [number, number];
    }),
  );
  const all = polys.flat();
  const minX = Math.min(...all.map((q) => q[0]));
  const maxX = Math.max(...all.map((q) => q[0]));
  const minY = Math.min(...all.map((q) => q[1]));
  const maxY = Math.max(...all.map((q) => q[1]));
  const pad = 2;
  return (
    <svg
      className={styles.diagram}
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      width={maxX - minX + pad * 2}
      height={maxY - minY + pad * 2}
      aria-hidden
    >
      {polys.map((poly, k) => {
        const role = k === 0 ? styles.major : k === polys.length - 1 ? styles.minor : styles.passed;
        return <polygon key={k} points={poly.map((q) => q.join(',')).join(' ')} className={role} />;
      })}
    </svg>
  );
}

/** Moves: each drawn from a major (start) to the minor it reaches. */
export function LegendMoves({ className }: { className?: string }) {
  return (
    <div className={`${styles.moves} ${className ?? ''}`} aria-label="Legend: moves">
      {MOVES.map((m) => (
        <div key={m} className={styles.cell} title={`${m} – ${MOVE_NAMES[m]}`}>
          <div className={styles.art}>
            <MoveDiagram move={m} />
          </div>
          <div className={styles.caption}>
            <span className={styles.letter}>{m}</span>
            {MOVE_STEPS[m].length > 1 && <span className={styles.steps}>{MOVE_STEPS[m].join('')}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
