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
  
  // Mock agents data
  const [agents] = useState([
    { id: 'agent-1', name: 'Dev Assistant', color: '#3b82f6', status: 'active' },
    { id: 'agent-2', name: 'Code Reviewer', color: '#10b981', status: 'idle' },
  ]);
  const [activeAgent, setActiveAgent] = useState('agent-1');

  // Load workspace data
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workspaces/${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkspace({
            id: data.id,
            title: data.title || 'Untitled Workspace',
            description: data.description,
            ticketNumber: data.ticket_number,
            ticketDetails: data.ticket_details,
            contextItems: data.context_items || [],
            lastModified: new Date(data.updated_at || data.created_at || Date.now()),
            agentStatus: data.agent_status || 'offline',
            gitBranch: data.git_branch,
            gitStatus: data.git_status,
          });
        } else {
          // Fallback to mock data
          setWorkspace(getMockWorkspace(workspaceId));
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
        setWorkspace(getMockWorkspace(workspaceId));
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [workspaceId]);

  const getMockWorkspace = (id: string): WorkspaceData => ({
    id,
    title: 'React Dashboard Project',
    description: 'Building a modern analytics dashboard with React and TypeScript',
    ticketNumber: 'DASH-123',
    ticketDetails: {
      priority: 'High',
      assignee: 'Development Team',
      dueDate: '2024-01-15',
    },
    contextItems: [
      { id: '1', name: 'API Endpoints', type: 'documentation' },
      { id: '2', name: 'Design System', type: 'figma' },
      { id: '3', name: 'User Stories', type: 'jira' },
    ],
    lastModified: new Date(),
    agentStatus: 'active',
    gitBranch: 'feature/dashboard-redesign',
    gitStatus: { hasChanges: true, uncommitted: 3 },
  });

  const handleFileOpen = (filePath: string) => {
    if (!openFiles.includes(filePath)) {
      setOpenFiles(prev => [...prev, filePath]);
    }
    setActiveFile(filePath);
    // Auto-focus editor when opening a file
    if (primaryPanel === 'terminal') {
      setPrimaryPanel('editor');
      setEditorHeight(70); // Give editor more space when switching to file focus
    }
  };

  const handleAgentSelect = (agentId: string) => {
    setActiveAgent(agentId);
    // Auto-focus terminal when selecting an agent
    setPrimaryPanel('terminal');
    setHideTerminal(false);
    if (hideEditor || editorHeight > 70) {
      setEditorHeight(0); // Give terminal full space when switching to agent focus
    } else {
      setEditorHeight(30);
    }
  };

  const handleFileClose = (filePath: string) => {
    const newOpenFiles = openFiles.filter(f => f !== filePath);
    setOpenFiles(newOpenFiles);
    
    if (activeFile === filePath) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  const handleSplitterDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const startY = e.clientY;
    const startHeight = editorHeight;
    const containerElement = e.currentTarget.closest('.workspace-content');
    if (!containerElement) return;
    
    const containerRect = containerElement.getBoundingClientRect();
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const deltaPercent = (deltaY / containerRect.height) * 100;
      const newHeight = Math.max(15, Math.min(85, startHeight + deltaPercent));
      setEditorHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
    <div className="flex h-full">
      {/* Conditional File Explorer */}
      {showFileExplorer && (
        <FileSearchPanel 
          workspaceId={workspaceId}
          onFileSelect={handleFileOpen}
          onToggleWorkspaceView={onToggleWorkspaceView}
        />
      )}
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col workspace-content">
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
              onClose={onClose}
            />
          </div>
        )}
        
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
        
        {/* Resizable Editor/Terminal Area */}
        <div className="flex-1 flex flex-col" style={{ minHeight: '400px' }}>
          {/* File Tabs (Always Visible) */}
          <div 
            className="flex items-center border-b overflow-x-auto"
            style={{ 
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              height: '40px',
            }}
          >
            {/* Workspace Indicator */}
            <div className="flex items-center px-3 border-r" style={{ borderColor: 'var(--color-border)' }}>
              {onToggleWorkspaceView && (
                <button
                  onClick={onToggleWorkspaceView}
                  className="text-sm mr-2 hover:bg-opacity-10 rounded px-1"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Switch to workspace view"
                >
                  ←
                </button>
              )}
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {workspace?.title || 'Workspace'}
              </span>
            </div>
            
            {openFiles.length === 0 ? (
              <div className="flex items-center px-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                📝 No files open - select a file to start editing
              </div>
            ) : (
              openFiles.map(filePath => {
                const fileName = filePath.split('/').pop() || filePath;
                const isActive = activeFile === filePath;
                return (
                  <button
                    key={filePath}
                    onClick={() => {
                      setActiveFile(filePath);
                      setPrimaryPanel('editor');
                      setHideEditor(false);
                      if (hideTerminal || editorHeight < 50) setEditorHeight(100);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 border-r text-sm transition-all ${
                      isActive ? 'font-medium' : ''
                    }`}
                    style={{
                      backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                      color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                      borderColor: 'var(--color-border)',
                      opacity: primaryPanel === 'editor' ? 1 : 0.7,
                    }}
                  >
                    <span>📄</span>
                    <span className="whitespace-nowrap">{fileName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileClose(filePath);
                      }}
                      className="text-xs hover:bg-black hover:bg-opacity-20 rounded px-1"
                    >
                      ✕
                    </button>
                  </button>
                );
              })
            )}
            
            {/* Panel Controls */}
            <div className="ml-auto flex items-center gap-1 px-2">
              <button
                onClick={() => {
                  // 📝 icon shows files (hides terminal, shows editor)
                  setHideTerminal(true);
                  setHideEditor(false);
                  setPrimaryPanel('editor');
                }}
                className="text-xs px-2 py-1 rounded hover:bg-opacity-20"
                style={{ 
                  color: hideTerminal ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  backgroundColor: hideTerminal ? 'var(--color-primary-alpha)' : 'transparent',
                }}
                title="Show files only"
              >
                📝
              </button>
              <button
                onClick={() => {
                  // 🤖 icon shows terminal (hides editor, shows terminal)
                  setHideEditor(true);
                  setHideTerminal(false);
                  setPrimaryPanel('terminal');
                }}
                className="text-xs px-2 py-1 rounded hover:bg-opacity-20"
                style={{ 
                  color: hideEditor ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  backgroundColor: hideEditor ? 'var(--color-primary-alpha)' : 'transparent',
                }}
                title="Show terminal only"
              >
                🤖
              </button>
            </div>
          </div>
          
          {/* Monaco Editor Area */}
          {!hideEditor && (
            <div 
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
              />
            </Suspense>
            </div>
          )}
          
          {/* Resizable Splitter */}
          {!hideEditor && !hideTerminal && (
            <div 
              className="flex items-center justify-center cursor-row-resize border-t border-b hover:bg-opacity-20"
              style={{ 
                height: '8px',
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-elevated)',
              }}
              onMouseDown={handleSplitterDrag}
              title="Drag to resize editor and terminal"
            >
              <div className="flex gap-1">
                <div className="w-8 h-0.5 bg-current opacity-40" />
                <div className="w-8 h-0.5 bg-current opacity-40" />
                <div className="w-8 h-0.5 bg-current opacity-40" />
              </div>
            </div>
          )}
          
          {/* Terminal Area */}
          {!hideTerminal && (
            <div 
              style={{ 
                height: hideEditor ? '100%' : `${100 - editorHeight}%`, 
                minHeight: '150px',
                opacity: primaryPanel === 'terminal' ? 1 : 0.8,
              }}
              className="flex flex-col"
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
                onClick={() => {
                  handleAgentSelect(agent.id);
                  setHideTerminal(false);
                  if (hideEditor) setEditorHeight(0);
                }}
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