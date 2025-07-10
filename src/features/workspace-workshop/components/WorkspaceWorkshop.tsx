/**
 * Workspace Workshop - Main Component
 *
 * The new workspace-centric interface that replaces the Library→Workspace tab system
 * Features: compact workspace cards, overlay system, integrated file explorer and terminal
 */
'use client';
import { useState, useEffect, Suspense, lazy } from 'react';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { CredentialsManager } from '@/components/CredentialsManager';
import { SetupWizard } from '@/components/SetupWizard';
import { ThemeSelector } from '@/components/ThemeSelector';
import { useTheme } from '@/lib/theme-context';
// Lazy load heavy components
const LazyWorkspaceSelectionView = lazy(() => import('./WorkspaceSelectionView').then(m => ({ default: m.WorkspaceSelectionView })));
const LazyActiveWorkspaceView = lazy(() => import('./ActiveWorkspaceView').then(m => ({ default: m.ActiveWorkspaceView })));
const LazyLibraryView = lazy(() => import('./LibraryView').then(m => ({ default: m.LibraryView })));
const LazyAgentManagementModal = lazy(() => import('./AgentManagementModal').then(m => ({ default: m.AgentManagementModal })));
const LazyTriggersModal = lazy(() => import('./TriggersModal').then(m => ({ default: m.TriggersModal })));
interface WorkspaceWorkshopProps {
  className?: string;
}
export function WorkspaceWorkshop({ className = '' }: WorkspaceWorkshopProps) {
  const { currentTheme } = useTheme();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showAgentManagement, setShowAgentManagement] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [apiHealth, setApiHealth] = useState<string>('checking...');
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showLibraryView, setShowLibraryView] = useState(false);
  const [hasLibraryItems, setHasLibraryItems] = useState(false);
  const [touchedWorkspaces, setTouchedWorkspaces] = useState<Set<string>>(new Set());
  
  // Test API connection
  useEffect(() => {
    const testAPI = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setApiHealth(`✅ ${data.pipeline}`);
      } catch {
        setApiHealth('❌ API not available');
      }
    };
    testAPI();
  }, []);

  // Listen for credentials manager and setup wizard events
  useEffect(() => {
    const handleOpenCredentials = () => {
      setShowCredentials(true);
    };

    const handleOpenSetupWizard = () => {
      setShowSetupWizard(true);
    };

    window.addEventListener('open-credentials-manager', handleOpenCredentials);
    window.addEventListener('open-setup-wizard', handleOpenSetupWizard);
    
    return () => {
      window.removeEventListener('open-credentials-manager', handleOpenCredentials);
      window.removeEventListener('open-setup-wizard', handleOpenSetupWizard);
    };
  }, []);

  // Check for library items and show library view by default ONLY on initial load
  useEffect(() => {
    const checkLibraryItems = () => {
      try {
        const localItems = JSON.parse(localStorage.getItem('context-library') || '[]');
        const hasItems = localItems.length > 0;
        setHasLibraryItems(hasItems);
      } catch (error) {
        console.error('Failed to check library items:', error);
      }
    };

    checkLibraryItems();
    
    // Also check periodically in case items are added via import
    const interval = setInterval(checkLibraryItems, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Show library view by default ONLY on initial mount if items exist and no workspace selected
  useEffect(() => {
    // Only auto-show library if no workspace is currently selected and library isn't already showing
    if (hasLibraryItems && !selectedWorkspace && !showLibraryView) {
      setShowLibraryView(true);
    }
  }, [hasLibraryItems]); // Only run when hasLibraryItems changes
  
  // Hide library when workspace is selected
  useEffect(() => {
    if (selectedWorkspace && showLibraryView) {
      setShowLibraryView(false);
    }
  }, [selectedWorkspace, showLibraryView]);

  // Listen for workspace touched events and show-library-view events
  useEffect(() => {
    const handleWorkspaceTouched = (event: CustomEvent) => {
      const { workspaceId } = event.detail;
      setTouchedWorkspaces(prev => new Set([...prev, workspaceId]));
    };
    
    const handleShowLibraryView = () => {
      setSelectedWorkspace(null);
      setShowLibraryView(true);
      setShowLeftSidebar(true);
    };
    
    window.addEventListener('workspace-touched', handleWorkspaceTouched as EventListener);
    window.addEventListener('show-library-view', handleShowLibraryView);
    return () => {
      window.removeEventListener('workspace-touched', handleWorkspaceTouched as EventListener);
      window.removeEventListener('show-library-view', handleShowLibraryView);
    };
  }, []);
  
  return (
    <div
      className={`h-screen transition-colors ${className}`}
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Floating Settings Toggle Button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setShowSettingsSidebar(!showSettingsSidebar)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface-elevated)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <span>☰</span>
          <span className="text-sm">Settings</span>
        </button>
      </div>
      {/* Right Settings Sidebar */}
      {showSettingsSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowSettingsSidebar(false)}
          />
          <div
            className="fixed top-0 right-0 h-full w-80 shadow-2xl z-50 border-l"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  🏗️ Workspace Workshop
                </h2>
                <button
                  onClick={() => setShowSettingsSidebar(false)}
                  className="text-xl" style={{ color: 'var(--color-text-muted)' }}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div className="pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    IDE-optimized workspace management
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    API: {apiHealth}
                  </p>
                </div>
                <button
                  onClick={() => setShowCredentials(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span>🔐</span>
                  <span>Credentials</span>
                </button>
                <div className="w-full">
                  <ThemeSelector compact />
                </div>
                <button
                  onClick={() => {
                    setShowAgentManagement(true);
                    setShowSettingsSidebar(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span>🤖</span>
                  <span>Manage Agents</span>
                </button>
                <button
                  onClick={() => {
                    setShowTriggers(true);
                    setShowSettingsSidebar(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span>⚡</span>
                  <span>Triggers</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Workshop Body - Full Height */}
      <div className="flex h-full">
        {/* Conditional Left Sidebar */}
        {showLeftSidebar && (
          <WorkspaceSidebar
            selectedWorkspace={selectedWorkspace}
            onWorkspaceSelect={(workspaceId) => {
              if (workspaceId === null) {
                // Deselecting workspace - show library view but keep sidebar open
                setSelectedWorkspace(null);
                setShowLibraryView(true);
                setShowLeftSidebar(true);
              } else {
                // Selecting workspace - hide library and switch to file explorer
                setSelectedWorkspace(workspaceId);
                setShowLibraryView(false);
                setShowLeftSidebar(false);
              }
            }}
            onToggleFileView={() => setShowLeftSidebar(false)}
            onNewWorkspace={() => setShowLibraryView(true)}
            onBackToLibrary={() => {
              setSelectedWorkspace(null);
              setShowLibraryView(true);
              setShowLeftSidebar(true); // Keep sidebar visible
            }}
            touchedWorkspaces={touchedWorkspaces}
          />
        )}
        {/* Dynamic Main Area */}
        <div className="flex-1 flex overflow-hidden">
          {showLibraryView ? (
            <div className="w-full">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                    <p style={{ color: 'var(--color-text-secondary)' }}>Loading library...</p>
                  </div>
                </div>
              }>
                <LazyLibraryView
                  onClose={() => {
                    setShowLibraryView(false);
                    setShowLeftSidebar(true); // Show workspace sidebar when closing library
                  }}
                  onWorkspaceCreated={(workspaceId) => {
                    setSelectedWorkspace(workspaceId);
                    setShowLibraryView(false);
                    setShowLeftSidebar(false); // Hide sidebar when entering workspace (file sidebar will show)
                  }}
                  onToggleSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
                  showSidebarToggle={!showLeftSidebar}
                />
              </Suspense>
            </div>
          ) : selectedWorkspace ? (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Loading workspace...</p>
                </div>
              </div>
            }>
              <LazyActiveWorkspaceView
                workspaceId={selectedWorkspace}
                onClose={() => {
                  setSelectedWorkspace(null);
                  setShowLibraryView(true);
                  setShowLeftSidebar(true);
                }}
                showFileExplorer={!showLeftSidebar}
                onToggleWorkspaceView={() => setShowLeftSidebar(true)}
              />
            </Suspense>
          ) : (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-pulse h-32 w-32 bg-gray-200 rounded-lg mx-auto mb-4" style={{ backgroundColor: 'var(--color-surface-elevated)' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
                </div>
              </div>
            }>
              <LazyWorkspaceSelectionView
                onCreateWorkspace={() => setShowLibraryView(true)}
              />
            </Suspense>
          )}
        </div>
      </div>
      {/* Modals - Only load when needed */}
      <CredentialsManager
        isOpen={showCredentials}
        onClose={() => setShowCredentials(false)}
      />
      <SetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onComplete={() => {
          setShowSetupWizard(false);
          // Optionally refresh credentials or show success message
        }}
      />
      {showAgentManagement && (
        <Suspense fallback={null}>
          <LazyAgentManagementModal
            isOpen={showAgentManagement}
            onClose={() => setShowAgentManagement(false)}
          />
        </Suspense>
      )}
      {showTriggers && (
        <Suspense fallback={null}>
          <LazyTriggersModal
            isOpen={showTriggers}
            onClose={() => setShowTriggers(false)}
          />
        </Suspense>
      )}
    </div>
  );
}