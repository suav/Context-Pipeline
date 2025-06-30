/**
 * Workspace Drafts Component
 */

'use client';

import React, { useState, useEffect } from 'react';
import { WorkspaceDraftCard } from './WorkspaceDraftCard';
import { WorkspaceDraft } from '../types';

export function WorkspaceDrafts() {
    const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
    const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
    
    useEffect(() => {
        loadDrafts();
        
        // Listen for storage changes (from other components)
        const handleStorageChange = () => {
            loadDrafts();
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Also check periodically for local changes
        const interval = setInterval(loadDrafts, 2000);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);
    
    const loadDrafts = () => {
        try {
            const storedDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
            setDrafts(storedDrafts);
            
            // Sync to file system if there are drafts
            if (storedDrafts.length > 0) {
                syncDraftsToStorage(storedDrafts);
            }
        } catch (error) {
            console.error('Failed to load workspace drafts:', error);
        }
    };
    
    const syncDraftsToStorage = async (draftsToSync: WorkspaceDraft[]) => {
        try {
            const response = await fetch('/api/workspace-drafts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sync',
                    drafts: draftsToSync
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ Drafts synced to storage:', result.message);
            }
        } catch (error) {
            console.error('❌ Failed to sync drafts to storage:', error);
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
        syncDraftsToStorage(updatedDrafts);
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
                    syncDraftsToStorage(updatedDrafts);
                    
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
        
        try {
            // Create workspace manifest
            const manifest = {
                workspace_id: draft.id,
                created: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                total_items: draft.context_items.length,
                context_items: draft.context_items.map((item, index) => ({
                    id: `ctx-${index + 1}`,
                    type: item.source,
                    title: item.title,
                    description: item.preview,
                    content_file: `context/${item.source}/${item.id}.json`,
                    preview: item.preview,
                    metadata: item.metadata || {},
                    tags: item.tags || [],
                    added_at: item.added_at,
                    size_bytes: item.size_bytes
                })),
                context_summary: `Workspace contains ${draft.context_items.length} context items`
            };
            
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
                alert(`Workspace "${draft.name}" has been published!\n\nLocation: ${result.workspace_path}`);
            } else {
                throw new Error(result.error || 'Failed to publish');
            }
            
        } catch (error) {
            console.error('Failed to publish workspace:', error);
            updateDraft(draftId, { status: 'draft' });
            
            // Show detailed error information
            const errorMsg = error instanceof Error ? error.message : String(error);
            alert(`Failed to publish workspace: ${errorMsg}\n\nCheck the browser console for more details.`);
        }
    };
    
    const publishSelected = () => {
        selectedDrafts.forEach(draftId => {
            publishDraft(draftId);
        });
        setSelectedDrafts(new Set());
    };
    
    const deleteSelected = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedDrafts.size} workspace draft(s)?`)) {
            const updatedDrafts = drafts.filter(draft => !selectedDrafts.has(draft.id));
            localStorage.setItem('workspace-drafts', JSON.stringify(updatedDrafts));
            setDrafts(updatedDrafts);
            syncDraftsToStorage(updatedDrafts);
            setSelectedDrafts(new Set());
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
        return null;
    }
    
    return (
        <div className="mt-8 border-t pt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">🏗️ Workspace Drafts</h3>
                
                {selectedDrafts.size > 0 && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                            {selectedDrafts.size} selected
                        </span>
                        <button
                            onClick={publishSelected}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                            🚀 Publish Selected
                        </button>
                        <button
                            onClick={deleteSelected}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                            🗑️ Delete Selected
                        </button>
                        <button
                            onClick={() => setSelectedDrafts(new Set())}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                            Clear Selection
                        </button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map(draft => (
                    <WorkspaceDraftCard
                        key={draft.id}
                        draft={draft}
                        isSelected={selectedDrafts.has(draft.id)}
                        onSelect={toggleDraftSelection}
                        onUpdate={updateDraft}
                        onDelete={archiveDraft}
                        onPublish={publishDraft}
                    />
                ))}
            </div>
        </div>
    );
}