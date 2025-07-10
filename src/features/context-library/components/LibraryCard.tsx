import React from 'react';
import { LibraryItem } from '../types';
interface LibraryCardProps {
    item: LibraryItem;
    isSelected: boolean;
    onSelect: (itemId: string) => void;
    onRemove: (itemId: string) => void;
}
export function LibraryCard({ item, isSelected, onSelect, onRemove }: LibraryCardProps) {
    console.log('🔍 LibraryCard rendering:', item.title, item.id, 'selected:', isSelected);
    const handleCardClick = (e: React.MouseEvent) => {
        // Don't select if clicking on action buttons
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        // Only select if item has valid ID
        if (item.id && typeof item.id === 'string' && item.id !== 'undefined') {
            onSelect(item.id);
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        // Set the data being dragged
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'library-item',
            item: item
        }));
        e.dataTransfer.effectAllowed = 'copy';
        
        // Add a slight opacity to show dragging state
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.7';
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        // Reset opacity
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    };
    const openSource = () => {
        const url = item.metadata?.jira_url ||
                   item.metadata?.html_url ||
                   (item.source === 'git' ? `https://github.com/${item.content?.owner}/${item.content?.repo}/tree/${item.content?.branch || 'main'}` : '');
        if (url) window.open(url, '_blank');
    };
    // Check if this is a dynamic context item that can be refreshed
    const isDynamic = ['jira', 'git', 'email'].includes(item.source);
    const handleRefresh = async () => {
        try {
            const response = await fetch('/api/context-workflow/library/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: item.id,
                    source: item.source,
                    refresh_type: 'update'
                })
            });
            const result = await response.json();
            if (result.success) {
                alert(`${result.message}\n\n${result.note || ''}`);
            } else {
                alert(`Failed to refresh: ${result.error}`);
            }
        } catch (error) {
            console.error('Refresh failed:', error);
            alert('Failed to refresh item data');
        }
    };
    return (
        <div
            onClick={handleCardClick}
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`relative border rounded-lg p-3 bg-white transition-all hover:shadow-md cursor-pointer h-48 flex flex-col ${
                isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
            }`}
            title="Drag to add to workspace draft"
        >
            {/* Clone Mode Badge */}
            <div className="absolute top-2 right-2">
                {item.library_metadata?.clone_mode && (
                    <span className={`text-xs px-2 py-1 rounded ${
                        item.library_metadata.clone_mode === 'writeable'
                            ? 'bg-orange-100 text-orange-700'
                            : item.library_metadata.clone_mode === 'read-only'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                    }`}>
                        {item.library_metadata.clone_mode === 'writeable' ? '✏️' :
                         item.library_metadata.clone_mode === 'read-only' ? '🔍' : '📚'}
                    </span>
                )}
            </div>
            {/* Content */}
            <div className="mt-3 mb-3 flex-grow">
                <h5 className="font-medium text-gray-900 text-sm mb-1 pr-4 line-clamp-2">
                    {item.title}
                </h5>
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {item.preview}
                </p>
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                    {item.tags?.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
            {/* Actions */}
            <div className="flex gap-1">
                <button
                    onClick={openSource}
                    className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                    title="Open Source"
                >
                    🔗
                </button>
                {isDynamic && (
                    <button
                        onClick={handleRefresh}
                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
                        title="Refresh Data"
                    >
                        🔄
                    </button>
                )}
                <button
                    onClick={() => {
                        // Handle invalid items differently
                        if (!item.id || typeof item.id !== 'string' || item.id === 'undefined') {
                            alert('⚠️ This appears to be a corrupted item. Please use the Force Clear tool to remove it.');
                            window.open('/api/force-clear', '_blank');
                        } else {
                            onRemove(item.id);
                        }
                    }}
                    className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                    title="Remove"
                >
                    🗑️
                </button>
            </div>
            {/* Footer */}
            <div className="text-xs text-gray-500 mt-auto pt-2 truncate">
                {item.source} • {new Date(item.library_metadata?.added_at || item.added_at).toLocaleDateString()}
            </div>
        </div>
    );
}