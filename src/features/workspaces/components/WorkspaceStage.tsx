/**
 * Workspace Stage Component - Full workspace management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { WorkspaceDraft } from '../types';
import { WorkspaceCard } from './WorkspaceCard';

export function WorkspaceStage() {
    const [publishedWorkspaces, setPublishedWorkspaces] = useState<WorkspaceDraft[]>([]);
    const [activeWorkspaces, setActiveWorkspaces] = useState<WorkspaceDraft[]>([]);
    
    useEffect(() => {
        loadWorkspaces();
    }, []);
    
    const loadWorkspaces = async () => {
        try {
            // Load published workspaces from API
            const response = await fetch('/api/workspaces');
            if (response.ok) {
                const data = await response.json();
                setPublishedWorkspaces(data.workspaces || []);
                
                // Filter active vs published based on agent activity
                const active = data.workspaces?.filter((w: any) => w.active_agents > 0) || [];
                setActiveWorkspaces(active);
            } else {
                // Fallback to localStorage drafts
                const allDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
                const published = allDrafts.filter((d: WorkspaceDraft) => d.status === 'published');
                setPublishedWorkspaces(published);
                setActiveWorkspaces([]);
            }
        } catch (error) {
            console.error('Failed to load workspaces:', error);
            // Fallback to localStorage
            const allDrafts = JSON.parse(localStorage.getItem('workspace-drafts') || '[]');
            const published = allDrafts.filter((d: WorkspaceDraft) => d.status === 'published');
            setPublishedWorkspaces(published);
            setActiveWorkspaces([]);
        }
    };
    
    const handleOpenIDE = async (workspaceId: string) => {
        try {
            // Get the absolute file system path for the workspace
            const response = await fetch(`/api/workspaces/${workspaceId}/path`);
            if (response.ok) {
                const data = await response.json();
                const workspacePath = data.absolute_path;
                const workspaceFile = data.workspace_file;
                
                // Get IDE preference
                const selectedIDE = localStorage.getItem('preferred-ide') || 'vscode';
                
                // Try to open the .code-workspace file first, then fallback to directory
                if (workspaceFile) {
                    window.open(`${selectedIDE}://file/${workspaceFile}`, '_blank');
                } else {
                    window.open(`${selectedIDE}://file/${workspacePath}`, '_blank');
                }
            } else {
                console.error('Failed to get workspace path');
            }
        } catch (error) {
            console.error('Failed to open IDE:', error);
        }
    };
    
    const handleOpenFeedback = (workspaceId: string) => {
        // Open the interactive feedback page
        window.open(`/workspace/${workspaceId}/feedback`, '_blank');
    };
    
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">🏗️ Workspace Management</h3>
            
            {/* Published Workspaces */}
            <div className="mb-8">
                <h4 className="font-medium text-gray-900 mb-3">Published Workspaces</h4>
                {publishedWorkspaces.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {publishedWorkspaces.map(workspace => (
                            <WorkspaceCard
                                key={workspace.id}
                                workspace={workspace}
                                onOpenIDE={handleOpenIDE}
                                onOpenFeedback={handleOpenFeedback}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <div className="text-3xl mb-2">📦</div>
                        <p>No published workspaces yet</p>
                        <p className="text-sm">Publish workspace drafts from the Library stage</p>
                    </div>
                )}
            </div>
            
            {/* Active Workspaces */}
            <div>
                <h4 className="font-medium text-gray-900 mb-3">Active Workspaces</h4>
                {activeWorkspaces.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Active workspace cards would go here */}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        <div className="text-3xl mb-2">🤖</div>
                        <p>No active workspaces running</p>
                        <p className="text-sm">Deploy published workspaces to activate them</p>
                    </div>
                )}
            </div>
        </div>
    );
}