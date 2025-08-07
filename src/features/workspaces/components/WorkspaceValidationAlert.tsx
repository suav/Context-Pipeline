export function WorkspaceValidationAlert({
  issues,
  onDismiss
}: {
  issues: string[];
  onDismiss?: () => void;
}) {
  if (issues.length === 0) return null;
  
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-yellow-600 text-lg">⚠️</span>
        <div className="flex-1">
          <h3 className="text-yellow-800 font-medium mb-2">
            Workspace Validation Issues
          </h3>
          <ul className="text-yellow-700 text-sm space-y-1">
            {issues.map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-yellow-600 hover:text-yellow-800"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

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