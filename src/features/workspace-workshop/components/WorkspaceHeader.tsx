/**
 * Workspace Header Component
 *
 * Detailed workspace information header (10-15% height)
 * Shows title, ticket details, context items, git status, agent status
 */
'use client';
import { useState } from 'react';
import { AgentStatusIndicator } from './AgentStatusIndicator';
interface WorkspaceData {
  id: string;
  title: string;
  description?: string;
  ticketNumber?: string;
  ticketDetails?: {
    priority?: string;
    assignee?: string;
    dueDate?: string;
    status?: string;
  };
  contextItems: any[];
  lastModified: Date;
  agentStatus: 'active' | 'idle' | 'offline';
  gitBranch?: string;
  gitStatus?: {
    hasChanges: boolean;
    uncommitted: number;
  };
}
interface WorkspaceHeaderProps {
  workspace: WorkspaceData;
  onClose: () => void;
}
export function WorkspaceHeader({ workspace, onClose }: WorkspaceHeaderProps) {
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [editorLoading, setEditorLoading] = useState<string | null>(null);

  const handleOpenEditor = async (editor: 'cursor' | 'vscode') => {
    try {
      setEditorLoading(editor);
      const response = await fetch(`/api/workspaces/${workspace.id}/open-editor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ editor }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${editor === 'cursor' ? 'Cursor' : 'VS Code'} opened successfully!\n\nPath: ${result.path}`);
      } else {
        const editorName = editor === 'cursor' ? 'Cursor' : 'VS Code';
        let errorMessage = `❌ Failed to open ${editorName}:\n${result.error}`;
        
        if (result.suggestion) {
          errorMessage += `\n\n💡 Suggestion: ${result.suggestion}`;
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error opening editor:', error);
      alert(`❌ Error opening ${editor === 'cursor' ? 'Cursor' : 'VS Code'}. Check console for details.`);
    } finally {
      setEditorLoading(null);
    }
  };
  const formatLastModified = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };
  return (
    <div
      className="border-b px-6 py-4 h-full flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Top Row: Title and Actions */}
      <div className="flex items-center justify-between mb-2">
        {/* Left: Title and Basic Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <h1
            className="text-xl font-bold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {workspace.title}
          </h1>
          {workspace.ticketNumber && (
            <div className="relative">
              <button
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-accent-background, rgba(59, 130, 246, 0.1))',
                  color: 'var(--color-accent, #3b82f6)',
                }}
                onMouseEnter={() => setShowTicketDetails(true)}
                onMouseLeave={() => setShowTicketDetails(false)}
              >
                🎫 #{workspace.ticketNumber}
              </button>
              {/* Ticket Details Tooltip */}
              {showTicketDetails && workspace.ticketDetails && (
                <div
                  className="absolute top-full left-0 mt-2 p-3 rounded-lg shadow-lg border z-50 min-w-64"
                  style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <div className="text-sm font-medium mb-2">Ticket Details</div>
                  <div className="space-y-1 text-xs">
                    {workspace.ticketDetails.priority && (
                      <div>Priority: <span className="font-medium">{workspace.ticketDetails.priority}</span></div>
                    )}
                    {workspace.ticketDetails.assignee && (
                      <div>Assignee: <span className="font-medium">{workspace.ticketDetails.assignee}</span></div>
                    )}
                    {workspace.ticketDetails.status && (
                      <div>Status: <span className="font-medium">{workspace.ticketDetails.status}</span></div>
                    )}
                    {workspace.ticketDetails.dueDate && (
                      <div>Due: <span className="font-medium">{workspace.ticketDetails.dueDate}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Right: Status and Actions */}
        <div className="flex items-center gap-3">
          <AgentStatusIndicator
            status={workspace.agentStatus}
            count={1}
            size="md"
            showLabel
          />
          {workspace.gitBranch && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>🌿</span>
              <span>{workspace.gitBranch}</span>
              {workspace.gitStatus?.hasChanges && (
                <span className="text-orange-500">●</span>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              color: 'var(--color-text-secondary)',
            }}
            title="Close workspace"
          >
            ✕
          </button>
        </div>
      </div>
      {/* Bottom Row: Context and Metadata */}
      <div className="flex items-center justify-between">
        {/* Left: Context Items Preview */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              📊 Context:
            </span>
            <div className="flex items-center gap-2">
              {workspace.contextItems.map((item, index) => {
                const getIcon = () => {
                  if (item.source === 'jira' || item.type === 'jira_issue' || item.type === 'jira') return '🎫';
                  if (item.source === 'git' || item.type === 'repository' || item.type === 'git' || item.type === 'git_repository') return '📁';
                  if (item.type === 'file' || item.type === 'document') return '📄';
                  if (item.type === 'text') return '📝';
                  return '📊';
                };
                
                const handleClick = () => {
                  // If it's a file/document, open it in the editor
                  if (item.type === 'file' || item.type === 'document') {
                    const filePath = `/workspace/context/${item.id}`;
                    window.dispatchEvent(new CustomEvent('open-file', {
                      detail: { filePath }
                    }));
                  }
                };
                
                return (
                  <div
                    key={item.id || index}
                    className="relative group"
                  >
                    <button
                      onClick={handleClick}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--color-surface-elevated)',
                        color: 'var(--color-text-secondary)',
                        cursor: (item.type === 'file' || item.type === 'document') ? 'pointer' : 'default'
                      }}
                    >
                      <span>{getIcon()}</span>
                      <span className="max-w-[100px] truncate">{item.title || item.name || `Item ${index + 1}`}</span>
                    </button>
                    
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                      <div
                        className="p-2 rounded shadow-lg border text-xs max-w-xs"
                        style={{
                          backgroundColor: 'var(--color-surface-elevated)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <div className="font-medium mb-1">{item.title || item.name}</div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          Type: {item.type || 'unknown'}<br/>
                          Source: {item.source || 'library'}
                          {item.preview && (
                            <><br/><br/>{item.preview.substring(0, 100)}...</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Right: Workspace Metadata */}
        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span>Modified {formatLastModified(workspace.lastModified)}</span>
          {workspace.gitStatus?.uncommitted && workspace.gitStatus.uncommitted > 0 && (
            <span className="flex items-center gap-1">
              <span>📝</span>
              <span>{workspace.gitStatus.uncommitted} uncommitted</span>
            </span>
          )}
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleOpenEditor('cursor')}
              disabled={editorLoading === 'cursor'}
              className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
              title="Open in Cursor IDE"
            >
              <span>{editorLoading === 'cursor' ? '⏳' : '💻'}</span>
              <span>{editorLoading === 'cursor' ? 'Opening...' : 'Cursor'}</span>
            </button>
            <button
              onClick={() => handleOpenEditor('vscode')}
              disabled={editorLoading === 'vscode'}
              className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-text-inverse)',
              }}
              title="Open in VS Code"
            >
              <span>{editorLoading === 'vscode' ? '⏳' : '📝'}</span>
              <span>{editorLoading === 'vscode' ? 'Opening...' : 'Code'}</span>
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text-secondary)',
              }}
              title="Workspace settings"
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text-secondary)',
              }}
              title="Deploy workspace"
            >
              <span>🚀</span>
              <span>Deploy</span>
            </button>
          </div>
        </div>
      </div>
      {/* Optional: Description */}
      {workspace.description && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {workspace.description}
          </p>
        </div>
      )}
    </div>
  );
}