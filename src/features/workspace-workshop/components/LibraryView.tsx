/**
 * Library View Component
 *
 * Integrates the existing LibraryStage component into the workspace workshop
 * Shows the full library interface when creating new workspaces
 */
'use client';
import React, { useState, useEffect } from 'react';
import { LibraryCard } from '@/features/context-library/components/LibraryCard';
import { LibraryItem } from '@/features/context-library/types';
import { WorkspaceDrafts } from '@/features/workspaces/components/WorkspaceDrafts';
import { ImportModal } from '@/features/context-import/components/ImportModal';
import { ArchiveManager } from '@/features/context-library/components/ArchiveManager';
interface LibraryViewProps {
  onClose: () => void;
  onWorkspaceCreated?: (workspaceId: string) => void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}
export function LibraryView({ onClose, onWorkspaceCreated, onToggleSidebar, showSidebarToggle }: LibraryViewProps) {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [hasExistingWorkspaces, setHasExistingWorkspaces] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showArchiveManager, setShowArchiveManager] = useState(false);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [pendingWorkspaceMode, setPendingWorkspaceMode] = useState<'all-together' | 'individual' | null>(null);
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [isLibraryCardsCollapsed, setIsLibraryCardsCollapsed] = useState(false);
  const [isApplyToWorkspacesMode, setIsApplyToWorkspacesMode] = useState(false);
  const [repoConfigurations, setRepoConfigurations] = useState<Record<string, {
    branchingStrategy: string;
    deployTarget: string;
    baseBranch: string;
    workBranch: string;
  }>>({});
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  useEffect(() => {
    loadLibraryItems();
    checkExistingWorkspaces();
  }, []);
  const loadLibraryItems = async () => {
    try {
      const localItems = JSON.parse(localStorage.getItem('context-library') || '[]');
      if (localItems.length === 0) {
        await loadFromStorage();
        // If still no items after loading from storage, add some sample data for testing
        const currentItems = JSON.parse(localStorage.getItem('context-library') || '[]');
        if (currentItems.length === 0) {
          const sampleItems = [
            {
              id: 'sample-1',
              title: 'Sample JIRA Ticket',
              description: 'Example JIRA ticket for testing workspace creation',
              source: 'jira',
              type: 'jira_ticket',
              preview: 'This is a sample JIRA ticket to demonstrate workspace creation functionality.',
              content: { summary: 'Sample ticket', description: 'Test description' },
              metadata: { priority: 'high', status: 'open' },
              tags: ['sample', 'test'],
              added_at: new Date().toISOString(),
              size_bytes: 1024
            },
            {
              id: 'sample-2',
              title: 'Sample Git Repository',
              description: 'Example Git repository for testing',
              source: 'git',
              type: 'git_repository',
              preview: 'This is a sample Git repository to demonstrate workspace creation.',
              content: { owner: 'example', repo: 'sample-repo', branch: 'main' },
              metadata: { language: 'TypeScript', stars: 42 },
              library_metadata: { clone_mode: 'writeable', added_at: new Date().toISOString(), status: 'active' },
              tags: ['git', 'typescript', 'sample'],
              added_at: new Date().toISOString(),
              size_bytes: 2048
            },
            {
              id: 'sample-3',
              title: 'Sample Read-Only Repository',
              description: 'Example read-only Git repository for testing',
              source: 'git',
              type: 'git_repository',
              preview: 'This is a sample read-only Git repository to demonstrate different access modes.',
              content: { owner: 'example', repo: 'readonly-repo', branch: 'main' },
              metadata: { language: 'JavaScript', stars: 15 },
              library_metadata: { clone_mode: 'read-only', added_at: new Date().toISOString(), status: 'active' },
              tags: ['git', 'javascript', 'sample', 'read-only'],
              added_at: new Date().toISOString(),
              size_bytes: 1536
            },
            {
              id: 'sample-4',
              title: 'Sample Documentation',
              description: 'Example documentation file',
              source: 'file',
              type: 'document',
              preview: 'This is a sample documentation file for testing purposes.',
              content: { text: 'Sample documentation content' },
              metadata: { format: 'markdown' },
              tags: ['docs', 'sample'],
              added_at: new Date().toISOString(),
              size_bytes: 512
            }
          ];
          setLibraryItems(sampleItems);
          localStorage.setItem('context-library', JSON.stringify(sampleItems));
        } else {
          setLibraryItems(currentItems);
        }
      } else {
        const hasStorageItems = localItems.some((item: any) => item._isFromStorage);
        if (hasStorageItems) {
          await loadFromStorage();
        } else {
          setLibraryItems(localItems);
        }
      }
    } catch (error) {
      console.error('Error loading library items:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadFromStorage = async () => {
    try {
      const response = await fetch('/api/context-workflow/library');
      if (response.ok) {
        const data = await response.json();
        setLibraryItems(data.items || []);
        localStorage.setItem('context-library', JSON.stringify(data.items || []));
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
      setLibraryItems([]);
    }
  };
  const checkExistingWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setHasExistingWorkspaces(data.workspaces && data.workspaces.length > 0);
      }
    } catch (error) {
      console.error('Error checking existing workspaces:', error);
    }
  };
  const handleItemClick = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };
  const handleCreateWorkspace = async (mode: 'all-together' | 'individual') => {
    if (selectedItems.size === 0) return;
    const selectedItemsArray = libraryItems.filter(item => selectedItems.has(item.id));
    
    try {
      // Get existing drafts from localStorage
      const existingDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
      const newDrafts = [];

      if (mode === 'all-together') {
        // Create a single workspace draft with all selected items
        const targetRepos = availableRepos.filter(repo => selectedRepos.has(repo.id)).map(repo => ({
          ...repo,
          git_config: repoConfigurations[repo.id] || {
            branchingStrategy: 'feature-branch',
            deployTarget: 'development',
            baseBranch: repo.branch || 'main',
            workBranch: `workspace-${Date.now()}`
          }
        }));
        const workspaceDraft = {
          id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `Workspace - ${selectedItemsArray.length} items`,
          description: 'Created from library selection',
          context_items: selectedItemsArray,
          target_items: targetRepos,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'draft',
          tags: ['library-generated'],
          feedback_config: {
            status_updates: true,
            progress_tracking: true,
            result_storage: 'workspace'
          },
          agent_configs: [],
          settings: {
            agent_deployment: true,
            auto_archive: false,
            collaboration: false
          }
        };
        newDrafts.push(workspaceDraft);
      } else {
        // Create individual workspace drafts for each selected item
        const targetRepos = availableRepos.filter(repo => selectedRepos.has(repo.id)).map(repo => ({
          ...repo,
          git_config: repoConfigurations[repo.id] || {
            branchingStrategy: 'feature-branch',
            deployTarget: 'development',
            baseBranch: repo.branch || 'main',
            workBranch: `workspace-${Date.now()}`
          }
        }));
        for (const item of selectedItemsArray) {
          const workspaceDraft = {
            id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${item.id}`,
            name: `Workspace - ${item.title}`,
            description: item.description || 'Created from library item',
            context_items: [item, ...targetRepos], // Include both the ticket AND the selected repos as context
            target_items: targetRepos, // Each workspace gets the same selected repos
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'draft',
            tags: ['library-generated', 'individual'],
            feedback_config: {
              status_updates: true,
              progress_tracking: true,
              result_storage: 'workspace'
            },
            agent_configs: [],
            settings: {
              agent_deployment: true,
              auto_archive: false,
              collaboration: false
            }
          };
          newDrafts.push(workspaceDraft);
        }
      }

      // Save drafts to localStorage
      const updatedDrafts = [...existingDrafts, ...newDrafts];
      localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));

      // Sync drafts to backend
      try {
        await fetch('/api/workspace-drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync',
            drafts: updatedDrafts
          }),
        });
      } catch (syncError) {
        console.warn('Failed to sync drafts to backend:', syncError);
      }

      // Clear selection and stay in library view to show the new drafts
      setSelectedItems(new Set());
      
      // Force refresh library items to ensure any updates are reflected
      await loadFromStorage();
      
      // Show success message
      const draftCount = newDrafts.length;
      alert(`✅ Created ${draftCount} workspace draft${draftCount > 1 ? 's' : ''}!\n\nYou can see ${draftCount > 1 ? 'them' : 'it'} in the "Workspace Drafts" section below.`);
      
      // Don't close the library view - let user see the new drafts
      
    } catch (error) {
      console.error('Error creating workspace drafts:', error);
      alert(`Error creating workspace drafts: ${error}`);
    }
  };
  const handleImportComplete = (newItems: LibraryItem[] | LibraryItem | null) => {
    if (!newItems) return;
    
    // Ensure newItems is always an array
    const itemsArray = Array.isArray(newItems) ? newItems : [newItems];
    
    setLibraryItems(prev => [...prev, ...itemsArray]);
    setShowImportModal(false);
  };
  // Filter logic with deduplication
  const filteredItems = libraryItems.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    return matchesSearch && matchesType && matchesSource && matchesPriority;
  })
  // Deduplicate items by ID to prevent React key conflicts
  .filter((item, index, self) => 
    index === self.findIndex(t => t.id === item.id)
  );
  const getUniqueValues = (key: keyof LibraryItem) => {
    const values = libraryItems.map(item => item[key]).filter(Boolean);
    return [...new Set(values)];
  };
  const clearSelection = () => {
    setSelectedItems(new Set());
  };
  
  const loadAvailableRepos = async () => {
    try {
      // Get all library items that are Git repositories
      const gitRepos = libraryItems.filter(item => 
        item.source === 'git' && item.type === 'git_repository' && item.content
      );
      
      // Deduplicate repositories by ID to prevent React key errors
      const uniqueRepos = gitRepos.filter((repo, index, self) => 
        index === self.findIndex(r => r.id === repo.id)
      );
      
      const repoOptions = uniqueRepos.map(repo => ({
        id: repo.id,
        title: repo.title,
        description: repo.description || repo.preview,
        repo_url: repo.content?.clone_url || repo.content?.repo_url || repo.content?.html_url,
        clone_mode: repo.library_metadata?.clone_mode || 'read-only',
        owner: repo.content?.owner,
        repo: repo.content?.repo,
        branch: repo.content?.branch || 'main',
        full_name: repo.content?.full_name || `${repo.content?.owner}/${repo.content?.repo}`
      }));
      
      setAvailableRepos(repoOptions);
      
      // Initialize default configurations for each repo
      const defaultConfigs: Record<string, any> = {};
      repoOptions.forEach(repo => {
        defaultConfigs[repo.id] = {
          branchingStrategy: 'feature-branch', // Default strategy
          deployTarget: 'development', // Default target
          baseBranch: repo.branch || 'main',
          workBranch: `workspace-${Date.now()}`
        };
      });
      setRepoConfigurations(defaultConfigs);
      
    } catch (error) {
      console.error('Failed to load available repositories:', error);
      setAvailableRepos([]);
    }
  };
  
  const updateRepoConfiguration = (repoId: string, updates: Partial<{
    branchingStrategy: string;
    deployTarget: string;
    baseBranch: string;
    workBranch: string;
  }>) => {
    setRepoConfigurations(prev => ({
      ...prev,
      [repoId]: { ...prev[repoId], ...updates }
    }));
  };
  const selectAll = () => {
    const allIds = new Set(filteredItems.map(item => item.id));
    setSelectedItems(allIds);
  };
  const createWorkspaceForAll = async () => {
    setPendingWorkspaceMode('all-together');
    await loadAvailableRepos();
    setShowRepoSelector(true);
  };
  const createWorkspaceForEach = async () => {
    setPendingWorkspaceMode('individual');
    await loadAvailableRepos();
    setShowRepoSelector(true);
  };
  
  const handleRepoSelectionComplete = async () => {
    if (pendingWorkspaceMode) {
      await handleCreateWorkspace(pendingWorkspaceMode);
      setShowRepoSelector(false);
      setPendingWorkspaceMode(null);
      setSelectedRepos(new Set());
      setRepoConfigurations({});
    }
  };

  const handleExitApplyToWorkspacesMode = () => {
    setIsApplyToWorkspacesMode(false);
    setSelectedItems(new Set()); // Clear library selection when exiting
  };

  const handleApplyContextToDrafts = async (selectedDraftIds: string[]) => {
    if (selectedItems.size === 0) {
      alert('Please select library items to apply to workspace drafts.');
      return;
    }

    if (selectedDraftIds.length === 0) {
      alert('Please select workspace drafts to apply context items to.');
      return;
    }

    try {
      // Get selected library items
      const selectedItemsArray = libraryItems.filter(item => selectedItems.has(item.id));
      
      // Get current drafts from localStorage
      const existingDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
      
      // Update selected drafts with new context items
      const updatedDrafts = existingDrafts.map((draft: any) => {
        if (selectedDraftIds.includes(draft.id)) {
          // Add new context items, avoiding duplicates based on item.id
          const existingItemIds = new Set(draft.context_items.map((item: any) => item.id));
          const newItems = selectedItemsArray.filter(item => !existingItemIds.has(item.id));
          
          return {
            ...draft,
            context_items: [...draft.context_items, ...newItems],
            updated_at: new Date().toISOString()
          };
        }
        return draft;
      });

      // Save updated drafts
      localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));

      // Sync to backend
      try {
        await fetch('/api/workspace-drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync',
            drafts: updatedDrafts
          }),
        });
      } catch (syncError) {
        console.warn('Failed to sync drafts to backend:', syncError);
      }

      // Clear library selection
      setSelectedItems(new Set());

      // Show success message
      const addedItems = selectedItemsArray.length;
      const updatedDraftCount = selectedDraftIds.length;
      alert(`✅ Applied ${addedItems} context item${addedItems > 1 ? 's' : ''} to ${updatedDraftCount} workspace draft${updatedDraftCount > 1 ? 's' : ''}!`);
      
    } catch (error) {
      console.error('Error applying context to drafts:', error);
      alert('❌ Failed to apply context items to workspace drafts');
    }
  };
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div className="flex items-center gap-3">
          {showSidebarToggle && (
            <button
              onClick={onToggleSidebar}
              className="flex items-center gap-2 px-3 py-1 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              <span>📋</span>
              <span className="text-sm">Show Workspaces</span>
            </button>
          )}
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            📚 Context Library
          </h1>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              borderColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            <span>📥</span>
            <span>Import</span>
          </button>
          <button
            onClick={() => setShowArchiveManager(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>🗃️</span>
            <span>Archive</span>
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              await loadFromStorage();
              setLoading(false);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            title="Refresh library from storage"
          >
            <span>🔄</span>
            <span>Refresh Library</span>
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('context-library');
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
            style={{
              backgroundColor: 'var(--color-warning-alpha)',
              borderColor: 'var(--color-warning)',
              color: 'var(--color-warning)',
            }}
            title="Reset library to get fresh sample data with Git repositories"
          >
            <span>🗑️</span>
            <span>Reset Library</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>
      {/* Filters */}
      {libraryItems.length > 0 && (
        <div
          className="p-3 border-b"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="Search library items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="all">All Sources</option>
              {getUniqueValues('source').map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="all">All Types</option>
              {getUniqueValues('type').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="all">All Priorities</option>
              {getUniqueValues('priority').map(priority => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm relative">
            <div className="flex items-center gap-3">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                Showing {filteredItems.length} of {libraryItems.length} items
              </span>
              <button
                onClick={() => setIsLibraryCardsCollapsed(!isLibraryCardsCollapsed)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid'
                }}
              >
                <span>{isLibraryCardsCollapsed ? '👁️' : '👁️‍🗨️'}</span>
                <span>{isLibraryCardsCollapsed ? 'Show Cards' : 'Hide Cards'}</span>
              </button>
            </div>
            
            {/* Overlay buttons when items are selected */}
            {selectedItems.size > 0 && (
              <div 
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)'
                }}
              >
                <span className="text-sm font-medium">
                  {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected:
                </span>
                <button
                  onClick={createWorkspaceForAll}
                  className="flex items-center gap-1 px-2 py-1 rounded border transition-colors text-xs"
                  style={{
                    backgroundColor: 'var(--color-success)',
                    borderColor: 'var(--color-success)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  <span>🏗️</span>
                  <span>All Together</span>
                </button>
                {selectedItems.size > 1 && (
                  <button
                    onClick={createWorkspaceForEach}
                    className="flex items-center gap-1 px-2 py-1 rounded border transition-colors text-xs"
                    style={{
                      backgroundColor: 'var(--color-warning)',
                      borderColor: 'var(--color-warning)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    <span>🏗️</span>
                    <span>For Each</span>
                  </button>
                )}
                <button
                  onClick={() => setIsApplyToWorkspacesMode(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded border transition-colors text-xs"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    borderColor: 'var(--color-accent)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  <span>📋</span>
                  <span>Apply to Workspaces</span>
                </button>
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-1 px-2 py-1 rounded border transition-colors text-xs"
                  style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span>✕</span>
                </button>
              </div>
            )}
            
            {libraryItems.length > 0 && (
              <div className="flex items-center gap-2">
                {selectedItems.size > 0 && (
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-primary-alpha)',
                      color: 'var(--color-primary)'
                    }}
                  >
                    {selectedItems.size} selected
                  </span>
                )}
                <button
                  onClick={selectedItems.size === filteredItems.length ? clearSelection : selectAll}
                  className="text-sm"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {selectedItems.size === filteredItems.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Library Items - Collapsible */}
      {!isLibraryCardsCollapsed && (
        <div className="overflow-hidden" style={{ height: '380px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                <p style={{ color: 'var(--color-text-secondary)' }}>Loading library...</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {libraryItems.length === 0 ? 'No library items yet' : 'No matching items'}
                </h3>
                <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  {libraryItems.length === 0
                    ? 'Import content from JIRA, Git, or other sources to get started'
                    : 'Try adjusting your filters or search terms'}
                </p>
                {libraryItems.length === 0 && (
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-6 py-3 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      borderColor: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    📥 Import Content
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 overflow-hidden" style={{ height: '380px' }}>
              {/* Horizontal Scrollable Cards Container - Constrained Height */}
              <div className="relative h-full">
                <div
                  className="overflow-x-auto overflow-y-hidden h-full"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--color-border) var(--color-surface)',
                  }}
                >
                  <div className="flex gap-4 pb-4 h-full" style={{ width: 'max-content' }}>
                    {filteredItems.map((item, index) => (
                      <div key={`${item.id}-${item.source}-${item.added_at || index}`} className="flex-shrink-0" style={{ width: '280px', height: '306px' }}>
                        <LibraryCard
                          item={item}
                          isSelected={selectedItems.has(item.id)}
                          onSelect={handleItemClick}
                          onRemove={(itemId) => {
                            setLibraryItems(prev => prev.filter(i => i.id !== itemId));
                            setSelectedItems(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(itemId);
                              return newSet;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {filteredItems.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <p style={{ color: 'var(--color-text-primary)' }}>No items match your filters</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Try adjusting your search criteria</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Collapsed State Indicator */}
      {isLibraryCardsCollapsed && (
        <div 
          className="p-4 border-b border-dashed cursor-pointer transition-colors"
          style={{ 
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface-elevated)',
            color: 'var(--color-text-muted)'
          }}
          onClick={() => setIsLibraryCardsCollapsed(false)}
        >
          <div className="text-center">
            <span className="text-sm">📚 Library cards hidden - Click to show {filteredItems.length} items</span>
          </div>
        </div>
      )}
      {/* Workspace Drafts Section */}
      <div 
        className="border-t" 
        style={{ 
          borderColor: 'var(--color-border)',
          backgroundColor: isApplyToWorkspacesMode ? 'var(--color-accent-alpha)' : 'transparent'
        }}
      >
        <WorkspaceDrafts 
          onApplyContextToDrafts={handleApplyContextToDrafts}
          selectedLibraryItems={selectedItems}
          libraryItems={libraryItems}
          isLibraryCollapsed={isLibraryCardsCollapsed}
          isApplyToWorkspacesMode={isApplyToWorkspacesMode}
          onExitApplyToWorkspacesMode={handleExitApplyToWorkspacesMode}
        />
      </div>
      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
      {/* Archive Manager */}
      {showArchiveManager && (
        <ArchiveManager
          isOpen={showArchiveManager}
          onClose={() => setShowArchiveManager(false)}
          onRestore={(items) => {
            setLibraryItems(prev => [...prev, ...items]);
            setShowArchiveManager(false);
          }}
        />
      )}
      {/* Repository Selection Modal */}
      {showRepoSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)'
            }}
          >
            <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  🎯 Configure Git Workflow & Deploy Pipeline
                </h3>
                <button
                  onClick={() => setShowRepoSelector(false)}
                  className="text-xl" 
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ✕
                </button>
              </div>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                Configure repositories, branching strategies, and deployment targets for your workspace.
                {pendingWorkspaceMode === 'individual' && ' Each workspace will use these same configurations.'}
              </p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              {availableRepos.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📂</div>
                  <p style={{ color: 'var(--color-text-primary)' }}>No Git repositories found</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Import some Git repositories first to use as targets
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableRepos.map((repo, index) => {
                    const config = repoConfigurations[repo.id] || {};
                    const isSelected = selectedRepos.has(repo.id);
                    
                    return (
                      <div
                        key={`${repo.id}-${repo.full_name || repo.title}-${index}`}
                        className={`border rounded-lg transition-colors ${isSelected ? 'border-blue-500' : 'border-gray-200'}`}
                        style={{
                          borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                          backgroundColor: 'var(--color-surface)'
                        }}
                      >
                        {/* Repository Header */}
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => {
                            const newSelection = new Set(selectedRepos);
                            if (newSelection.has(repo.id)) {
                              newSelection.delete(repo.id);
                            } else {
                              newSelection.add(repo.id);
                            }
                            setSelectedRepos(newSelection);
                          }}
                          style={{
                            backgroundColor: isSelected ? 'var(--color-primary-alpha)' : 'transparent'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by parent onClick
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                  {repo.title}
                                </h4>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                  {repo.full_name} • {repo.branch}
                                </p>
                                {repo.description && (
                                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                    {repo.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  repo.clone_mode === 'writeable' 
                                    ? 'bg-orange-100 text-orange-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {repo.clone_mode === 'writeable' ? '✏️ Writeable' : '🔍 Read-only'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Configuration Panel - Only show when selected */}
                        {isSelected && (
                          <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <h5 className="font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                              🔧 Git Workflow Configuration
                            </h5>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Branching Strategy */}
                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                  Branching Strategy
                                </label>
                                <select
                                  value={config.branchingStrategy || 'feature-branch'}
                                  onChange={(e) => updateRepoConfiguration(repo.id, { branchingStrategy: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  style={{
                                    backgroundColor: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-primary)'
                                  }}
                                >
                                  <option value="feature-branch">🌿 Feature Branch (recommended)</option>
                                  <option value="direct-main">⚡ Direct to Main (fast)</option>
                                  <option value="git-flow">🔄 Git Flow (complex)</option>
                                  <option value="github-flow">📝 GitHub Flow (simple)</option>
                                </select>
                              </div>
                              
                              {/* Deploy Target */}
                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                  Deploy Target
                                </label>
                                <select
                                  value={config.deployTarget || 'development'}
                                  onChange={(e) => updateRepoConfiguration(repo.id, { deployTarget: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  style={{
                                    backgroundColor: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-primary)'
                                  }}
                                >
                                  <option value="development">🧪 Development</option>
                                  <option value="staging">🎭 Staging</option>
                                  <option value="production">🚀 Production</option>
                                  <option value="preview">👀 Preview/Demo</option>
                                </select>
                              </div>
                              
                              {/* Base Branch */}
                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                  Base Branch
                                </label>
                                <input
                                  type="text"
                                  value={config.baseBranch || repo.branch || 'main'}
                                  onChange={(e) => updateRepoConfiguration(repo.id, { baseBranch: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  style={{
                                    backgroundColor: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-primary)'
                                  }}
                                  placeholder="main"
                                />
                              </div>
                              
                              {/* Work Branch */}
                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                  Work Branch Name
                                </label>
                                <input
                                  type="text"
                                  value={config.workBranch || `workspace-${Date.now()}`}
                                  onChange={(e) => updateRepoConfiguration(repo.id, { workBranch: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  style={{
                                    backgroundColor: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-primary)'
                                  }}
                                  placeholder="workspace-feature"
                                />
                              </div>
                            </div>
                            
                            {/* Smart Defaults Info */}
                            <div className="mt-3 p-2 rounded text-xs" style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}>
                              💡 <strong>Smart defaults:</strong> 
                              {config.branchingStrategy === 'feature-branch' && ' Creates feature branch → PR → merge workflow'}
                              {config.branchingStrategy === 'direct-main' && ' Commits directly to main (use with caution)'}
                              {config.branchingStrategy === 'git-flow' && ' Uses develop → feature → release → main flow'}
                              {config.branchingStrategy === 'github-flow' && ' Simple main → feature → PR → main flow'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50" style={{ 
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)'
            }}>
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {selectedRepos.size} repository{selectedRepos.size !== 1 ? 'ies' : ''} selected
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRepoSelector(false)}
                    className="px-4 py-2 border rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'var(--color-surface-elevated)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRepoSelectionComplete}
                    className="px-4 py-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)'
                    }}
                  >
                    Create Workspace{pendingWorkspaceMode === 'individual' && 's'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}