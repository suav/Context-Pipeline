/**
 * Workspace Draft Card Component
 */

import React, { useState } from 'react';
import { WorkspaceDraft } from '../types';

interface WorkspaceDraftCardProps {
    draft: WorkspaceDraft;
    isSelected: boolean;
    onSelect: (draftId: string) => void;
    onUpdate: (draftId: string, updates: Partial<WorkspaceDraft>) => void;
    onDelete: (draftId: string) => void;
    onPublish: (draftId: string) => void;
}

export function WorkspaceDraftCard({ draft, isSelected, onSelect, onUpdate, onDelete, onPublish }: WorkspaceDraftCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(draft.name);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    
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
            className={`border rounded-lg p-4 bg-white transition-all cursor-pointer ${
                isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-gray-300'
            }`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                {isEditing ? (
                    <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={handleNameUpdate}
                        onKeyPress={(e) => e.key === 'Enter' && handleNameUpdate()}
                        className="flex-1 mr-2 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1">Context Items:</div>
                <div className="flex flex-wrap gap-2">
                    {draft.context_items.map((item, index) => (
                        <div 
                            key={`${item.id}-${index}`}
                            className="relative group"
                            onMouseEnter={() => setHoveredItem(item.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                        >
                            <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs cursor-pointer hover:bg-gray-200">
                                <span>{getItemIcon(item)}</span>
                                {getCloneModeIcon(item) && <span>{getCloneModeIcon(item)}</span>}
                            </span>
                            
                            {/* Hover tooltip */}
                            {hoveredItem === item.id && (
                                <div className="absolute bottom-full left-0 mb-1 z-10 pointer-events-none">
                                    <div className="bg-gray-900 text-white p-3 rounded shadow-lg text-xs w-80 pointer-events-auto">
                                        <div className="font-medium mb-2">{item.title}</div>
                                        <div className="text-gray-300 mb-3 max-h-32 overflow-y-auto">{item.preview}</div>
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
                </div>
            </div>
            
            {/* Metadata */}
            <div className="text-xs text-gray-500 mb-3">
                Created: {new Date(draft.created_at).toLocaleDateString()}
            </div>
            
        </div>
    );
}