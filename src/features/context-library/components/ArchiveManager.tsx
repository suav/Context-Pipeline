/**
 * Archive Manager Component
 *
 * Manages archived workspaces and drafts with restore capabilities
 */
'use client';
import React, { useState, useEffect } from 'react';
interface ArchiveManagerProps {
    isOpen: boolean;
    onClose: () => void;
}
export function ArchiveManager({ isOpen, onClose }: ArchiveManagerProps) {
    const [archives, setArchives] = useState<any>({ workspaces: [], drafts: [], removals: [], other: [] });
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useState<'workspaces' | 'drafts' | 'removals' | 'other'>('workspaces');
    useEffect(() => {
        if (isOpen) {
            loadArchives();
        }
    }, [isOpen]);
    const loadArchives = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/context-workflow/archives');
            const result = await response.json();
            if (result.success) {
                setArchives(result.archives);
            } else {
                console.error('Failed to load archives:', result.error);
            }
        } catch (error) {
            console.error('Failed to load archives:', error);
        } finally {
            setLoading(false);
        }
    };
    const restoreItem = async (archiveFile: string, targetType: 'draft' | 'published') => {
        try {
            const response = await fetch('/api/context-workflow/archives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'restore',
                    archiveFile,
                    targetType
                })
            });
            const result = await response.json();
            if (result.success) {
                alert(`✅ ${result.message}`);
                loadArchives(); // Refresh the list
            } else {
                alert(`❌ Failed to restore: ${result.error}`);
            }
        } catch (error) {
            console.error('Restore failed:', error);
            alert('❌ Failed to restore item');
        }
    };
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };
    const tabs = [
        { key: 'workspaces', label: '🏗️ Workspaces', count: archives.workspaces.length },
        { key: 'drafts', label: '📝 Drafts', count: archives.drafts.length },
        { key: 'removals', label: '🗑️ Removals', count: archives.removals.length },
        { key: 'other', label: '📦 Other', count: archives.other.length }
    ];
    const renderArchiveItem = (archive: any) => {
        if (archive.action === 'force_remove_item') {
            return (
                <div key={archive.filename} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">Item Removal</h4>
                        <span className="text-xs text-gray-500">{formatDate(archive.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                        Item ID: <code className="bg-gray-200 px-1 rounded">{archive.itemId}</code>
                    </p>
                    <p className="text-sm text-gray-600">
                        Removed from: {archive.removedFrom?.join(', ') || 'unknown'}
                    </p>
                </div>
            );
        }
        const originalData = archive.original_data;
        const isWorkspace = archive.type === 'workspace';
        return (
            <div key={archive.filename} className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                            {originalData.name}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                            {originalData.context_items?.length || 0} context items
                            {isWorkspace && ` • ${originalData.agents?.length || 0} agents`}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Archived: {formatDate(archive.timestamp)}</span>
                            <span>•</span>
                            <span>Reason: {archive.reason}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => restoreItem(archive.filename, 'draft')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            title="Restore as Draft"
                        >
                            📝 Draft
                        </button>
                        {archive.restoration_info?.can_restore && (
                            <button
                                onClick={() => restoreItem(archive.filename, 'published')}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                title="Restore as Published"
                            >
                                🏗️ Publish
                            </button>
                        )}
                    </div>
                </div>
                {/* Context Dependencies */}
                {archive.restoration_info?.dependencies?.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                        <strong>Dependencies:</strong> {archive.restoration_info.dependencies.length} context items
                    </div>
                )}
            </div>
        );
    };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />
            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] max-w-6xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">📦 Archive Manager</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        ✕
                    </button>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 px-6">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setSelectedTab(tab.key as any)}
                                className={`px-4 py-3 border-b-2 transition-colors text-sm font-medium ${
                                    selectedTab === tab.key
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>
                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                <p className="text-gray-500">Loading archives...</p>
                            </div>
                        ) : archives[selectedTab].length > 0 ? (
                            <div className="space-y-4">
                                {archives[selectedTab].map(renderArchiveItem)}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-2">📭</div>
                                <p className="text-gray-500">No {selectedTab} in archive</p>
                                <p className="text-sm text-gray-400">
                                    {selectedTab === 'workspaces' && 'Archived workspaces will appear here'}
                                    {selectedTab === 'drafts' && 'Archived workspace drafts will appear here'}
                                    {selectedTab === 'removals' && 'Records of removed items will appear here'}
                                    {selectedTab === 'other' && 'Other archived items will appear here'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div className="flex justify-between items-center text-sm text-gray-600">
                        <span>
                            Total archives: {archives.workspaces.length + archives.drafts.length + archives.removals.length + archives.other.length}
                        </span>
                        <button
                            onClick={loadArchives}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}