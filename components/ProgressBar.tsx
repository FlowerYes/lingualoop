export function ProgressBar({
  value,
  label,
  segments = false,
}: {
  value: number;
  label: string;
  segments?: boolean;
}) {
  return (
    <div
      className={segments ? 'level-progress segmented' : 'level-progress'}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
