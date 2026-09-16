import { useEffect, useMemo } from "react";

const BALLOON_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"];

// Shared balloon-pop celebration burst shown over the MCQ card on a correct
// answer. Used by both the standalone Quick Practice page
// (QuickPracticePlay.tsx) and the readymade-exam Quick Practice Mode inside
// TakeExam.tsx, so both experiences match.
export const CorrectBalloonBurst = ({ burstKey, onDone }: { burstKey: number; onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [burstKey, onDone]);

  const balloons = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        delay: Math.random() * 0.15,
        color: BALLOON_COLORS[i % BALLOON_COLORS.length],
        size: 20 + Math.random() * 14,
      })),
    [burstKey]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-20">
      {balloons.map((b) => (
        <span
          key={b.id}
          className="absolute rounded-full balloon-pop"
          style={{
            left: `${b.left}%`,
            bottom: "0px",
            width: b.size,
            height: b.size * 1.15,
            background: b.color,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default CorrectBalloonBurst;
