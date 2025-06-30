/**
 * Workspace Validation API Route
 * Syncs draft workspace with published workspace and updates dynamic content
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const WORKSPACE_BASE_DIR = path.join(process.cwd(), 'storage', 'workspaces');

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        console.log(`🔄 Validating workspace: ${workspaceId}`);
        
        // 1. Load draft workspace manifest from localStorage backup
        const draftsDir = path.join(process.cwd(), 'storage', 'workspace-drafts');
        let draftManifest = null;
        
        try {
            // Look for the most recent draft file for this workspace
            const draftFiles = await fs.readdir(draftsDir);
            const workspaceDraftFiles = draftFiles
                .filter(f => f.includes(workspaceId) && f.endsWith('.json'))
                .sort()
                .reverse();
                
            if (workspaceDraftFiles.length > 0) {
                const latestDraftFile = path.join(draftsDir, workspaceDraftFiles[0]);
                const draftData = await fs.readFile(latestDraftFile, 'utf-8');
                const parsed = JSON.parse(draftData);
                draftManifest = parsed.draft || parsed;
            }
        } catch (error) {
            console.warn('Could not load draft manifest:', error);
        }
        
        if (!draftManifest) {
            return NextResponse.json(
                { error: 'No draft manifest found for validation' },
                { status: 400 }
            );
        }
        
        // 2. Load current published workspace manifest
        const publishedManifestPath = path.join(workspacePath, 'context', 'context-manifest.json');
        let publishedManifest = null;
        
        try {
            const manifestData = await fs.readFile(publishedManifestPath, 'utf-8');
            publishedManifest = JSON.parse(manifestData);
        } catch (error) {
            console.warn('Could not load published manifest:', error);
        }
        
        // 3. Check for unauthorized changes (agent modifications)
        let unauthorizedChanges = [];
        if (publishedManifest) {
            // Compare context file count and check for unexpected modifications
            const expectedContextCount = draftManifest.context_items?.length || 0;
            const actualContextCount = publishedManifest.total_items || 0;
            
            if (actualContextCount !== expectedContextCount) {
                unauthorizedChanges.push(`Context item count mismatch: expected ${expectedContextCount}, found ${actualContextCount}`);
            }
            
            // Check if context files have been modified (they should be read-only)
            for (const contextDir of ['tickets', 'files', 'data']) {
                try {
                    const contextDirPath = path.join(workspacePath, 'context', contextDir);
                    const files = await fs.readdir(contextDirPath);
                    for (const file of files) {
                        const filePath = path.join(contextDirPath, file);
                        const stats = await fs.stat(filePath);
                        // Check if file has write permissions (should be read-only)
                        if (stats.mode & 0o200) {
                            unauthorizedChanges.push(`Context file ${file} has write permissions`);
                        }
                    }
                } catch (error) {
                    // Directory might not exist, that's ok
                }
            }
        }
        
        // 4. Update dynamic context items in library (TODO: implement actual refresh logic)
        const dynamicUpdates = [];
        for (const item of draftManifest.context_items || []) {
            if (['jira', 'git', 'email'].includes(item.source)) {
                dynamicUpdates.push({
                    id: item.id,
                    source: item.source,
                    status: 'refresh_scheduled'
                });
            }
        }
        
        // 5. Copy updated draft context to published workspace
        const contextCopyResults = [];
        
        // Clear existing context files
        for (const contextDir of ['tickets', 'files', 'data']) {
            const contextDirPath = path.join(workspacePath, 'context', contextDir);
            try {
                const files = await fs.readdir(contextDirPath);
                for (const file of files) {
                    if (file.endsWith('.json') && !file.includes('context-manifest')) {
                        await fs.unlink(path.join(contextDirPath, file));
                    }
                }
            } catch (error) {
                // Directory might not exist
            }
        }
        
        // Copy context items from draft
        for (const item of draftManifest.context_items || []) {
            const fileName = `${item.source}-${item.id.replace(/[^a-zA-Z0-9]/g, '-')}-validated.json`;
            let contextDir = '';
            
            if (item.source === 'jira') {
                contextDir = 'tickets';
            } else if (item.source === 'git') {
                contextDir = 'data';
            } else {
                contextDir = 'files';
            }
            
            const itemPath = path.join(workspacePath, 'context', contextDir, fileName);
            
            // Add validation metadata
            const itemWithValidation = {
                ...item,
                validated_at: new Date().toISOString(),
                validation_source: 'draft_sync',
                workspace_id: workspaceId
            };
            
            await fs.writeFile(itemPath, JSON.stringify(itemWithValidation, null, 2));
            
            // Set read-only permissions
            try {
                await fs.chmod(itemPath, 0o444);
            } catch (error) {
                console.warn('Could not set read-only permissions:', error);
            }
            
            contextCopyResults.push({
                item_id: item.id,
                file: fileName,
                status: 'copied'
            });
        }
        
        // 6. Handle writeable repositories - create workspace branches
        const repositoryResults = [];
        const writeableItems = draftManifest.context_items?.filter((item: any) => 
            item.library_metadata?.clone_mode === 'writeable'
        ) || [];
        
        for (const repoItem of writeableItems) {
            if (repoItem.source === 'git' && repoItem.content?.clone_url) {
                const repoClonePath = path.join(workspacePath, 'target', 'repo-clone');
                const workspaceBranch = `workspace-${workspaceId}`;
                
                try {
                    // Clone repository if not already cloned
                    try {
                        await fs.access(path.join(repoClonePath, '.git'));
                        console.log('Repository already cloned, updating...');
                    } catch {
                        console.log('Cloning repository...');
                        await execAsync(`git clone ${repoItem.content.clone_url} "${repoClonePath}"`);
                    }
                    
                    // Create and switch to workspace branch
                    process.chdir(repoClonePath);
                    
                    try {
                        // Fetch latest changes
                        await execAsync('git fetch origin');
                        
                        // Check if workspace branch already exists
                        try {
                            await execAsync(`git checkout ${workspaceBranch}`);
                            console.log(`Switched to existing branch: ${workspaceBranch}`);
                        } catch {
                            // Create new branch from main/master
                            const mainBranch = repoItem.content.branch || 'main';
                            await execAsync(`git checkout -b ${workspaceBranch} origin/${mainBranch}`);
                            console.log(`Created new branch: ${workspaceBranch} from ${mainBranch}`);
                        }
                        
                        repositoryResults.push({
                            repo_url: repoItem.content.clone_url,
                            workspace_branch: workspaceBranch,
                            status: 'ready',
                            clone_path: repoClonePath
                        });
                        
                    } catch (branchError) {
                        console.error('Branch operation failed:', branchError);
                        repositoryResults.push({
                            repo_url: repoItem.content.clone_url,
                            workspace_branch: workspaceBranch,
                            status: 'branch_error',
                            error: (branchError as Error).message
                        });
                    }
                    
                } catch (cloneError) {
                    console.error('Repository clone failed:', cloneError);
                    repositoryResults.push({
                        repo_url: repoItem.content.clone_url,
                        workspace_branch: workspaceBranch,
                        status: 'clone_error',
                        error: (cloneError as Error).message
                    });
                } finally {
                    // Return to original directory
                    process.chdir(process.cwd());
                }
            }
        }
        
        // 7. Update workspace manifests
        const newContextManifest = {
            workspace_id: workspaceId,
            created: publishedManifest?.created || new Date().toISOString(),
            last_updated: new Date().toISOString(),
            last_validated: new Date().toISOString(),
            total_items: draftManifest.context_items?.length || 0,
            context_items: draftManifest.context_items?.map((item: any, index: number) => ({
                id: `ctx-${index + 1}`,
                type: item.source,
                title: item.title,
                description: item.preview || item.description,
                content_file: `context/${item.source === 'jira' ? 'tickets' : item.source === 'git' ? 'data' : 'files'}/${item.source}-${item.id.replace(/[^a-zA-Z0-9]/g, '-')}-validated.json`,
                preview: item.preview,
                metadata: item.metadata || {},
                tags: item.tags || [],
                added_at: item.added_at || new Date().toISOString(),
                validated_at: new Date().toISOString(),
                size_bytes: item.size_bytes || 0
            })) || [],
            validation_summary: {
                unauthorized_changes: unauthorizedChanges,
                dynamic_updates: dynamicUpdates,
                context_files_synced: contextCopyResults.length,
                repositories_processed: repositoryResults.length
            }
        };
        
        await fs.writeFile(publishedManifestPath, JSON.stringify(newContextManifest, null, 2));
        
        // Update workspace metadata
        const workspaceMetadataPath = path.join(workspacePath, 'workspace.json');
        try {
            const metadata = JSON.parse(await fs.readFile(workspaceMetadataPath, 'utf-8'));
            metadata.last_validated = new Date().toISOString();
            metadata.validation_count = (metadata.validation_count || 0) + 1;
            metadata.context_items = draftManifest.context_items;
            await fs.writeFile(workspaceMetadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.warn('Could not update workspace metadata:', error);
        }
        
        return NextResponse.json({
            success: true,
            workspace_id: workspaceId,
            validation_timestamp: new Date().toISOString(),
            summary: {
                context_items_synced: contextCopyResults.length,
                unauthorized_changes: unauthorizedChanges.length,
                dynamic_updates_scheduled: dynamicUpdates.length,
                repositories_processed: repositoryResults.length,
                repositories: repositoryResults
            },
            details: {
                unauthorized_changes: unauthorizedChanges,
                dynamic_updates: dynamicUpdates,
                context_copy_results: contextCopyResults,
                repository_results: repositoryResults
            }
        });
        
    } catch (error) {
        console.error('Workspace validation failed:', error);
        return NextResponse.json(
            { error: 'Failed to validate workspace', details: (error as Error).message },
            { status: 500 }
        );
    }
}