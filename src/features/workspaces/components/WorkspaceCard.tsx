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
        if (item.library_metadata?.clone_mode === 'read-only') return '🔍';
        return '';
    };
    
    return (
        <div className="relative border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-1">{workspace.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className={`px-2 py-1 rounded text-xs ${
                            workspace.status === 'published' ? 'bg-green-100 text-green-700' :
                            workspace.status === 'publishing' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                        }`}>
                            {workspace.status}
                        </span>
                        <span>•</span>
                        <span>{workspace.context_items.length} context items</span>
                    </div>
                </div>
                
                {/* Agent System */}
                <div className="relative">
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
            <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Context Items:</div>
                <div className="flex flex-wrap gap-2">
                    {workspace.context_items.map((item, index) => (
                        <div 
                            key={`${item.id}-${index}`}
                            className="relative"
                            onMouseEnter={() => setHoveredContext(item.id)}
                            onMouseLeave={() => setHoveredContext(null)}
                        >
                            <span className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                                <span>{getContextIcon(item)}</span>
                                {getCloneModeIcon(item) && <span>{getCloneModeIcon(item)}</span>}
                            </span>
                            
                            {/* Context Hover Detail */}
                            {hoveredContext === item.id && (
                                <div className="absolute bottom-full left-0 mb-2 z-20 pointer-events-none">
                                    <div className="bg-gray-900 text-white p-3 rounded shadow-lg text-xs w-72 pointer-events-auto">
                                        <div className="font-medium mb-1">{item.title}</div>
                                        <div className="text-gray-300 mb-2 max-h-20 overflow-y-auto">{item.preview}</div>
                                        <div className="text-gray-400 text-xs">
                                            {item.source} • {item.library_metadata?.clone_mode || 'context-only'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 mb-2">
                <button
                    onClick={handleValidateWorkspace}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                    <span>🔄</span>
                    Validate Workspace
                </button>
            </div>
            
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <button
                        onClick={handleIDEOpen}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <span>⚡</span>
                        Open in {localStorage.getItem('preferred-ide') === 'cursor' ? 'Cursor' : 'VSCode'}
                    </button>
                    <button
                        onClick={() => setShowIDESelector(!showIDESelector)}
                        className="absolute right-0 top-0 h-full px-2 bg-green-700 hover:bg-green-800 text-white rounded-r-lg text-xs transition-colors"
                    >
                        ⚙️
                    </button>
                    
                    {/* IDE Selector Dropdown */}
                    {showIDESelector && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                                onClick={() => {
                                    localStorage.setItem('preferred-ide', 'vscode');
                                    setShowIDESelector(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
                            >
                                📝 VSCode
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('preferred-ide', 'cursor');
                                    setShowIDESelector(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
                            >
                                🎯 Cursor
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => onOpenFeedback && onOpenFeedback(workspace.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                    <span>📊</span>
                    View Feedback
                </button>
            </div>
            
            {/* Status Bar */}
            {workspaceStatus && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Status: {workspaceStatus.phase || 'Ready'}</span>
                        <span>Progress: {workspaceStatus.progress || 0}%</span>
                    </div>
                    {workspaceStatus.progress > 0 && (
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${workspaceStatus.progress}%` }}
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