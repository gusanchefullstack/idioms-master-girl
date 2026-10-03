import { align } from "@/lib/scoring/align";

/** Shows the corrected sentence with changed words highlighted (simple word-level diff). */
export default function WordDiff({ original, corrected }: { original: string; corrected: string }) {
  const a = original.split(/\s+/).filter(Boolean);
  const b = corrected.split(/\s+/).filter(Boolean);
  const { ops } = align(
    a.map((w) => w.toLowerCase()),
    b.map((w) => w.toLowerCase()),
  );
  return (
    <span>
      {ops.map((op, i) => {
        if (op.op === "ok") return <span key={i}>{b[op.heardIndex]} </span>;
        if (op.op === "missing")
          return (
            <span key={i}>
              <del className="change">{a[op.targetIndex]}</del>{" "}
            </span>
          );
        return (
          <span key={i}>
            <mark className="change">{b[op.heardIndex]}</mark>{" "}
          </span>
        );
      })}
    </span>
  );
}
