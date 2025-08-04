export function CheckEngineBadge({
  issueCount,
  onClick,
  className = ''
}: {
  issueCount: number;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium hover:bg-yellow-200 transition-colors ${className}`}
      title={`${issueCount} validation issue${issueCount !== 1 ? 's' : ''}`}
    >
      <span className="animate-pulse">⚠️</span>
      <span>{issueCount}</span>
    </button>
  );
}