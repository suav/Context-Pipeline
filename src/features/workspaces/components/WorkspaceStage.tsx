/**
 * Workspace Stage Component - Full workspace management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { WorkspaceDraft } from '../types';
import { WorkspaceCard } from './WorkspaceCard';
import { WorkspaceValidationAlert, CheckEngineBadge } from './WorkspaceValidationAlert';

export function WorkspaceStage() {
    const [publishedWorkspaces, setPublishedWorkspaces] = useState<WorkspaceDraft[]>([]);
    const [activeWorkspaces, setActiveWorkspaces] = useState<WorkspaceDraft[]>([]);
    const [invalidWorkspaces, setInvalidWorkspaces] = useState<any[]>([]);
    const [validationDismissed, setValidationDismissed] = useState<Set<string>>(new Set());
    
    useEffect(() => {
        loadWorkspaces();
        validateWorkspaces();
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
    
    const validateWorkspaces = async () => {
        try {
            const response = await fetch('/api/workspaces/validate');
            if (response.ok) {
                const data = await response.json();
                setInvalidWorkspaces(data.invalid_workspaces || []);
            }
        } catch (error) {
            console.error('Failed to validate workspaces:', error);
        }
    };
    
    const handleMoveToDrafts = async (workspaceId: string) => {
        try {
            const response = await fetch('/api/workspaces/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'move_to_drafts',
                    workspaceId
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`✅ Workspace moved to drafts: ${result.draft_id}`);
                
                // Refresh workspaces and validation
                await loadWorkspaces();
                await validateWorkspaces();
            } else {
                const error = await response.json();
                alert(`❌ Failed to move workspace: ${error.error}`);
            }
        } catch (error) {
            console.error('Failed to move workspace to drafts:', error);
            alert('❌ Failed to move workspace to drafts');
        }
    };
    
    const handleDismissValidation = (workspaceId: string) => {
        setValidationDismissed(prev => new Set(prev).add(workspaceId));
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
            {/* Validation Alerts */}
            {invalidWorkspaces.length > 0 && (
                <div className="mb-6 space-y-4">
                    {invalidWorkspaces
                        .filter(workspace => !validationDismissed.has(workspace.id))
                        .map(workspace => (
                            <WorkspaceValidationAlert
                                key={workspace.id}
                                workspaceId={workspace.id}
                                workspaceName={workspace.name}
                                issues={workspace.validation.issues}
                                onMoveToDrafts={() => handleMoveToDrafts(workspace.id)}
                                onDismiss={() => handleDismissValidation(workspace.id)}
                            />
                        ))
                    }
                </div>
            )}
            
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">🏗️ Workspace Management</h3>
                {invalidWorkspaces.length > 0 && (
                    <CheckEngineBadge 
                        issueCount={invalidWorkspaces.filter(w => !validationDismissed.has(w.id)).length}
                        onClick={() => validateWorkspaces()}
                    />
                )}
            </div>
            
            {/* Published Workspaces */}
            <div className="mb-8">
                <h4 className="font-medium text-gray-900 mb-3">Published Workspaces</h4>
                {publishedWorkspaces.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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