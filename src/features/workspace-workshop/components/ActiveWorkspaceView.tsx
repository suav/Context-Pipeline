/**
 * Active Workspace View
 *
 * The main workspace interface when a workspace is selected:
 * - File search panel (280px)
 * - Workspace header (10-15% height)
 * - Monaco editor area (35-45% height)
 * - Terminal area (33-50% height)
 */
'use client';
import { useState, useEffect, Suspense, lazy } from 'react';
import { FileSearchPanel } from './FileSearchPanel';
import { WorkspaceHeader } from './WorkspaceHeader';
import { FileTabs } from './FileTabs';
// Lazy load heavy components
const LazyMonacoEditorArea = lazy(() => import('./MonacoEditorArea').then(m => ({ default: m.MonacoEditorArea })));
const LazyTerminalArea = lazy(() => import('./TerminalArea').then(m => ({ default: m.TerminalArea })));
const LazyAgentManagementModal = lazy(() => import('./AgentManagementModal').then(m => ({ default: m.AgentManagementModal })));
interface ActiveWorkspaceViewProps {
  workspaceId: string;
  onClose: () => void;
  showFileExplorer?: boolean;
  onToggleWorkspaceView?: () => void;
}
interface WorkspaceData {
  id: string;
  title: string;
  description?: string;
  ticketNumber?: string;
  ticketDetails?: any;
  contextItems: any[];
  lastModified: Date;
  agentStatus: 'active' | 'idle' | 'offline';
  gitBranch?: string;
  gitStatus?: any;
}
export function ActiveWorkspaceView({
  workspaceId,
  onClose,
  showFileExplorer = false,
  onToggleWorkspaceView
}: ActiveWorkspaceViewProps) {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editorHeight, setEditorHeight] = useState(50); // Percentage of content area
  const [headerVisible, setHeaderVisible] = useState(false);
  const [primaryPanel, setPrimaryPanel] = useState<'editor' | 'terminal'>('editor');
  const [hideTerminal, setHideTerminal] = useState(false);
  const [hideEditor, setHideEditor] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [isAutoSaving, setIsAutoSaving] = useState<Record<string, boolean>>({});
  // Agents data from workspace configuration
  const [agents, setAgents] = useState<any[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  // Helper function to get color for agent role
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      developer: '#3b82f6',
      reviewer: '#10b981',
      tester: '#f59e0b',
      planner: '#8b5cf6',
    };
    return colors[role] || '#6b7280';
  };
  // Load workspace data
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workspaces/${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Extract title from workspace name or context items
          let title = data.name || 'Untitled Workspace';
          
          // Try to get ticket info from context items
          let ticketNumber = null;
          let ticketDetails = null;
          
          const jiraItem = data.context_items?.find((item: any) => 
            item.source === 'jira' || item.type === 'jira_issue'
          );
          
          if (jiraItem) {
            ticketNumber = jiraItem.metadata?.key || jiraItem.id;
            ticketDetails = {
              priority: jiraItem.metadata?.priority || 'Medium',
              assignee: jiraItem.metadata?.assignee || 'Unassigned',
              status: jiraItem.metadata?.status || 'In Progress',
              dueDate: jiraItem.metadata?.duedate
            };
          }
          
          setWorkspace({
            id: data.id,
            title: title,
            description: data.description,
            ticketNumber: ticketNumber,
            ticketDetails: ticketDetails,
            contextItems: data.context_items || [],
            lastModified: new Date(data.published_at || data.created_at || Date.now()),
            agentStatus: 'offline',
            gitBranch: data.git_branch || 'main',
            gitStatus: { hasChanges: false, uncommitted: 0 },
          });

          // Load agents from workspace configuration
          if (data.agent_configs && data.agent_configs.length > 0) {
            const workspaceAgents = data.agent_configs.map((config: any) => ({
              id: config.id,
              name: config.name,
              color: getRoleColor(config.role),
              status: 'offline', // Start as offline until launched
              role: config.role,
              permissions: config.permissions,
              commands: config.commands,
              model: config.model,
              priority: config.priority,
            }));
            setAgents(workspaceAgents);
            // Auto-select the first agent
            if (workspaceAgents.length > 0) {
              setActiveAgent(workspaceAgents[0].id);
            }
          } else {
            // Fall back to default agents if no configuration exists
            const defaultAgents = [
              { id: 'agent-1', name: 'Dev Assistant', color: '#3b82f6', status: 'offline', role: 'developer' },
              { id: 'agent-2', name: 'Code Reviewer', color: '#10b981', status: 'offline', role: 'reviewer' },
            ];
            setAgents(defaultAgents);
            setActiveAgent('agent-1');
          }
        } else {
          console.error('Failed to load workspace');
          setWorkspace(null);
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
        setWorkspace(null);
      } finally {
        setLoading(false);
      }
    };
    loadWorkspace();
  }, [workspaceId]);
  
  // Handle workspace close - go back to library
  const handleWorkspaceClose = () => {
    // Dispatch event to mark workspace as touched
    window.dispatchEvent(new CustomEvent('workspace-touched', {
      detail: { workspaceId }
    }));
    // Dispatch event to show library view
    window.dispatchEvent(new CustomEvent('show-library-view'));
    onClose();
  };
  
  const handleFileOpen = (filePath: string) => {
    if (!openFiles.includes(filePath)) {
      setOpenFiles(prev => [...prev, filePath]);
    }
    setActiveFile(filePath);
    // Auto-focus editor when opening a file - show full height
    setHideEditor(false);
    setHideTerminal(true);
    setPrimaryPanel('editor');
  };
  
  // Listen for file open events
  useEffect(() => {
    const handleOpenFile = (event: CustomEvent) => {
      const { filePath } = event.detail;
      if (filePath) {
        handleFileOpen(filePath);
      }
    };
    
    window.addEventListener('open-file', handleOpenFile as EventListener);
    return () => {
      window.removeEventListener('open-file', handleOpenFile as EventListener);
    };
  }, [handleFileOpen]);
  
  const handleAgentSelect = (agentId: string) => {
    setActiveAgent(agentId);
    // Auto-focus terminal when selecting an agent - show full height
    setHideTerminal(false);
    setHideEditor(true);
    setPrimaryPanel('terminal');
  };
  const handleFileClose = (filePath: string) => {
    const newOpenFiles = openFiles.filter(f => f !== filePath);
    setOpenFiles(newOpenFiles);
    if (activeFile === filePath) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading workspace...</p>
        </div>
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p style={{ color: 'var(--color-text-primary)' }}>Workspace not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            Back to Selection
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full overflow-hidden">
      {/* Conditional File Explorer */}
      {showFileExplorer && (
        <FileSearchPanel
          workspaceId={workspaceId}
          onFileSelect={handleFileOpen}
          onToggleWorkspaceView={onToggleWorkspaceView}
        />
      )}
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col workspace-content overflow-hidden">
        {/* Header Section - Always at top */}
        <div>
          {/* Hamburger Menu / Header Toggle */}
          <div
            className="flex items-center px-3 py-1 border-b"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <button
              onClick={() => setHeaderVisible(!headerVisible)}
              className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-opacity-10"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              title={headerVisible ? 'Hide workspace details' : 'Show workspace details'}
            >
              <span className="text-lg">{headerVisible ? '▼' : '▶'}</span>
              <span>{workspace.title}</span>
              {workspace.ticketNumber && (
                <span className="text-xs px-2 py-0.5 rounded" style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)'
                }}>
                  {workspace.ticketNumber}
                </span>
              )}
            </button>
          </div>
          
          {/* Collapsible Workspace Header */}
          {headerVisible && (
            <div
              className="border-b"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              <WorkspaceHeader
                workspace={workspace}
                onClose={handleWorkspaceClose}
              />
            </div>
          )}
        </div>
        {/* File Tabs - Always Visible */}
        <FileTabs
          openFiles={openFiles}
          activeFile={activeFile}
          onFileSelect={handleFileOpen}
          onFileClose={handleFileClose}
          isDirty={isDirty}
          isAutoSaving={isAutoSaving}
          hideEditor={hideEditor}
          hideTerminal={hideTerminal}
          onToggleTerminal={() => {
            setHideTerminal(false);
            setHideEditor(true);
            setPrimaryPanel('terminal');
          }}
          onToggleEditor={() => {
            setHideEditor(false);
            setHideTerminal(true);
            setPrimaryPanel('editor');
          }}
          onShowBoth={() => {
            setHideEditor(false);
            setHideTerminal(false);
            setEditorHeight(50);
            setPrimaryPanel('editor');
          }}
        />

        {/* Resizable Editor/Terminal Area */}
        <div className="flex-1 flex flex-col overflow-hidden w-full" style={{ minHeight: '400px' }}>
          {/* Monaco Editor Area */}
          {!hideEditor && (
            <div
              className="w-full"
              style={{
                height: hideTerminal ? '100%' : `${editorHeight}%`,
                minHeight: '150px',
                opacity: primaryPanel === 'editor' ? 1 : 0.8,
              }}
            >
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-pulse h-4 w-32 bg-gray-200 rounded mb-2 mx-auto" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
                  <div className="animate-pulse h-4 w-24 bg-gray-200 rounded mx-auto" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
                </div>
              </div>
            }>
              <LazyMonacoEditorArea
                openFiles={openFiles}
                activeFile={activeFile}
                onFileSelect={setActiveFile}
                onFileClose={handleFileClose}
                workspaceId={workspaceId}
                hideTerminal={hideTerminal}
                hideEditor={hideEditor}
                onToggleTerminal={() => {
                  setHideTerminal(false);
                  setHideEditor(true);
                  setPrimaryPanel('terminal');
                }}
                onToggleEditor={() => {
                  setHideEditor(false);
                  setHideTerminal(true);
                  setPrimaryPanel('editor');
                }}
                onShowBoth={() => {
                  setHideEditor(false);
                  setHideTerminal(false);
                  setEditorHeight(50);
                  setPrimaryPanel('editor');
                }}
              />
            </Suspense>
            </div>
          )}
          {/* Fixed Splitter - Show divider when both panels are visible */}
          {!hideEditor && !hideTerminal && (
            <div
              className="flex items-center justify-center border-t border-b"
              style={{
                height: '4px',
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            />
          )}
          {/* Terminal Area */}
          {!hideTerminal && (
            <div
              style={{
                height: hideEditor ? '100%' : `${100 - editorHeight}%`,
                minHeight: '150px',
                opacity: primaryPanel === 'terminal' ? 1 : 0.8,
              }}
              className="flex flex-col w-full"
            >
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-pulse h-4 w-48 bg-gray-200 rounded mb-2 mx-auto" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
                  <div className="animate-pulse h-4 w-32 bg-gray-200 rounded mx-auto" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
                </div>
              </div>
            }>
              <LazyTerminalArea
                workspaceId={workspaceId}
                agents={agents}
                activeAgent={activeAgent}
                onAgentSelect={handleAgentSelect}
              />
            </Suspense>
            </div>
          )}
          {/* Agent Tabs (Always Visible) */}
          <div
            className="flex items-center border-t bg-opacity-95"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface-elevated)',
              height: '40px',
            }}
          >
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => handleAgentSelect(agent.id)}
                className={`flex items-center gap-2 px-3 py-2 border-r text-sm transition-all ${
                  activeAgent === agent.id ? 'font-medium' : ''
                }`}
                style={{
                  backgroundColor: activeAgent === agent.id ? agent.color : 'transparent',
                  color: activeAgent === agent.id ? '#ffffff' : 'var(--color-text-primary)',
                  borderColor: 'var(--color-border)',
                  opacity: primaryPanel === 'terminal' ? 1 : 0.7,
                }}
              >
                <span>🤖</span>
                <span className="whitespace-nowrap">{agent.name}</span>
                <div
                  className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-green-400' :
                    agent.status === 'idle' ? 'bg-yellow-400' : 'bg-gray-400'
                  }`}
                />
              </button>
            ))}
            <button
              onClick={() => setShowAgentModal(true)}
              className="flex items-center gap-1 px-3 py-2 text-sm transition-colors hover:bg-opacity-10"
              style={{
                color: 'var(--color-text-muted)',
                backgroundColor: 'transparent',
              }}
              title="Create new agent"
            >
              <span className="text-lg">+</span>
              <span>New Agent</span>
            </button>
            <div className="border-l mx-2" style={{ borderColor: 'var(--color-border)' }} />
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>💻</span>
              <span>System</span>
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>🔄</span>
              <span>Git</span>
            </button>
          </div>
        </div>
      </div>
      {/* Agent Management Modal */}
      {showAgentModal && (
        <Suspense fallback={null}>
          <LazyAgentManagementModal
            isOpen={showAgentModal}
            onClose={() => setShowAgentModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}