/**
 * Compact Workspace Card Component
 *
 * Small workspace cards (1/4-1/3 height) with essential information:
 * - Agent status and count
 * - Context count
 * - Workspace title
 * - Last modified time
 * - Ticket number (if available)
 */
'use client';
import { AgentStatusIndicator } from './AgentStatusIndicator';

interface Workspace {
  id: string;
  title: string;
  agentStatus: 'active' | 'idle' | 'offline';
  agentCount: number;
  contextCount: number;
  lastModified: Date;
  ticketNumber?: string;
  description?: string;
  status?: 'published' | 'publishing' | 'draft';
}

interface CompactWorkspaceCardProps {
  workspace: Workspace;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  isTouched?: boolean;
  showActions?: boolean;
}
export function CompactWorkspaceCard({ workspace, isSelected, onSelect, isTouched = false, showActions = false }: CompactWorkspaceCardProps) {

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  const isPublishing = workspace.status === 'publishing';
  
  const handleClick = () => {
    if (isPublishing) return; // Don't allow clicking while publishing
    
    if (isSelected) {
      onSelect(null); // Deselect if clicking on selected workspace
    } else {
      onSelect(workspace.id);
    }
  };
  
  return (
    <div
      onClick={handleClick}
      className={`rounded-lg border p-3 transition-all duration-200 ${
        isPublishing 
          ? 'animate-pulse cursor-not-allowed opacity-75' 
          : 'cursor-pointer hover:shadow-md'
      } ${isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''} ${
        isTouched && !isSelected ? 'touched-workspace' : ''
      }`}
      style={{
        height: 'calc(25vh - 1rem)', // 1/4 viewport height minus margin
        minHeight: '140px',
        maxHeight: '200px',
        backgroundColor: isSelected
          ? 'var(--color-primary-background, var(--color-surface-elevated))'
          : isTouched
          ? 'var(--color-surface-elevated)'
          : 'var(--color-surface-elevated)',
        borderColor: isPublishing 
          ? 'var(--color-accent)' 
          : isSelected
          ? 'var(--color-primary)'
          : isTouched
          ? 'rgba(147, 51, 234, 0.3)' // Purple tint for visited
          : 'var(--color-border)',
        borderWidth: isPublishing ? '2px' : '1px',
        color: 'var(--color-text-primary)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle overlay for touched workspaces */}
      {isTouched && !isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(147, 51, 234, 0.05) 100%)',
          }}
        />
      )}
      
      {/* Top Row: Agent Status + Context Count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <AgentStatusIndicator
            status={workspace.agentStatus}
            count={workspace.agentCount}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span>📊</span>
            <span>{workspace.contextCount}</span>
          </div>
          {isTouched && !isSelected && (
            <div
              className="text-xs px-1"
              style={{ color: 'rgba(147, 51, 234, 0.6)' }}
              title="Previously visited"
            >
              ✓
            </div>
          )}
        </div>
      </div>
      {/* Middle: Workspace Title */}
      <div className="flex-1 mb-2">
        <h3
          className="font-medium text-sm line-clamp-2 mb-1"
          style={{ color: 'var(--color-text-primary)' }}
          title={workspace.title}
        >
          {workspace.title}
        </h3>
        {isPublishing && (
          <div
            className="inline-flex items-center px-2 py-1 rounded text-xs mb-1"
            style={{
              backgroundColor: 'var(--color-accent-background, rgba(59, 130, 246, 0.1))',
              color: 'var(--color-accent, #3b82f6)',
            }}
          >
            ⏳ Publishing...
          </div>
        )}
        {workspace.ticketNumber && (
          <div
            className="inline-flex items-center px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: 'var(--color-accent-background, rgba(59, 130, 246, 0.1))',
              color: 'var(--color-accent, #3b82f6)',
            }}
          >
            🎫 #{workspace.ticketNumber}
          </div>
        )}
      </div>
      {/* Bottom: Last Modified */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {formatRelativeTime(workspace.lastModified)}
        </span>
        {/* Selection Indicator */}
        {isSelected && (
          <div
            className="text-xs font-medium"
            style={{ color: 'var(--color-primary)' }}
          >
            ✓ Active
          </div>
        )}
      </div>
      {/* Hover Description Tooltip */}
      {workspace.description && (
        <div className="hidden group-hover:block absolute z-10 bg-black text-white text-xs rounded p-2 max-w-xs">
          {workspace.description}
        </div>
      )}
    </div>
  );
}
// Add group class to card for hover effects
export function CompactWorkspaceCardWithTooltip(props: CompactWorkspaceCardProps) {
  return (
    <div className="group relative">
      <CompactWorkspaceCard {...props} />
    </div>
  );
}