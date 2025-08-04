import React, { useState } from 'react';
import { WorkspaceDraft } from '../types';
interface WorkspaceDraftCardProps {
    draft: WorkspaceDraft;
    isSelected: boolean;
    onSelect: (draftId: string) => void;
    onUpdate: (draftId: string, updates: Partial<WorkspaceDraft>) => void;
    onDelete: (draftId: string) => void;
    onPublish: (draftId: string) => void;
    onClone?: (draftId: string) => void;
    onAddContext?: (draftId: string, item: any) => void;
    onConfigureAgents?: (draftId: string) => void;
    isExpanded?: boolean;
}
export function WorkspaceDraftCard({ draft, isSelected, onSelect, onUpdate, onDelete, onPublish, onClone, onAddContext, onConfigureAgents, isExpanded = false }: WorkspaceDraftCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(draft.name);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const handleNameUpdate = () => {
        onUpdate(draft.id, { name: draftName });
        setIsEditing(false);
    };
    const handleCardClick = (e: React.MouseEvent) => {
        // Don't select if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button') ||
            (e.target as HTMLElement).closest('input') ||
            (e.target as HTMLElement).closest('h4')) {
            return;
        }
        onSelect(draft.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type === 'library-item' && data.item && onAddContext) {
                // Check if item already exists in draft
                const existingItemIds = new Set(draft.context_items.map((item: any) => item.id));
                if (!existingItemIds.has(data.item.id)) {
                    onAddContext(draft.id, data.item);
                }
            }
        } catch (error) {
            console.error('Failed to parse dropped data:', error);
        }
    };
    const getItemIcon = (item: any) => {
        if (item.source === 'jira') return '🎫';
        if (item.source === 'git') return '📁';
        if (item.source === 'email') return '📧';
        if (item.source === 'slack') return '💬';
        return '📄';
    };
    const getCloneModeIcon = (item: any) => {
        if (item.library_metadata?.clone_mode === 'writeable') return '✏️';
        if (item.library_metadata?.clone_mode === 'read-only') return '🔍';
        return '';
    };
    return (
        <div
            onClick={handleCardClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border rounded-lg p-4 bg-white transition-all cursor-pointer h-full flex flex-col ${
                isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : isDragOver
                    ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
            }`}
            title={isDragOver ? 'Drop here to add context item' : undefined}
            >
            {/* Header */}
            <div className={`flex justify-between items-start ${isExpanded ? 'mb-3' : 'mb-2'}`}>
                {isEditing ? (
                    <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={handleNameUpdate}
                        onKeyPress={(e) => e.key === 'Enter' && handleNameUpdate()}
                        className="flex-1 mr-2 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        style={{
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            borderColor: 'var(--color-border)'
                        }}
                        autoFocus
                    />
                ) : (
                    <h4
                        onClick={() => setIsEditing(true)}
                        className="font-medium text-gray-900 text-sm cursor-pointer hover:text-blue-600"
                    >
                        {draft.name}
                    </h4>
                )}
                <span className={`text-xs px-2 py-1 rounded ${
                    draft.status === 'published' ? 'bg-green-100 text-green-700' :
                    draft.status === 'publishing' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                }`}>
                    {draft.status}
                </span>
            </div>
            {/* Context Items */}
            <div className={`${isExpanded ? 'flex-1 mb-3' : 'mb-2'}`}>
                <div className={`text-xs text-gray-600 ${isExpanded ? 'mb-1' : 'mb-1'} flex justify-between items-center`}>
                    <span>Context Items ({draft.context_items.length})</span>
                    {draft.agent_configs && draft.agent_configs.length > 0 && (
                        <span className="text-blue-600 flex items-center gap-1">
                            <span>🤖</span>
                            <span>{draft.agent_configs.length} agent{draft.agent_configs.length !== 1 ? 's' : ''}</span>
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    /* Expanded view with detailed list */
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {draft.context_items.map((item, index) => (
                            <div
                                key={`${item.id}-${index}`}
                                className="bg-gray-50 p-2 rounded border border-gray-200 relative group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm">{getItemIcon(item)}</span>
                                            {getCloneModeIcon(item) && <span className="text-xs">{getCloneModeIcon(item)}</span>}
                                            <span className="font-medium text-xs text-gray-900 truncate">
                                                {item.title}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 line-clamp-1">
                                            {item.preview}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const updatedItems = draft.context_items.filter(i => i.id !== item.id);
                                            onUpdate(draft.id, { context_items: updatedItems });
                                        }}
                                        className="text-red-500 hover:text-red-700 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                        title="Remove item"
                                    >
                                        ❌
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Very compact view with just icons */
                    <div className="flex flex-wrap gap-1 items-center">
                        {draft.context_items.slice(0, 6).map((item, index) => (
                            <div
                                key={`${item.id}-${index}`}
                                className="relative group"
                                onMouseEnter={() => setHoveredItem(item.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                            >
                                <span className="inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs cursor-pointer hover:bg-gray-200">
                                    <span className="text-sm">{getItemIcon(item)}</span>
                                    {getCloneModeIcon(item) && <span className="text-xs">{getCloneModeIcon(item)}</span>}
                                </span>
                                {/* Hover tooltip */}
                                {hoveredItem === item.id && (
                                    <div className="absolute bottom-full left-0 mb-1 z-10 pointer-events-none">
                                        <div className="bg-gray-900 text-white p-2 rounded shadow-lg text-xs w-60 pointer-events-auto">
                                            <div className="font-medium mb-1">{item.title}</div>
                                            <div className="text-gray-300 mb-2 max-h-16 overflow-y-auto">{item.preview}</div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const updatedItems = draft.context_items.filter(i => i.id !== item.id);
                                                    onUpdate(draft.id, { context_items: updatedItems });
                                                }}
                                                className="text-red-400 hover:text-red-300 pointer-events-auto"
                                            >
                                                ❌ Remove
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {draft.context_items.length > 6 && (
                            <span className="text-xs text-gray-500 px-1">+{draft.context_items.length - 6}</span>
                        )}
                        {draft.agent_configs && draft.agent_configs.length > 0 && (
                            <span className="text-xs text-blue-600 ml-2 flex items-center gap-1">
                                <span>🤖</span>
                                <span>{draft.agent_configs.length}</span>
                            </span>
                        )}
                    </div>
                )}
            </div>
            {/* Metadata and Actions */}
            <div className="mt-auto">
                {isExpanded ? (
                    <>
                        <div className="text-xs text-gray-500 mb-3 flex gap-4">
                            {draft.updated_at && (
                                <span>Updated: {new Date(draft.updated_at).toLocaleDateString()}</span>
                            )}
                            <span>Created: {new Date(draft.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {/* Action buttons - only show when expanded */}
                        <div className="border-t pt-2 mt-2 flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPublish(draft.id);
                                }}
                                className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                disabled={draft.status === 'publishing'}
                            >
                                {draft.status === 'publishing' ? '⏳ Publishing...' : '🚀 Publish'}
                            </button>
                            {onConfigureAgents && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onConfigureAgents(draft.id);
                                    }}
                                    className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition-colors"
                                    title="Configure agents"
                                >
                                    🤖
                                </button>
                            )}
                            {onClone && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClone(draft.id);
                                    }}
                                    className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                                    title="Clone draft"
                                >
                                    📋
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(draft.id);
                                }}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-red-100 hover:text-red-700 transition-colors"
                                title="Archive draft"
                            >
                                🗃️
                            </button>
                        </div>
                    </>
                ) : (
                    /* Very compact metadata - just created date */
                    <div className="text-xs text-gray-500">
                        {new Date(draft.created_at).toLocaleDateString()}
                    </div>
                )}
            </div>
        </div>
    );
}