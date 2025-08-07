/**
 * Workspace Drafts Component
 */
'use client';
import React, { useState, useEffect } from 'react';
import { WorkspaceDraftCard } from './WorkspaceDraftCard';
import { AgentConfigurationModal } from './AgentConfigurationModal';
import { WorkspaceDraft } from '../types';

interface WorkspaceDraftsProps {
    onApplyContextToDrafts?: (selectedDraftIds: string[]) => void;
    selectedLibraryItems?: Set<string>;
    libraryItems?: any[];
    viewMode?: 'split' | 'library-fullscreen' | 'drafts-fullscreen';
    isApplyToWorkspacesMode?: boolean;
    onExitApplyToWorkspacesMode?: () => void;
}

export function WorkspaceDrafts({ 
    onApplyContextToDrafts, 
    selectedLibraryItems = new Set(), 
    libraryItems = [],
    viewMode = 'split',
    isApplyToWorkspacesMode = false,
    onExitApplyToWorkspacesMode
}: WorkspaceDraftsProps = {}) {
    const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
    const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
    const [showAgentConfig, setShowAgentConfig] = useState(false);
    const [agentConfigDraft, setAgentConfigDraft] = useState<WorkspaceDraft | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    
    useEffect(() => {
        loadDrafts();
        // Listen for storage changes (from other components)
        const handleStorageChange = () => {
            loadDrafts();
        };
        window.addEventListener('storage', handleStorageChange);
        // Check periodically for local changes (reduced frequency)
        const interval = setInterval(loadDrafts, 10000); // Changed from 2000 to 10000ms (10 seconds)
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);
    const loadDrafts = () => {
        try {
            const storedDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
            setDrafts(storedDrafts);
            // Sync to file system if there are drafts and not already syncing
            if (storedDrafts.length > 0 && !isSyncing) {
                syncDraftsToStorage(storedDrafts);
            }
        } catch (error) {
            console.error('Failed to load workspace drafts:', error);
        }
    };
    
    const syncDraftsToStorage = async (draftsToSync: WorkspaceDraft[]) => {
        if (isSyncing) {
            console.log('⏳ Sync already in progress, skipping...');
            return;
        }
        
        setIsSyncing(true);
        try {
            const response = await fetch('/api/workspace-drafts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sync',
                    drafts: draftsToSync
                }),
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ Drafts synced to storage:', result.message);
            } else {
                throw new Error(result.error || 'Unknown sync error');
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'TimeoutError') {
                console.error('❌ Sync timeout - server may be overloaded');
            } else {
                console.error('❌ Failed to sync drafts to storage:', error);
            }
        } finally {
            setIsSyncing(false);
        }
    };
    const updateDraft = (draftId: string, updates: Partial<WorkspaceDraft>) => {
        const updatedDrafts = drafts.map(draft =>
            draft.id === draftId
                ? { ...draft, ...updates, updated_at: new Date().toISOString() }
                : draft
        );
        localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));
        setDrafts(updatedDrafts);
        // Only sync if not already syncing
        if (!isSyncing) {
            syncDraftsToStorage(updatedDrafts);
        }
    };
    const addContextToDraft = (draftId: string, item: any) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft) return;
        
        // Check if item already exists
        const existingItemIds = new Set(draft.context_items.map((contextItem: any) => contextItem.id));
        if (existingItemIds.has(item.id)) {
            return; // Item already exists, don't add duplicate
        }
        
        // Add the item to the draft's context
        const updatedItems = [...draft.context_items, item];
        updateDraft(draftId, { context_items: updatedItems });
    };

    const configureAgents = (draftId: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft) return;
        
        setAgentConfigDraft(draft);
        setShowAgentConfig(true);
    };
    const cloneDraft = (draftId: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft) return;
        
        const clonedDraft = {
            ...draft,
            id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: `${draft.name} (Copy)`,
            status: 'draft' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const updatedDrafts = [...drafts, clonedDraft];
        localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));
        setDrafts(updatedDrafts);
        if (!isSyncing) {
            syncDraftsToStorage(updatedDrafts);
        }
    };
    const archiveDraft = async (draftId: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft) return;
        const confirmMessage = `Archive workspace draft "${draft.name}"?\n\nThis will:\n• Remove it from your active drafts\n• Preserve complete history in archives\n• Allow future restoration\n\nContinue?`;
        if (window.confirm(confirmMessage)) {
            try {
                // Archive the draft
                const response = await fetch('/api/context-workflow/archives', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'archive_draft',
                        draft,
                        reason: 'manual_archive'
                    })
                });
                const result = await response.json();
                if (result.success) {
                    // Remove from active drafts
                    const updatedDrafts = drafts.filter(draft => draft.id !== draftId);
                    localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));
                    setDrafts(updatedDrafts);
                    if (!isSyncing) {
                        syncDraftsToStorage(updatedDrafts);
                    }
                    // Remove from selection if selected
                    setSelectedDrafts(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(draftId);
                        return newSet;
                    });
                    alert(`✅ "${draft.name}" has been archived and can be restored later.`);
                } else {
                    alert(`❌ Failed to archive: ${result.error}`);
                }
            } catch (error) {
                console.error('Failed to archive draft:', error);
                alert('❌ Failed to archive workspace draft');
            }
        }
    };
    const publishDraft = async (draftId: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (!draft) return;
        
        // Update status to publishing
        updateDraft(draftId, { status: 'publishing' });
        
        // Create a temporary workspace entry that appears in the sidebar immediately
        const publishingWorkspace = {
            ...draft,
            status: 'publishing',
            published_at: new Date().toISOString(),
            workspace_path: null
        };
        
        // Add the publishing workspace to the sidebar immediately
        // This is handled by the parent component's workspace list refresh
        
        try {
            // Send to API to create actual workspace
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'publish',
                    workspaceDraft: draft
                })
            });
            const result = await response.json();
            if (result.success) {
                updateDraft(draftId, { status: 'published' });
                
                // Trigger a workspace list refresh to show the completed workspace
                window.dispatchEvent(new CustomEvent('workspace-published', { 
                    detail: { 
                        workspaceId: draft.id, 
                        workspacePath: result.workspace_path 
                    } 
                }));
                
                // Show success notification
                alert(`✅ Workspace "${draft.name}" published successfully!\n\n📁 Location: ${result.workspace_path}\n\n🚀 The workspace now appears in your sidebar.`);
            } else {
                throw new Error(result.error || 'Failed to publish');
            }
        } catch (error) {
            console.error('Failed to publish workspace:', error);
            updateDraft(draftId, { status: 'draft' });
            
            // Remove from sidebar if it was added
            window.dispatchEvent(new CustomEvent('workspace-publish-failed', { 
                detail: { workspaceId: draft.id } 
            }));
            
            // Show detailed error information
            const errorMsg = error instanceof Error ? error.message : String(error);
            alert(`❌ Failed to publish workspace: ${errorMsg}\n\nCheck the browser console for more details.`);
        }
    };
    const publishSelected = () => {
        selectedDrafts.forEach(draftId => {
            publishDraft(draftId);
        });
        setSelectedDrafts(new Set());
    };
    const archiveSelected = async () => {
        if (window.confirm(`Archive ${selectedDrafts.size} workspace draft(s)?`)) {
            for (const draftId of selectedDrafts) {
                await archiveDraft(draftId);
            }
            setSelectedDrafts(new Set());
        }
    };
    const deleteSelected = () => {
        const confirmed = window.confirm(`Are you sure you want to delete ${selectedDrafts.size} workspace draft(s)?\n\nThis will permanently remove them without archiving.`);
        if (confirmed) {
            const updatedDrafts = drafts.filter(draft => !selectedDrafts.has(draft.id));
            localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));
            setDrafts(updatedDrafts);
            if (!isSyncing) {
                syncDraftsToStorage(updatedDrafts);
            }
            setSelectedDrafts(new Set());
        } else {
            // If they declined deletion, offer archiving instead
            if (window.confirm(`Would you like to archive these ${selectedDrafts.size} workspace draft(s) instead?`)) {
                archiveSelected();
            }
        }
    };
    const toggleDraftSelection = (draftId: string) => {
        setSelectedDrafts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(draftId)) {
                newSet.delete(draftId);
            } else {
                newSet.add(draftId);
            }
            return newSet;
        });
    };
    if (drafts.length === 0) {
        return (
            <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        🏗️ Workspace Drafts
                    </h3>
                </div>
                <div 
                    className="text-center py-6 rounded-lg"
                    style={{ 
                        backgroundColor: 'var(--color-surface-elevated)',
                        color: 'var(--color-text-secondary)'
                    }}
                >
                    <div className="text-2xl mb-2">📝</div>
                    <p style={{ color: 'var(--color-text-primary)' }}>No workspace drafts yet</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Select context items above and click "Make Workspace" to create drafts
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="p-3 border-t relative" style={{ borderColor: 'var(--color-border)' }}>
            {/* Compact title as overlay in top-left */}
            <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
                <h3 className="text-sm font-semibold px-2 py-1 rounded" style={{ 
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)'
                }}>
                    🏗️ Workspace Drafts
                </h3>
                {isApplyToWorkspacesMode && (
                    <div className="flex items-center gap-1">
                        <span 
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                                backgroundColor: 'var(--color-accent)',
                                color: 'var(--color-text-inverse)'
                            }}
                        >
                            📋 Apply: {selectedLibraryItems.size} item{selectedLibraryItems.size !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={onExitApplyToWorkspacesMode}
                            className="px-1 py-1 rounded text-xs transition-colors"
                            style={{
                                backgroundColor: 'var(--color-surface-elevated)',
                                color: 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>
            
            {/* Action buttons as overlay in top-right */}
            {selectedDrafts.size > 0 && (
                <div className="absolute top-2 right-3 z-10 flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded" style={{ 
                        color: 'var(--color-text-secondary)',
                        backgroundColor: 'var(--color-surface-elevated)',
                        border: '1px solid var(--color-border)'
                    }}>
                        {selectedDrafts.size} selected
                    </span>
                    {onApplyContextToDrafts && selectedLibraryItems.size > 0 && (
                        <button
                            onClick={() => {
                                onApplyContextToDrafts(Array.from(selectedDrafts));
                                if (isApplyToWorkspacesMode && onExitApplyToWorkspacesMode) {
                                    onExitApplyToWorkspacesMode();
                                }
                            }}
                            className="px-2 py-1 rounded text-xs transition-colors"
                            style={{
                                backgroundColor: 'var(--color-accent)',
                                color: 'var(--color-text-inverse)'
                            }}
                            title={`Apply ${selectedLibraryItems.size} selected library item(s) to ${selectedDrafts.size} workspace draft(s)`}
                        >
                            📋 Apply ({selectedLibraryItems.size})
                        </button>
                    )}
                    {!isApplyToWorkspacesMode && (
                        <>
                            <button
                                onClick={publishSelected}
                                className="px-2 py-1 rounded text-xs transition-colors"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'var(--color-text-inverse)'
                                }}
                            >
                                🚀 Publish
                            </button>
                            <button
                                onClick={archiveSelected}
                                className="px-2 py-1 rounded text-xs transition-colors"
                                style={{
                                    backgroundColor: 'var(--color-warning)',
                                    color: 'var(--color-text-inverse)'
                                }}
                            >
                                🗃️ Archive
                            </button>
                            <button
                                onClick={deleteSelected}
                                className="px-2 py-1 rounded text-xs transition-colors"
                                style={{
                                    backgroundColor: 'var(--color-danger)',
                                    color: 'var(--color-text-inverse)'
                                }}
                            >
                                🗑️ Delete
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setSelectedDrafts(new Set())}
                        className="text-xs px-1 py-1 transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        ✕
                    </button>
                </div>
            )}
            
            {/* Spacer for overlays */}
            <div style={{ height: '36px' }}></div>
            {/* Drafts Container - Layout changes based on view mode */}
            <div className="overflow-hidden" style={{ 
                height: viewMode === 'drafts-fullscreen' ? '600px' : 
                       viewMode === 'split' ? '220px' : '350px'
            }}>
                {viewMode === 'drafts-fullscreen' ? (
                    /* Grid Layout for Fullscreen - 2 cards high */
                    <div 
                        className="overflow-y-auto h-full"
                        style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'var(--color-border) var(--color-surface)',
                        }}
                    >
                        <div className="grid gap-4 pb-4" style={{ 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gridAutoRows: '320px'
                        }}>
                            {drafts.map(draft => (
                                <div key={draft.id}>
                                    <WorkspaceDraftCard
                                        draft={draft}
                                        isSelected={selectedDrafts.has(draft.id)}
                                        onSelect={toggleDraftSelection}
                                        onUpdate={updateDraft}
                                        onDelete={archiveDraft}
                                        onPublish={publishDraft}
                                        onClone={cloneDraft}
                                        onAddContext={addContextToDraft}
                                        onConfigureAgents={configureAgents}
                                        isExpanded={true}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Horizontal Scroll Layout for Split/Library Views */
                    <div 
                        className="overflow-x-auto overflow-y-hidden h-full"
                        style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'var(--color-border) var(--color-surface)',
                        }}
                    >
                        <div className="flex gap-4 pb-4 h-full" style={{ width: 'max-content' }}>
                            {drafts.map(draft => (
                                <div 
                                    key={draft.id} 
                                    className="flex-shrink-0" 
                                    style={{ 
                                        width: '300px', 
                                        height: viewMode === 'split' ? '200px' : '330px'
                                    }}
                                >
                                    <WorkspaceDraftCard
                                        draft={draft}
                                        isSelected={selectedDrafts.has(draft.id)}
                                        onSelect={toggleDraftSelection}
                                        onUpdate={updateDraft}
                                        onDelete={archiveDraft}
                                        onPublish={publishDraft}
                                        onClone={cloneDraft}
                                        onAddContext={addContextToDraft}
                                        onConfigureAgents={configureAgents}
                                        isExpanded={viewMode === 'library-fullscreen'}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Agent Configuration Modal */}
            {showAgentConfig && agentConfigDraft && (
                <AgentConfigurationModal
                    isOpen={showAgentConfig}
                    onClose={() => {
                        setShowAgentConfig(false);
                        setAgentConfigDraft(null);
                    }}
                    draft={agentConfigDraft}
                    onUpdate={updateDraft}
                />
            )}
        </div>
    );
}