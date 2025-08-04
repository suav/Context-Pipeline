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
  const [fileReadOnly, setFileReadOnly] = useState<Record<string, boolean>>({});
  const [terminalFullscreen, setTerminalFullscreen] = useState(false);
  // Git branch workflow state
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  const [branchInitialized, setBranchInitialized] = useState(false);
  const [gitReady, setGitReady] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
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

  // Initialize clean git branch workflow
  const initializeCleanBranch = async (workspaceTitle: string) => {
    if (branchInitialized) return;
    
    try {
      // Check current git status
      const statusResponse = await fetch(`/api/workspaces/${workspaceId}/git/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.success) {
          const gitStatus = statusData.status;
          setGitReady(true);
          
          // Check for remote
          const pushStatusResponse = await fetch(`/api/workspaces/${workspaceId}/git/push`);
          if (pushStatusResponse.ok) {
            const pushStatus = await pushStatusResponse.json();
            setHasRemote(pushStatus.success && pushStatus.remotes?.includes('origin'));
          }
          
          // Generate clean branch name based on workspace
          const sanitizedTitle = workspaceTitle
            .toLowerCase()
            .replace(/[^a-z0-9\-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const branchName = `workspace/${sanitizedTitle}-${timestamp}`;
          
          // If we're not on a clean state or we're on main/master, create a new branch
          if (!gitStatus.clean || ['main', 'master'].includes(gitStatus.currentBranch)) {
            console.log(`Creating clean branch: ${branchName}`);
            
            const branchResponse = await fetch(`/api/workspaces/${workspaceId}/git/branch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                branchName,
                baseBranch: gitStatus.currentBranch
              })
            });
            
            if (branchResponse.ok) {
              const branchData = await branchResponse.json();
              if (branchData.success) {
                setCurrentBranch(branchName);
                console.log(`Successfully created and switched to branch: ${branchName}`);
              }
            } else {
              // Branch might already exist, try to switch to it
              const switchResponse = await fetch(`/api/workspaces/${workspaceId}/git/branch`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branchName })
              });
              
              if (switchResponse.ok) {
                setCurrentBranch(branchName);
                console.log(`Switched to existing branch: ${branchName}`);
              } else {
                // If we can't create or switch, stay on current branch
                setCurrentBranch(gitStatus.currentBranch);
              }
            }
          } else {
            // Already on a clean, non-main branch
            setCurrentBranch(gitStatus.currentBranch);
          }
        } else {
          // Git not available
          setGitReady(false);
          setHasRemote(false);
        }
      } else {
        // Git not available
        setGitReady(false);
        setHasRemote(false);
      }
    } catch (error) {
      console.error('Error initializing clean branch:', error);
      setGitReady(false);
      setHasRemote(false);
    } finally {
      setBranchInitialized(true);
    }
  };

  // Push changes to origin main (or configured branch)
  const pushToOriginMain = async () => {
    try {
      // First check if this is a git repository
      const gitCheckResponse = await fetch(`/api/workspaces/${workspaceId}/git/status`);
      if (!gitCheckResponse.ok) {
        const gitCheckError = await gitCheckResponse.json();
        alert(`❌ Git repository not found!\n\nThis workspace doesn't appear to be a git repository.\nError: ${gitCheckError.error || 'Unknown error'}\n\nPlease initialize git in this workspace first.`);
        return;
      }

      const gitStatus = await gitCheckResponse.json();
      if (!gitStatus.success) {
        alert(`❌ Git status check failed!\n\nError: ${gitStatus.error || 'Not a git repository'}\n\nPlease ensure this workspace has been initialized as a git repository.`);
        return;
      }

      // Stage all changes
      const stageResponse = await fetch(`/api/workspaces/${workspaceId}/git/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stageAll' })
      });

      if (stageResponse.ok) {
        const stageData = await stageResponse.json();
        if (!stageData.success) {
          alert(`❌ Failed to stage changes: ${stageData.error}`);
          return;
        }

        // Create a commit with a descriptive message
        const commitMessage = `Workspace changes from ${currentBranch}

Automated commit from Context Pipeline workspace.
- Modified files tracked and staged
- Ready for deployment to testing environment`;

        const commitResponse = await fetch(`/api/workspaces/${workspaceId}/git/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: commitMessage,
            author: {
              name: 'Context Pipeline',
              email: 'noreply@context-pipeline.dev'
            }
          })
        });

        if (commitResponse.ok) {
          const commitData = await commitResponse.json();
          console.log('Commit created:', commitData.commitHash);

          // Check if remote origin exists before pushing
          const pushStatusResponse = await fetch(`/api/workspaces/${workspaceId}/git/push`);
          if (pushStatusResponse.ok) {
            const pushStatus = await pushStatusResponse.json();
            if (!pushStatus.success || !pushStatus.remotes.includes('origin')) {
              alert(`❌ No 'origin' remote found!\n\nThis workspace doesn't have a remote 'origin' configured.\nAvailable remotes: ${pushStatus.remotes?.join(', ') || 'none'}\n\nPlease configure a git remote first:\ngit remote add origin <your-repo-url>`);
              return;
            }
          }

          // Push to origin main with force (since this is for deployment)
          const pushResponse = await fetch(`/api/workspaces/${workspaceId}/git/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              remote: 'origin',
              branch: 'main', // TODO: Make this configurable
              force: true // Force push for deployment workflow
            })
          });

          if (pushResponse.ok) {
            const pushData = await pushResponse.json();
            alert(`✅ Successfully deployed to origin main!\n\nCommit: ${commitData.commitHash.slice(0, 8)}\nBranch: ${currentBranch} → main\n\nChanges are now live on the remote repository!`);
          } else {
            const pushError = await pushResponse.json();
            if (pushError.requiresForce) {
              const confirmForce = confirm(`Push rejected (non-fast-forward). Force push?\n\n${pushError.details}\n\nThis will overwrite remote history. Continue?`);
              if (confirmForce) {
                // Retry with force
                const forceResponse = await fetch(`/api/workspaces/${workspaceId}/git/push`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    remote: 'origin',
                    branch: 'main',
                    force: true
                  })
                });
                
                if (forceResponse.ok) {
                  alert('✅ Force push successful! Changes deployed to origin main.');
                } else {
                  const forceError = await forceResponse.json();
                  alert(`❌ Force push failed: ${forceError.error}\n\nDetails: ${forceError.details || 'Unknown error'}`);
                }
              }
            } else if (pushError.error?.includes('Authentication failed') || pushError.error?.includes('Permission denied')) {
              alert(`❌ Git authentication failed!\n\n${pushError.details}\n\nPlease check:\n• Git credentials are configured\n• SSH keys are set up\n• Repository access permissions`);
            } else if (pushError.error?.includes('Remote not found') || pushError.error?.includes('does not exist')) {
              alert(`❌ Remote repository not found!\n\n${pushError.details}\n\nPlease verify:\n• Remote URL is correct\n• Repository exists\n• Network connectivity`);
            } else {
              alert(`❌ Push failed: ${pushError.error}\n\nDetails: ${pushError.details || 'Unknown error'}\n\nTroubleshooting:\n• Check git remote configuration\n• Verify repository permissions\n• Try manual git push to diagnose`);
            }
          }
        } else {
          const commitError = await commitResponse.json();
          if (commitError.error?.includes('No staged changes')) {
            alert(`ℹ️ No changes to commit!\n\nThere are no staged changes in this workspace.\nMake some file modifications first, then try deploying again.`);
          } else {
            alert(`❌ Commit failed: ${commitError.error}\n\nDetails: ${commitError.details || 'Unknown error'}`);
          }
        }
      } else {
        const stageError = await stageResponse.json();
        alert(`❌ Failed to stage changes: ${stageError.error}\n\nDetails: ${stageError.details || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error during deployment:', error);
      alert(`❌ Deployment failed with network error!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Development server is running\n• Network connectivity\n• Browser console for details`);
    }
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

          // Initialize clean branch workflow after workspace is loaded
          await initializeCleanBranch(title);
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
    console.log('ActiveWorkspaceView: handleFileOpen called with:', { filePath, type: typeof filePath });
    
    // CRITICAL: Validate filePath before processing
    if (!filePath || typeof filePath !== 'string' || filePath === 'undefined') {
      console.error('ActiveWorkspaceView: Invalid filePath provided to handleFileOpen:', filePath);
      return;
    }
    
    if (!openFiles.includes(filePath)) {
      setOpenFiles(prev => [...prev, filePath]);
    }
    setActiveFile(filePath);
    // Auto-focus editor when opening a file - show full height
    setHideEditor(false);
    setHideTerminal(true);
    setPrimaryPanel('editor');
    setTerminalFullscreen(false);
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
    // Auto-focus terminal when selecting an agent - show full height but keep file explorer if workspace sidebar is closed
    setHideTerminal(false);
    setHideEditor(true);
    setPrimaryPanel('terminal');
    // Only hide file explorer if workspace sidebar is open (meaning file explorer is redundant)
    setTerminalFullscreen(false); // Keep file explorer visible when agents are selected
  };
  const handleFileClose = (filePath: string) => {
    // Filter out both the closed file and any undefined values
    const newOpenFiles = openFiles.filter(f => f && f !== filePath);
    setOpenFiles(newOpenFiles);
    if (activeFile === filePath) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  // Cleanup any undefined values in openFiles on mount or when openFiles changes
  useEffect(() => {
    const cleanFiles = openFiles.filter(f => f && typeof f === 'string');
    if (cleanFiles.length !== openFiles.length) {
      console.log('ActiveWorkspaceView: Cleaning undefined values from openFiles');
      setOpenFiles(cleanFiles);
    }
  }, [openFiles]);
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
      {/* Conditional File Explorer - Hidden when terminal is fullscreen */}
      {showFileExplorer && !terminalFullscreen && (
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
            
            {/* Git Branch Info and Push Button */}
            <div className="flex items-center gap-2 ml-auto">
              {branchInitialized && currentBranch && (
                <>
                  <span className="text-xs px-2 py-1 rounded" style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    🌿 {currentBranch}
                  </span>
                  {currentBranch !== 'main' && currentBranch !== 'master' && (
                    <button
                      onClick={pushToOriginMain}
                      disabled={!gitReady || !hasRemote}
                      className="text-xs px-3 py-1 rounded transition-colors font-medium hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: gitReady && hasRemote ? '#10b981' : '#6b7280',
                        color: 'white',
                        boxShadow: gitReady && hasRemote ? '0 2px 4px rgba(16, 185, 129, 0.3)' : 'none'
                      }}
                      title={
                        !gitReady 
                          ? "Git repository not initialized in this workspace"
                          : !hasRemote 
                            ? "No git remote 'origin' configured" 
                            : "Stage all changes, commit, and force push to origin main for deployment"
                      }
                    >
                      {!gitReady ? '⚠️ No Git' : !hasRemote ? '⚠️ No Remote' : '🚀 Deploy to Main'}
                    </button>
                  )}
                </>
              )}
            </div>
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
          fileReadOnly={fileReadOnly}
          hideEditor={hideEditor}
          hideTerminal={hideTerminal}
          onToggleTerminal={() => {
            setHideTerminal(false);
            setHideEditor(true);
            setPrimaryPanel('terminal');
            setTerminalFullscreen(true);
          }}
          onToggleEditor={() => {
            setHideEditor(false);
            setHideTerminal(true);
            setPrimaryPanel('editor');
            setTerminalFullscreen(false);
          }}
          onShowBoth={() => {
            setHideEditor(false);
            setHideTerminal(false);
            setEditorHeight(50);
            setPrimaryPanel('editor');
            setTerminalFullscreen(false);
          }}
        />

        {/* Resizable Editor/Terminal Area */}
        <div className="flex-1 flex flex-col overflow-hidden w-full" style={{ minHeight: '400px' }}>
          {/* Monaco Editor Area */}
          {!hideEditor && (
            <div
              className="w-full flex flex-col"
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
                onFileReadOnlyChange={setFileReadOnly}
                hideTerminal={hideTerminal}
                hideEditor={hideEditor}
                onToggleTerminal={() => {
                  setHideTerminal(false);
                  setHideEditor(true);
                  setPrimaryPanel('terminal');
                  setTerminalFullscreen(true);
                }}
                onToggleEditor={() => {
                  setHideEditor(false);
                  setHideTerminal(true);
                  setPrimaryPanel('editor');
                  setTerminalFullscreen(false);
                }}
                onShowBoth={() => {
                  setHideEditor(false);
                  setHideTerminal(false);
                  setEditorHeight(50);
                  setPrimaryPanel('editor');
                  setTerminalFullscreen(false);
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
          {/* Terminal Area - Always rendered to preserve streaming connections */}
          <div
            style={{
              height: hideTerminal ? '0px' : (hideEditor ? '100%' : `${100 - editorHeight}%`),
              minHeight: hideTerminal ? '0px' : '150px',
              opacity: primaryPanel === 'terminal' ? 1 : 0.8,
              overflow: hideTerminal ? 'hidden' : 'visible',
            }}
            className="flex flex-col w-full min-h-0"
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