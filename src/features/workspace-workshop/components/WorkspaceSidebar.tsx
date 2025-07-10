/**
 * Workspace Sidebar Component
 *
 * Left sidebar containing compact workspace cards (1/4-1/3 height)
 * with essential information: agent status, context count, title
 */
'use client';
import { useState, useEffect } from 'react';
import { CompactWorkspaceCard } from './CompactWorkspaceCard';
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
interface WorkspaceSidebarProps {
  selectedWorkspace: string | null;
  onWorkspaceSelect: (id: string | null) => void;
  onToggleFileView?: () => void;
  onNewWorkspace?: () => void;
  onBackToLibrary?: () => void;
  touchedWorkspaces?: Set<string>;
}
export function WorkspaceSidebar({ selectedWorkspace, onWorkspaceSelect, onToggleFileView, onNewWorkspace, onBackToLibrary, touchedWorkspaces = new Set() }: WorkspaceSidebarProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300); // Start wider
  // Load workspaces from API
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/workspaces');
        if (response.ok) {
          const data = await response.json();
          // Transform the workspace data to include agent information
          const workspaceData = data.workspaces || [];
          const transformedWorkspaces: Workspace[] = workspaceData.map((ws: any) => ({
            id: ws.id,
            title: ws.title || ws.name || 'Untitled Workspace',
            agentStatus: determineAgentStatus(ws.agents || []),
            agentCount: (ws.agents || []).length,
            contextCount: (ws.context_items || []).length,
            lastModified: new Date(ws.updated_at || ws.created_at || Date.now()),
            ticketNumber: ws.ticket_number,
            description: ws.description,
            status: ws.status || 'published',
          }));
          setWorkspaces(transformedWorkspaces);
        } else {
          console.warn('Failed to load workspaces:', response.status);
          // Fallback to mock data for development
          setWorkspaces(getMockWorkspaces());
        }
      } catch (error) {
        console.error('Error loading workspaces:', error);
        // Fallback to mock data
        setWorkspaces(getMockWorkspaces());
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkspaces();
    
    // Listen for workspace publishing events
    const handleWorkspacePublished = (event: CustomEvent) => {
      // Refresh workspace list when a workspace is published
      loadWorkspaces();
    };
    
    const handleWorkspacePublishFailed = (event: CustomEvent) => {
      // Refresh workspace list when publishing fails to remove the temporary entry
      loadWorkspaces();
    };
    
    window.addEventListener('workspace-published', handleWorkspacePublished as EventListener);
    window.addEventListener('workspace-publish-failed', handleWorkspacePublishFailed as EventListener);
    
    return () => {
      window.removeEventListener('workspace-published', handleWorkspacePublished as EventListener);
      window.removeEventListener('workspace-publish-failed', handleWorkspacePublishFailed as EventListener);
    };
  }, []);
  const determineAgentStatus = (agents: any[]): 'active' | 'idle' | 'offline' => {
    if (!agents || agents.length === 0) return 'offline';
    const hasActive = agents.some(agent => agent.status === 'active');
    const hasIdle = agents.some(agent => agent.status === 'idle');
    if (hasActive) return 'active';
    if (hasIdle) return 'idle';
    return 'offline';
  };
  const getMockWorkspaces = (): Workspace[] => [
    {
      id: 'ws-1',
      title: 'React Dashboard',
      agentStatus: 'active',
      agentCount: 2,
      contextCount: 8,
      lastModified: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      ticketNumber: 'DASH-123',
      description: 'Building a new analytics dashboard',
    },
    {
      id: 'ws-2',
      title: 'API Optimization',
      agentStatus: 'idle',
      agentCount: 1,
      contextCount: 12,
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      ticketNumber: 'API-456',
      description: 'Performance improvements for API endpoints',
    },
    {
      id: 'ws-3',
      title: 'Documentation Update',
      agentStatus: 'offline',
      agentCount: 0,
      contextCount: 5,
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      description: 'Updating project documentation',
    },
  ];
  // Handle sidebar resizing
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(250, Math.min(500, startWidth + deltaX)); // Min 250px, max 500px
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleNewWorkspace = () => {
    onNewWorkspace?.();
  };
  
  return (
    <div className="flex">
      <div
        className="border-r flex flex-col"
        style={{
          width: `${sidebarWidth}px`,
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
      {/* Sidebar Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Workspaces
        </h2>
      </div>
      {/* Workspace Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="animate-pulse rounded-lg p-3"
                style={{
                  height: 'calc(25vh - 1rem)',
                  backgroundColor: 'var(--color-surface-elevated)',
                }}
              />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div
            className="text-center py-8 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <div className="text-3xl mb-2">📂</div>
            <p>No workspaces yet</p>
            <p>Create your first workspace to get started</p>
          </div>
        ) : (
          workspaces.map(workspace => (
            <CompactWorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isSelected={selectedWorkspace === workspace.id}
              onSelect={onWorkspaceSelect}
              isTouched={touchedWorkspaces.has(workspace.id)}
            />
          ))
        )}
      </div>
      {/* Sidebar Footer */}
      <div
        className="p-4 border-t text-xs"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <div className="flex justify-between items-center">
          <span>{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</span>
          <span>{workspaces.reduce((sum, ws) => sum + ws.agentCount, 0)} agent{workspaces.reduce((sum, ws) => sum + ws.agentCount, 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>
      </div>
      {/* Resize Handle */}
      <div
        className="w-1 hover:w-2 cursor-col-resize bg-transparent hover:bg-blue-400 transition-all opacity-0 hover:opacity-100"
        onMouseDown={handleResizeStart}
        title="Drag to resize workspace sidebar"
        style={{
          borderRight: '1px solid var(--color-border)',
        }}
      />
    </div>
  );
}