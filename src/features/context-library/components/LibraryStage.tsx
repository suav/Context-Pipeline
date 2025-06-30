/**
 * Context Library Stage Component
 */

'use client';

import React, { useState, useEffect } from 'react';
import { LibraryCard } from './LibraryCard';
import { LibraryItem } from '../types';
import { WorkspaceDrafts } from '@/features/workspaces/components/WorkspaceDrafts';

export function LibraryStage() {
    const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);
    const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
    const [hasExistingWorkspaces, setHasExistingWorkspaces] = useState(false);
    
    // Debug log to ensure component is updating
    console.log('LibraryStage rendered - clickable cards version');

    useEffect(() => {
        loadLibraryItems();
        checkExistingWorkspaces();
    }, []);

    const loadLibraryItems = () => {
        try {
            const items = JSON.parse(localStorage.getItem('context-library') || '[]');
            console.log('🔍 LibraryStage - Loaded items from localStorage:', items.length, items);
            setLibraryItems(items);
            
            // Auto-sync to file system when library is loaded
            if (items.length > 0) {
                syncToFileSystemFromLibrary(items);
            }
        } catch (error) {
            console.error('Failed to load library:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const syncToFileSystemFromLibrary = async (libraryData: LibraryItem[]) => {
        try {
            const response = await fetch('/api/context-workflow/library', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sync',
                    libraryData: libraryData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('🔄 Auto-synced library to file system:', result.itemCount, 'items');
            }
        } catch (error) {
            console.error('❌ Auto-sync failed:', error);
        }
    };

    const removeFromLibrary = (itemId: string) => {
        try {
            const updatedItems = libraryItems.filter(item => item.id !== itemId);
            localStorage.setItem('context-library', JSON.stringify(updatedItems));
            setLibraryItems(updatedItems);
            
            // Remove from selection if selected
            setSelectedItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
            
            // Sync to file system after removal
            syncToFileSystemFromLibrary(updatedItems);
            
            console.log('✅ Removed from Library:', itemId);
        } catch (error) {
            console.error('❌ Failed to remove from library:', error);
        }
    };

    const toggleSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedItems(new Set(libraryItems.map(item => item.id)));
    };

    const clearSelection = () => {
        setSelectedItems(new Set());
    };
    
    const syncWorkspaceDrafts = async (drafts: any[]) => {
        try {
            const response = await fetch('/api/context-workflow/workspace-drafts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sync',
                    drafts: drafts
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ Workspace drafts synced to storage');
            }
        } catch (error) {
            console.error('❌ Failed to sync drafts:', error);
        }
    };

    const createWorkspaceForAll = async () => {
        const selectedLibraryItems = libraryItems.filter(item => selectedItems.has(item.id));
        console.log('🏗️ Creating workspace for all selected items:', selectedLibraryItems);
        
        // Create a single workspace draft with all selected items
        const workspaceDraft = {
            id: `workspace-draft-${Date.now()}`,
            name: `New Workspace - ${new Date().toLocaleDateString()}`,
            created_at: new Date().toISOString(),
            status: 'draft',
            context_items: selectedLibraryItems,
            target_items: [],
            feedback_config: {},
            agent_configs: []
        };
        
        // Save to localStorage
        const existingDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
        existingDrafts.push(workspaceDraft);
        localStorage.setItem('workspace-drafts', JSON.stringify(existingDrafts));
        
        // Sync to storage
        await syncWorkspaceDrafts(existingDrafts);
        
        alert(`Created workspace draft with ${selectedLibraryItems.length} context items`);
        clearSelection();
        checkExistingWorkspaces(); // Update workspace availability
    };

    const createWorkspaceForEach = async () => {
        const selectedLibraryItems = libraryItems.filter(item => selectedItems.has(item.id));
        console.log('🏗️ Creating workspace for each selected item:', selectedLibraryItems);
        
        // Separate writeable targets from other contexts
        const writeableItems = selectedLibraryItems.filter(item => 
            item.library_metadata?.clone_mode === 'writeable'
        );
        const nonWriteableItems = selectedLibraryItems.filter(item => 
            item.library_metadata?.clone_mode !== 'writeable'
        );
        
        let includeWriteableInEach = false;
        
        // If there's a writeable target and 2+ other contexts, ask about distribution
        if (writeableItems.length > 0 && nonWriteableItems.length >= 2) {
            includeWriteableInEach = window.confirm(
                `You have ${writeableItems.length} writeable target(s) and ${nonWriteableItems.length} other context items selected.\n\n` +
                'Do you want to include the writeable repository in each workspace?\n\n' +
                'OK = Yes, copy writeable repo to each context workspace\n' +
                'Cancel = No, create separate workspaces'
            );
        }
        
        // Create workspace drafts
        const workspaceDrafts: any[] = [];
        
        if (includeWriteableInEach && writeableItems.length > 0) {
            // Create one workspace per non-writeable item, each including the writeable targets
            nonWriteableItems.forEach((item) => {
                const workspaceDraft = {
                    id: `workspace-draft-${Date.now()}-${item.id}`,
                    name: `Workspace: ${item.title}`,
                    created_at: new Date().toISOString(),
                    status: 'draft',
                    context_items: [item, ...writeableItems],
                    target_items: [],
                    feedback_config: {},
                    agent_configs: []
                };
                workspaceDrafts.push(workspaceDraft);
            });
            
            // Don't create separate workspaces for writeable items when distributed
        } else {
            // Create one workspace per selected item (original behavior)
            selectedLibraryItems.forEach((item) => {
                const workspaceDraft = {
                    id: `workspace-draft-${Date.now()}-${item.id}`,
                    name: `Workspace: ${item.title}`,
                    created_at: new Date().toISOString(),
                    status: 'draft',
                    context_items: [item],
                    target_items: [],
                    feedback_config: {},
                    agent_configs: []
                };
                workspaceDrafts.push(workspaceDraft);
            });
        }
        
        // Save to localStorage
        const existingDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
        existingDrafts.push(...workspaceDrafts);
        localStorage.setItem('workspace-drafts', JSON.stringify(existingDrafts));
        
        // Sync to storage
        await syncWorkspaceDrafts(existingDrafts);
        
        alert(`Created ${workspaceDrafts.length} workspace drafts`);
        clearSelection();
        checkExistingWorkspaces(); // Update workspace availability
    };

    const loadAvailableWorkspaces = async () => {
        setLoadingWorkspaces(true);
        try {
            // Load workspace drafts
            const drafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
            
            // Load published workspaces
            let publishedWorkspaces = [];
            try {
                const response = await fetch('/api/context-workflow/workspaces');
                if (response.ok) {
                    const data = await response.json();
                    publishedWorkspaces = data.workspaces || [];
                }
            } catch (error) {
                console.warn('Could not load published workspaces:', error);
            }
            
            setAvailableWorkspaces([
                ...drafts.map((draft: any) => ({ ...draft, type: 'draft' })),
                ...publishedWorkspaces.map((workspace: any) => ({ ...workspace, type: 'published' }))
            ]);
        } catch (error) {
            console.error('Failed to load workspaces:', error);
        } finally {
            setLoadingWorkspaces(false);
        }
    };

    const checkExistingWorkspaces = async () => {
        try {
            // Check workspace drafts
            const drafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
            
            // Check published workspaces
            let publishedCount = 0;
            try {
                const response = await fetch('/api/context-workflow/workspaces');
                if (response.ok) {
                    const data = await response.json();
                    publishedCount = data.workspaces?.length || 0;
                }
            } catch (error) {
                console.warn('Could not check published workspaces:', error);
            }
            
            setHasExistingWorkspaces(drafts.length > 0 || publishedCount > 0);
        } catch (error) {
            console.error('Failed to check workspaces:', error);
        }
    };

    const handleAddToExistingWorkspace = async () => {
        await loadAvailableWorkspaces();
        setShowWorkspaceSelector(true);
    };

    const addToWorkspace = async (workspace: any) => {
        const selectedLibraryItems = libraryItems.filter(item => selectedItems.has(item.id));
        
        try {
            if (workspace.type === 'draft') {
                // Add to workspace draft (reference only)
                const updatedWorkspace = {
                    ...workspace,
                    context_items: [...workspace.context_items, ...selectedLibraryItems],
                    last_updated: new Date().toISOString()
                };
                
                // Update in localStorage
                const allDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
                const updatedDrafts = allDrafts.map((draft: any) => 
                    draft.id === workspace.id ? updatedWorkspace : draft
                );
                localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));
                
                // Sync to API
                await fetch('/api/context-workflow/workspace-drafts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'update',
                        workspaceDraft: updatedWorkspace
                    })
                });
                
                alert(`Added ${selectedLibraryItems.length} items to workspace draft "${workspace.name}"`);
                
            } else if (workspace.type === 'published') {
                // Add to published workspace (literal copy to context folder)
                const response = await fetch('/api/context-workflow/workspaces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'add_context',
                        workspace_id: workspace.id,
                        context_items: selectedLibraryItems
                    })
                });
                
                if (response.ok) {
                    alert(`Added ${selectedLibraryItems.length} items to published workspace "${workspace.name}"`);
                } else {
                    throw new Error('Failed to add items to published workspace');
                }
            }
            
            setShowWorkspaceSelector(false);
            clearSelection();
            checkExistingWorkspaces(); // Update workspace availability
            
        } catch (error) {
            console.error('Failed to add items to workspace:', error);
            alert('Failed to add items to workspace. Please try again.');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">📚 Context Library</h3>
                
                {libraryItems.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">
                            {libraryItems.length} items
                        </span>
                        {selectedItems.size > 0 && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {selectedItems.size} selected
                            </span>
                        )}
                        <button
                            onClick={selectedItems.size === libraryItems.length ? clearSelection : selectAll}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            {selectedItems.size === libraryItems.length ? 'Clear All' : 'Select All'}
                        </button>
                    </div>
                )}
            </div>
            
            {/* Workspace Creation Actions */}
            {selectedItems.size > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium text-blue-900">
                            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected:
                        </span>
                        <button
                            onClick={createWorkspaceForAll}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                            🏗️ Make Workspace (All Together)
                        </button>
                        {selectedItems.size > 1 && (
                            <button
                                onClick={createWorkspaceForEach}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                                🏗️ Make Workspace (For Each)
                            </button>
                        )}
                        {hasExistingWorkspaces && (
                            <button
                                onClick={handleAddToExistingWorkspace}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                                📂 Add to Existing Workspace
                            </button>
                        )}
                        <button
                            onClick={clearSelection}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                            ✕ Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Workspace Selector Modal */}
            {showWorkspaceSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Add to Existing Workspace
                            </h3>
                            <button
                                onClick={() => setShowWorkspaceSelector(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4">
                            Select a workspace to add {selectedItems.size} context item{selectedItems.size > 1 ? 's' : ''} to:
                        </p>
                        
                        {loadingWorkspaces ? (
                            <div className="text-center py-8 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                Loading workspaces...
                            </div>
                        ) : availableWorkspaces.length > 0 ? (
                            <div className="space-y-3">
                                {availableWorkspaces.map((workspace) => (
                                    <div
                                        key={`${workspace.type}-${workspace.id}`}
                                        onClick={() => addToWorkspace(workspace)}
                                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-gray-900">{workspace.name}</h4>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        workspace.type === 'draft' 
                                                            ? 'bg-yellow-100 text-yellow-700' 
                                                            : 'bg-green-100 text-green-700'
                                                    }`}>
                                                        {workspace.type === 'draft' ? '📝 Draft' : '🏗️ Published'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {workspace.context_items?.length || 0} context items • 
                                                    Created {new Date(workspace.created_at || workspace.published_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {workspace.type === 'draft' 
                                                        ? 'Items will be added as references (can be updated)' 
                                                        : 'Items will be copied to workspace context folder'}
                                                </div>
                                            </div>
                                            <div className="text-blue-600 hover:text-blue-700">
                                                →
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <div className="text-3xl mb-2">📭</div>
                                <p>No workspaces available</p>
                                <p className="text-sm">Create some workspaces first!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading library...</div>
            ) : libraryItems.length > 0 ? (
                <div>
                    <div className="text-sm text-gray-600 mb-2">
                        🔍 Debug: Rendering {libraryItems.length} items
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {libraryItems.map((item, index) => {
                            console.log(`🔍 Rendering card ${index}:`, item.title, item.id);
                            return (
                                <LibraryCard
                                    key={`${item.id}-${item.library_metadata?.clone_mode || 'default'}`}
                                    item={item}
                                    isSelected={selectedItems.has(item.id)}
                                    onSelect={toggleSelection}
                                    onRemove={removeFromLibrary}
                                />
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">📚</div>
                    <p>No items in library yet</p>
                    <p className="text-sm">Import some content to get started!</p>
                </div>
            )}
            
            {/* Workspace Drafts Section */}
            <WorkspaceDrafts />
        </div>
    );
}