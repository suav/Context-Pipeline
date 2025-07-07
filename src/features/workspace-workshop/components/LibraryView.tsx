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
}

export function LibraryView({ onClose, onWorkspaceCreated }: LibraryViewProps) {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [hasExistingWorkspaces, setHasExistingWorkspaces] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showArchiveManager, setShowArchiveManager] = useState(false);
  
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
      const response = await fetch('/api/context-library');
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

  const handleItemClick = (item: LibraryItem) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(item.id)) {
      newSelection.delete(item.id);
    } else {
      newSelection.add(item.id);
    }
    setSelectedItems(newSelection);
  };

  const handleCreateWorkspace = async (mode: 'all-together' | 'individual') => {
    if (selectedItems.size === 0) return;

    const selectedItemsArray = libraryItems.filter(item => selectedItems.has(item.id));
    
    try {
      if (mode === 'all-together') {
        // Create a single workspace with all selected items
        const response = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Workspace - ${selectedItemsArray.length} items`,
            description: 'Created from library selection',
            contextItems: selectedItemsArray,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          onWorkspaceCreated?.(result.workspace.id);
          onClose();
        }
      } else {
        // Create individual workspaces for each selected item
        for (const item of selectedItemsArray) {
          await fetch('/api/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Workspace - ${item.title}`,
              description: item.description || 'Created from library item',
              contextItems: [item],
            }),
          });
        }
        onClose();
      }
      
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  const handleImportComplete = (newItems: LibraryItem[]) => {
    setLibraryItems(prev => [...prev, ...newItems]);
    setShowImportModal(false);
  };

  // Filter logic
  const filteredItems = libraryItems.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;

    return matchesSearch && matchesType && matchesSource && matchesPriority;
  });

  const getUniqueValues = (key: keyof LibraryItem) => {
    const values = libraryItems.map(item => item[key]).filter(Boolean);
    return [...new Set(values)];
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const selectAll = () => {
    const allIds = new Set(filteredItems.map(item => item.id));
    setSelectedItems(allIds);
  };

  const createWorkspaceForAll = async () => {
    await handleCreateWorkspace('all-together');
  };

  const createWorkspaceForEach = async () => {
    await handleCreateWorkspace('individual');
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
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1 rounded-lg border transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span>←</span>
            <span className="text-sm">Back to Workshop</span>
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            📚 Context Library
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Workspace Creation Actions */}
      {selectedItems.size > 0 && (
        <div 
          className="p-3 border-b"
          style={{ 
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-primary-alpha)',
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected:
            </span>
            <button
              onClick={createWorkspaceForAll}
              className="flex items-center gap-1 px-3 py-1 rounded-lg border transition-colors text-sm"
              style={{
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              <span>🏗️</span>
              <span>Make Workspace (All Together)</span>
            </button>
            {selectedItems.size > 1 && (
              <button
                onClick={createWorkspaceForEach}
                className="flex items-center gap-1 px-3 py-1 rounded-lg border transition-colors text-sm"
                style={{
                  backgroundColor: 'var(--color-success)',
                  borderColor: 'var(--color-success)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                <span>🏗️</span>
                <span>Make Workspace (For Each)</span>
              </button>
            )}
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 px-3 py-1 rounded-lg border transition-colors text-sm"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>✕</span>
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

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
          
          <div className="mt-2 flex items-center justify-between text-sm">
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Showing {filteredItems.length} of {libraryItems.length} items
            </span>
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


      {/* Library Items */}
      <div className="flex-1 overflow-hidden">
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
          <div className="p-4" style={{ height: '300px' }}>
            {/* Horizontal Scrollable Cards Container */}
            <div className="relative h-full">
              <div 
                className="overflow-x-auto overflow-y-hidden h-full"
                style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--color-border) var(--color-surface)',
                }}
              >
                <div className="flex gap-4 pb-4 h-full" style={{ width: 'max-content' }}>
                  {filteredItems.map((item) => (
                    <div key={item.id} className="flex-shrink-0" style={{ width: '280px', height: '100%' }}>
                      <LibraryCard
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        onClick={() => handleItemClick(item)}
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

      {/* Workspace Drafts Section */}
      <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <WorkspaceDrafts />
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
    </div>
  );
}