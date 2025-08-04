/**
 * Workspace Selection View
 *
 * Displayed when no workspace is selected - encourages workspace selection
 * Lightweight component with quick actions and recent workspaces
 */
'use client';
import { useState, useEffect } from 'react';
interface WorkspaceSelectionViewProps {
  onCreateWorkspace?: () => void;
}
export function WorkspaceSelectionView({ onCreateWorkspace }: WorkspaceSelectionViewProps) {
  const [recentWorkspaces, setRecentWorkspaces] = useState<any[]>([]);
  useEffect(() => {
    // Load recent workspaces from localStorage or API
    const loadRecentWorkspaces = () => {
      try {
        const recent = localStorage.getItem('recentWorkspaces');
        if (recent) {
          setRecentWorkspaces(JSON.parse(recent).slice(0, 3)); // Latest 3
        }
      } catch (error) {
        console.warn('Could not load recent workspaces:', error);
      }
    };
    loadRecentWorkspaces();
  }, []);
  const handleCreateWorkspace = () => {
    onCreateWorkspace?.();
  };
  const handleImportLibrary = () => {
    onCreateWorkspace?.();
  };
  const handleBrowseTemplates = () => {
    console.log('Browse templates');
  };
  return (
    <div
      className="flex items-center justify-center h-full p-8"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="text-center max-w-md">
        {/* Welcome Icon */}
        <div className="text-6xl mb-6">🏗️</div>
        {/* Title */}
        <h2
          className="text-2xl font-bold mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Welcome to Workspace Workshop
        </h2>
        {/* Description */}
        <p
          className="text-base mb-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Select a workspace from the sidebar to start coding, or create a new workspace to begin your project.
        </p>
        {/* Quick Actions */}
        <div className="space-y-3 mb-8">
          <button
            onClick={handleCreateWorkspace}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border-2 border-dashed transition-colors text-base font-medium"
            style={{
              borderColor: 'var(--color-primary)',
              color: 'var(--color-primary)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <span>➕</span>
            <span>Create New Workspace</span>
          </button>
          <button
            onClick={handleImportLibrary}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-colors text-base"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <span>📚</span>
            <span>Import from Library</span>
          </button>
          <button
            onClick={handleBrowseTemplates}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg border transition-colors text-base"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <span>📋</span>
            <span>Browse Templates</span>
          </button>
        </div>
        {/* Recent Workspaces */}
        {recentWorkspaces.length > 0 && (
          <div>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Recent Workspaces
            </h3>
            <div className="space-y-2">
              {recentWorkspaces.map((workspace, index) => (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors text-left"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                  onClick={() => {
                    console.log('Select workspace:', workspace.id);
                  }}
                >
                  <span>📂</span>
                  <div className="flex-1">
                    <div
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {workspace.title}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Last opened {workspace.lastOpened}
                    </div>
                  </div>
                  <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Tips */}
        <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            💡 <strong>Tip:</strong> Workspaces integrate with your file system, agents, and context -
            everything you need for efficient development.
          </p>
        </div>
      </div>
    </div>
  );
}