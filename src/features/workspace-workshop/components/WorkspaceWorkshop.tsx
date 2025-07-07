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
  const [showAgentManagement, setShowAgentManagement] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [apiHealth, setApiHealth] = useState<string>('checking...');
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showLibraryView, setShowLibraryView] = useState(false);

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
              setSelectedWorkspace(workspaceId);
              setShowLeftSidebar(false); // Auto-switch to file explorer when workspace selected
            }}
            onToggleFileView={() => setShowLeftSidebar(false)}
            onNewWorkspace={() => setShowLibraryView(true)}
          />
        )}
        
        {/* Dynamic Main Area */}
        <div className="flex-1">
          {showLibraryView ? (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Loading library...</p>
                </div>
              </div>
            }>
              <LazyLibraryView 
                onClose={() => setShowLibraryView(false)}
                onWorkspaceCreated={(workspaceId) => {
                  setSelectedWorkspace(workspaceId);
                  setShowLibraryView(false);
                  setShowLeftSidebar(false);
                }}
              />
            </Suspense>
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
                onClose={() => setSelectedWorkspace(null)}
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