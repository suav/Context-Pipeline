/**
 * Interactive Workspace Card Component
 */
'use client';
import React, { useState, useEffect } from 'react';
import { WorkspaceDraft } from '../types';
import { AgentStatusIndicator } from '@/features/agents/components/AgentStatusIndicator';
import { AgentOverlay } from '@/features/agents/components/AgentOverlay';
import { TerminalModal } from '@/features/agents/components/terminal/TerminalModal';
interface WorkspaceCardProps {
    workspace: WorkspaceDraft;
    onOpenIDE?: (workspaceId: string) => void;
    onOpenFeedback?: (workspaceId: string) => void;
}
interface Agent {
    id: string;
    name: string;
    color: string;
    status: 'active' | 'idle' | 'error';
    created_at: string;
}
export function WorkspaceCard({ workspace, onOpenIDE, onOpenFeedback }: WorkspaceCardProps) {
    const [hoveredContext, setHoveredContext] = useState<string | null>(null);
    const [showAgents, setShowAgents] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [workspaceStatus, setWorkspaceStatus] = useState<any>(null);
    const [showIDESelector, setShowIDESelector] = useState(false);
    useEffect(() => {
        loadWorkspaceStatus();
        const interval = setInterval(loadWorkspaceStatus, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [workspace.id]);
    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showIDESelector) {
                setShowIDESelector(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showIDESelector]);
    const loadWorkspaceStatus = async () => {
        try {
            // Load workspace status (agents handled by separate components)
            const response = await fetch(`/api/workspaces/${workspace.id}/status`);
            if (response.ok) {
                const data = await response.json();
                setWorkspaceStatus(data.status);
            }
        } catch (error) {
            console.error('Failed to load workspace status:', error);
        }
    };
    const handleIDEOpen = async () => {
        try {
            // Get the absolute file system path for the workspace
            const response = await fetch(`/api/workspaces/${workspace.id}/path`);
            if (response.ok) {
                const data = await response.json();
                const workspacePath = data.absolute_path;
                const workspaceFile = data.workspace_file;
                // Get IDE preference
                const preferredIDE = localStorage.getItem('preferred-ide') || 'vscode';
                // Try to open the .code-workspace file first, then fallback to directory
                if (workspaceFile) {
                    window.open(`${preferredIDE}://file/${workspaceFile}`, '_blank');
                } else {
                    window.open(`${preferredIDE}://file/${workspacePath}`, '_blank');
                }
            } else {
                // Fallback to the old method
                if (onOpenIDE) {
                    onOpenIDE(workspace.id);
                }
            }
        } catch (error) {
            console.error('Failed to open IDE:', error);
            // Fallback to the old method
            if (onOpenIDE) {
                onOpenIDE(workspace.id);
            }
        }
    };
    const handleNewAgent = () => {
        setShowAgents(false);
        setShowTerminal(true);
        setSelectedAgentId(null); // New agent
    };
    const handleAgentClick = (agentId: string) => {
        setShowAgents(false);
        setShowTerminal(true);
        setSelectedAgentId(agentId);
    };
    const handleCloseTerminal = () => {
        setShowTerminal(false);
        setSelectedAgentId(null);
    };
    const handleValidateWorkspace = async () => {
        if (!window.confirm('Validate this workspace?\n\nThis will:\n• Sync draft changes to published workspace\n• Update dynamic context items\n• Create workspace branches for repositories\n• Check for unauthorized changes')) {
            return;
        }
        try {
            const response = await fetch(`/api/workspaces/${workspace.id}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (result.success) {
                const summary = result.summary;
                alert(`✅ Workspace validated successfully!\n\n` +
                      `📄 Context items synced: ${summary.context_items_synced}\n` +
                      `🔄 Dynamic updates: ${summary.dynamic_updates_scheduled}\n` +
                      `🌿 Repositories processed: ${summary.repositories_processed}\n` +
                      `⚠️ Unauthorized changes: ${summary.unauthorized_changes}`);
                // Refresh workspace status
                loadWorkspaceStatus();
            } else {
                alert(`❌ Validation failed: ${result.error}\n\n${result.details || ''}`);
            }
        } catch (error) {
            console.error('Workspace validation failed:', error);
            alert('❌ Failed to validate workspace. Please try again.');
        }
    };
    const getContextIcon = (item: any) => {
        if (item.source === 'jira') return '🎫';
        if (item.source === 'git') return '📁';
        if (item.source === 'email') return '📧';
        return '📄';
    };
    const getCloneModeIcon = (item: any) => {
        if (item.library_metadata?.clone_mode === 'writeable') return '✏️';
        if (item.library_metadata?.clone_mode === 'read-only') return '👁️';
        return null;
    };
    
    const handleUnpublishWorkspace = async () => {
        const mode = window.confirm(
            `Unpublish workspace "${workspace.name}"?\n\n` +
            `Choose how to handle the workspace:\n\n` +
            `• OK = Convert to Draft (keeps workspace available for editing and re-publishing)\n` +
            `• Cancel = Archive Only (permanently removes from active workspace list)\n\n` +
            `Both options will extract workspace memory for evaluation.`
        );
        
        const unpublishMode = mode ? 'draft' : 'archive';
        const actionText = mode ? 'converted to draft' : 'archived';
        
        if (!window.confirm(`Confirm: ${actionText.toUpperCase()} workspace "${workspace.name}"?\n\nThis will:\n• Extract all workspace memory and logs for evaluation\n• Preserve agent conversations and outputs\n• ${mode ? 'Convert workspace back to draft for re-editing' : 'Archive the workspace permanently'}\n• Clean up active workspace resources\n\nThis action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unpublish',
                    workspace_id: workspace.id,
                    mode: unpublishMode
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const memoryNote = result.workspace_memory 
                    ? `\n\n📊 Workspace Memory Extracted:\n` +
                      `• ${result.workspace_memory.summary.agent_deployments} agents deployed\n` +
                      `• ${result.workspace_memory.summary.total_interactions} interactions recorded\n` +
                      `• ${result.workspace_memory.files.created_files.length} files created\n` +
                      `• ${result.workspace_memory.progress.completion_percentage}% completion reached`
                    : '';
                
                alert(`✅ Workspace "${workspace.name}" ${actionText} successfully!${memoryNote}\n\nArchive location: ${result.archive_path || 'Not specified'}`);
                
                // Refresh the page to update the workspace list
                window.location.reload();
            } else {
                alert(`❌ Failed to ${actionText.split(' ')[0]} workspace: ${result.error}`);
            }
        } catch (error) {
            console.error(`${actionText.split(' ')[0]} workspace failed:`, error);
            alert(`❌ Failed to ${actionText.split(' ')[0]} workspace. Please try again.`);
        }
    };
    const isPublishing = workspace.status === 'publishing';
    
    return (
        <div
            className={`relative border rounded-lg p-4 transition-all ${
                isPublishing 
                    ? 'animate-pulse cursor-not-allowed opacity-75' 
                    : 'hover:shadow-md cursor-pointer'
            }`}
            style={{
                backgroundColor: 'var(--color-card-background)',
                borderColor: isPublishing ? 'var(--color-accent)' : 'var(--color-card-border)',
                borderWidth: isPublishing ? '2px' : '1px',
            }}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                    <h3
                        className="font-semibold text-base mb-1 truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {workspace.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                        <span
                            className={`px-2 py-1 rounded text-xs ${
                                workspace.status === 'published' ? 'bg-green-100 text-green-700' :
                                workspace.status === 'publishing' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                            }`}
                        >
                            {workspace.status}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                            {workspace.context_items.length} items
                        </span>
                    </div>
                </div>
                {/* Agent System */}
                <div className="relative flex-shrink-0 ml-2">
                    <AgentStatusIndicator
                        workspaceId={workspace.id}
                        onClick={() => setShowAgents(!showAgents)}
                    />
                    {showAgents && (
                        <AgentOverlay
                            workspaceId={workspace.id}
                            onClose={() => setShowAgents(false)}
                            onNewAgent={handleNewAgent}
                            onAgentClick={handleAgentClick}
                        />
                    )}
                </div>
            </div>
            {/* Context Items with Hover Details */}
            <div className="mb-3">
                <div
                    className="text-xs font-medium mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    Context Items:
                </div>
                <div className="flex flex-wrap gap-1">
                    {workspace.context_items.slice(0, 8).map((item, index) => (
                        <div
                            key={`${item.id}-${index}`}
                            className="relative"
                            onMouseEnter={() => setHoveredContext(item.id)}
                            onMouseLeave={() => setHoveredContext(null)}
                        >
                            <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                                style={{
                                    backgroundColor: 'var(--color-button-secondary)',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                <span>{getContextIcon(item)}</span>
                                {getCloneModeIcon(item) && <span>{getCloneModeIcon(item)}</span>}
                            </span>
                            {/* Context Hover Detail */}
                            {hoveredContext === item.id && (
                                <div className="absolute bottom-full left-0 mb-2 z-20 pointer-events-none">
                                    <div
                                        className="p-3 rounded shadow-lg text-xs w-64 pointer-events-auto"
                                        style={{
                                            backgroundColor: 'var(--color-surface-elevated)',
                                            borderColor: 'var(--color-border)',
                                            border: '1px solid',
                                        }}
                                    >
                                        <div
                                            className="font-medium mb-1"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {item.title}
                                        </div>
                                        <div
                                            className="mb-2 max-h-16 overflow-y-auto"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {item.preview}
                                        </div>
                                        <div
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {item.source} • {item.library_metadata?.clone_mode || 'context-only'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {workspace.context_items.length > 8 && (
                        <span
                            className="inline-flex items-center px-2 py-1 rounded text-xs"
                            style={{
                                backgroundColor: 'var(--color-text-muted)',
                                color: 'var(--color-text-inverse)',
                            }}
                        >
                            +{workspace.context_items.length - 8}
                        </span>
                    )}
                </div>
            </div>
            {/* Action Buttons - Prioritized by usefulness */}
            <div className="space-y-2">
                {/* Primary Actions Row */}
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <button
                            onClick={isPublishing ? undefined : handleIDEOpen}
                            disabled={isPublishing}
                            className="w-full py-2 px-3 rounded text-sm transition-colors flex items-center justify-center gap-1"
                            style={{
                                backgroundColor: isPublishing ? 'var(--color-button-secondary)' : 'var(--color-success)',
                                color: isPublishing ? 'var(--color-text-muted)' : 'var(--color-text-inverse)',
                                cursor: isPublishing ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <span className="text-xs">{isPublishing ? '⏳' : '⚡'}</span>
                            <span className="font-medium">{isPublishing ? 'Publishing...' : 'Open IDE'}</span>
                        </button>
                        <button
                            onClick={isPublishing ? undefined : () => setShowIDESelector(!showIDESelector)}
                            disabled={isPublishing}
                            className="absolute right-0 top-0 h-full px-2 transition-colors rounded-r text-xs"
                            style={{
                                backgroundColor: isPublishing ? 'var(--color-button-secondary)' : 'var(--color-success-hover)',
                                color: isPublishing ? 'var(--color-text-muted)' : 'var(--color-text-inverse)',
                                cursor: isPublishing ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isPublishing ? '⏳' : '⚙️'}
                        </button>
                        {/* IDE Selector Dropdown */}
                        {showIDESelector && (
                            <div
                                className="absolute top-full left-0 mt-1 w-full border rounded-lg shadow-lg z-10"
                                style={{
                                    backgroundColor: 'var(--color-surface)',
                                    borderColor: 'var(--color-border)',
                                }}
                            >
                                <button
                                    onClick={() => {
                                        localStorage.setItem('preferred-ide', 'vscode');
                                        setShowIDESelector(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    📝 VSCode
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.setItem('preferred-ide', 'cursor');
                                        setShowIDESelector(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    🎯 Cursor
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={isPublishing ? undefined : handleValidateWorkspace}
                        disabled={isPublishing}
                        className="flex-1 py-2 px-3 rounded text-sm transition-colors flex items-center justify-center gap-1"
                        style={{
                            backgroundColor: isPublishing ? 'var(--color-button-secondary)' : 'var(--color-primary)',
                            color: isPublishing ? 'var(--color-text-muted)' : 'var(--color-text-inverse)',
                            cursor: isPublishing ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <span className="text-xs">{isPublishing ? '⏳' : '🔄'}</span>
                        <span className="font-medium">{isPublishing ? 'Publishing...' : 'Validate'}</span>
                    </button>
                </div>
                {/* Secondary Actions Row */}
                <div className="flex gap-2">
                    <button
                        onClick={isPublishing ? undefined : () => onOpenFeedback && onOpenFeedback(workspace.id)}
                        disabled={isPublishing}
                        className="flex-1 py-2 px-3 rounded text-sm transition-colors flex items-center justify-center gap-1"
                        style={{
                            backgroundColor: 'var(--color-button-secondary)',
                            color: isPublishing ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                            cursor: isPublishing ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <span className="text-xs">{isPublishing ? '⏳' : '📊'}</span>
                        <span>{isPublishing ? 'Publishing...' : 'Feedback'}</span>
                    </button>
                    <button
                        onClick={isPublishing ? undefined : handleUnpublishWorkspace}
                        disabled={isPublishing}
                        className="flex-1 py-2 px-3 rounded text-sm transition-colors flex items-center justify-center gap-1"
                        style={{
                            backgroundColor: isPublishing ? 'var(--color-button-secondary)' : 'var(--color-warning)',
                            color: isPublishing ? 'var(--color-text-muted)' : 'var(--color-text-inverse)',
                            cursor: isPublishing ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <span className="text-xs">{isPublishing ? '⏳' : '📤'}</span>
                        <span>{isPublishing ? 'Publishing...' : 'Unpublish'}</span>
                    </button>
                </div>
            </div>
            {/* Status Bar */}
            {workspaceStatus && (
                <div
                    className="mt-3 pt-3 border-t"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                    <div
                        className="flex items-center justify-between text-xs"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        <span>Status: {workspaceStatus.phase || 'Ready'}</span>
                        <span>Progress: {workspaceStatus.progress || 0}%</span>
                    </div>
                    {workspaceStatus.progress > 0 && (
                        <div
                            className="mt-1 w-full rounded-full h-1.5"
                            style={{ backgroundColor: 'var(--color-button-secondary)' }}
                        >
                            <div
                                className="h-1.5 rounded-full transition-all duration-300"
                                style={{
                                    width: `${workspaceStatus.progress}%`,
                                    backgroundColor: 'var(--color-primary)',
                                }}
                            ></div>
                        </div>
                    )}
                </div>
            )}
            {/* Agent Terminal Modal */}
            {showTerminal && (
                <TerminalModal
                    isOpen={showTerminal}
                    workspaceId={workspace.id}
                    selectedAgentId={selectedAgentId || undefined}
                    onClose={handleCloseTerminal}
                />
            )}
        </div>
    );
}