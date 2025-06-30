/**
 * Workspace API Route
 * Handles workspace creation, storage, and management
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Use persistent storage for workspaces so changes persist
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

// Helper function to get the correct context directory for a source type
function getContextDirectory(sourceType: string): string {
    if (sourceType === 'jira') {
        return 'tickets';
    } else if (sourceType === 'git') {
        return 'data';
    } else {
        return 'files';
    }
}

// Ensure workspace directory exists
async function ensureWorkspaceDir() {
    try {
        await fs.mkdir(WORKSPACE_BASE_DIR, { recursive: true });
        console.log(`📁 Workspace base directory ensured: ${WORKSPACE_BASE_DIR}`);
        
        // Test write permissions
        const testFile = path.join(WORKSPACE_BASE_DIR, 'test-write.txt');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        console.log(`✅ Write permissions confirmed for workspace directory`);
    } catch (error) {
        console.error('Failed to create workspace directory or test permissions:', error);
        throw error;
    }
}

export async function POST(request: NextRequest) {
    await ensureWorkspaceDir();
    
    try {
        const body = await request.json();
        const { action, workspaceDraft, workspace_id, context_items } = body;
        
        if (action === 'add_context') {
            // Add context items to existing published workspace
            const workspacePath = path.join(WORKSPACE_BASE_DIR, workspace_id);
            
            // Check if workspace exists
            try {
                await fs.access(workspacePath);
            } catch {
                return NextResponse.json({
                    success: false,
                    error: 'Workspace not found'
                }, { status: 404 });
            }
            
            // Load existing workspace metadata
            const metadataPath = path.join(workspacePath, 'workspace.json');
            let workspaceMetadata;
            try {
                workspaceMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            } catch {
                return NextResponse.json({
                    success: false,
                    error: 'Could not load workspace metadata'
                }, { status: 500 });
            }
            
            // Add new context items to workspace
            for (const item of context_items) {
                const fileName = `${item.source}-${item.id.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.json`;
                const contextDir = getContextDirectory(item.source);
                const itemPath = path.join(workspacePath, 'context', contextDir, fileName);
                
                // Add metadata about when this item was added
                const itemWithMeta = {
                    ...item,
                    added_to_workspace_at: new Date().toISOString(),
                    workspace_addition: true
                };
                
                await fs.writeFile(itemPath, JSON.stringify(itemWithMeta, null, 2));
                
                // Set read-only permissions for context files
                try {
                    await fs.chmod(itemPath, 0o444); // Read-only for all
                } catch (error) {
                    console.warn('Could not set read-only permissions:', error);
                }
            }
            
            // Update workspace metadata
            workspaceMetadata.context_items = [...(workspaceMetadata.context_items || []), ...context_items];
            workspaceMetadata.last_updated = new Date().toISOString();
            
            await fs.writeFile(metadataPath, JSON.stringify(workspaceMetadata, null, 2));
            
            // Update context manifest
            const manifestPath = path.join(workspacePath, 'context', 'context-manifest.json');
            try {
                const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
                manifest.total_items += context_items.length;
                manifest.last_updated = new Date().toISOString();
                manifest.context_items.push(...context_items.map((item: any, index: number) => {
                    const contextDir = getContextDirectory(item.source);
                    const fileName = `${item.source}-${item.id.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.json`;
                    
                    return {
                        id: `ctx-${manifest.total_items + index + 1}`,
                        type: item.source,
                        title: item.title,
                        description: item.preview || item.description,
                        content_file: `context/${contextDir}/${fileName}`,
                        preview: item.preview,
                        metadata: item.metadata || {},
                        tags: item.tags || [],
                        added_at: new Date().toISOString(),
                        size_bytes: item.size_bytes || 0
                    };
                }));
                
                await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
            } catch (error) {
                console.warn('Could not update context manifest:', error);
            }
            
            return NextResponse.json({
                success: true,
                message: `Added ${context_items.length} context items to workspace`,
                workspace_id: workspace_id
            });
        }
        
        if (action === 'publish') {
            // Create workspace directory structure
            const workspaceId = workspaceDraft.id;
            const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
            
            console.log(`📁 Creating workspace at: ${workspacePath}`);
            console.log(`📋 Workspace draft:`, JSON.stringify(workspaceDraft, null, 2));
            
            // Create 4-component structure with detailed subdirectories
            console.log(`📁 Creating directory structure...`);
            try {
                await fs.mkdir(path.join(workspacePath, 'context', 'tickets'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'context', 'files'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'context', 'data'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'target', 'repo-clone'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'target', 'build'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'target', 'workspace'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'feedback', 'results'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'feedback', 'logs'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'feedback', 'interactive'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'agents', 'states'), { recursive: true });
                await fs.mkdir(path.join(workspacePath, 'agents', 'history'), { recursive: true });
                console.log(`✅ Directory structure created successfully`);
            } catch (dirError) {
                console.error(`❌ Failed to create directory structure:`, dirError);
                throw new Error(`Failed to create workspace directories: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
            }
            
            // Create context manifest
            const contextManifest = {
                workspace_id: workspaceId,
                created: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                total_items: workspaceDraft.context_items.length,
                context_items: workspaceDraft.context_items.map((item: any, index: number) => {
                    const contextDir = getContextDirectory(item.source);
                    const fileName = `${item.source}-${index + 1}.json`;
                    
                    return {
                        id: `ctx-${index + 1}`,
                        type: item.source,
                        title: item.title,
                        description: item.preview || item.description,
                        content_file: `context/${contextDir}/${fileName}`,
                        preview: item.preview,
                        metadata: item.metadata || {},
                        tags: item.tags || [],
                        added_at: item.added_at || new Date().toISOString(),
                        size_bytes: item.size_bytes || 0
                    };
                }),
                context_summary: `Workspace contains ${workspaceDraft.context_items.length} context items from ${workspaceDraft.name}`
            };
            
            // Save context manifest (read-only)
            await fs.writeFile(
                path.join(workspacePath, 'context', 'context-manifest.json'),
                JSON.stringify(contextManifest, null, 2)
            );
            
            // Save individual context items with proper permissions
            console.log(`📄 Saving ${workspaceDraft.context_items.length} context items...`);
            for (const [index, item] of workspaceDraft.context_items.entries()) {
                // Use simpler file names to avoid WSL path issues
                const fileName = `${item.source}-${index + 1}.json`;
                const contextDir = getContextDirectory(item.source);
                const itemPath = path.join(workspacePath, 'context', contextDir, fileName);
                console.log(`💾 Writing file: ${itemPath}`);
                
                try {
                    await fs.writeFile(itemPath, JSON.stringify(item, null, 2));
                    console.log(`✅ File written successfully: ${fileName}`);
                    
                    // Try to set read-only permissions (may fail on Windows/WSL)
                    try {
                        await fs.chmod(itemPath, 0o644); // Read-write for owner, read for others
                        console.log(`🔒 Permissions set for: ${fileName}`);
                    } catch (permError) {
                        console.warn(`⚠️ Could not set permissions for ${fileName}:`, permError);
                        // Continue anyway - permissions aren't critical
                    }
                } catch (writeError) {
                    console.error(`❌ Failed to write file ${fileName}:`, writeError);
                    throw new Error(`Failed to write context file ${fileName}: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
                }
            }
            
            // Handle target repository cloning
            const writeableItems = workspaceDraft.context_items.filter((item: any) => 
                item.library_metadata?.clone_mode === 'writeable'
            );
            
            if (writeableItems.length > 0) {
                // Actually clone and set up writeable repositories with workspace branches
                console.log(`🌿 Setting up ${writeableItems.length} writeable repositories...`);
                const repoResults = [];
                
                for (const repoItem of writeableItems) {
                    const repoName = `${repoItem.content?.owner}-${repoItem.content?.repo}`;
                    const repoClonePath = path.join(workspacePath, 'target', 'repo-clone', repoName);
                    const workspaceBranch = `workspace-${workspaceId}`;
                    const cloneUrl = repoItem.content?.clone_url || repoItem.content?.repo_url;
                    const mainBranch = repoItem.content?.branch || 'main';
                    
                    console.log(`📁 Cloning ${cloneUrl} to ${repoClonePath}`);
                    
                    try {
                        // Ensure parent directory exists
                        await fs.mkdir(path.dirname(repoClonePath), { recursive: true });
                        
                        // Use SSH URL for authentication, fallback to HTTPS
                        const gitUrl = repoItem.content?.ssh_url || cloneUrl;
                        const cloneCommand = `git clone --depth 1 "${gitUrl}" "${repoClonePath}"`;
                        console.log(`🔄 Running: ${cloneCommand}`);
                        
                        await execAsync(cloneCommand, { timeout: 30000 }); // 30 second timeout
                        console.log(`✅ Repository cloned successfully`);
                        
                        // Create and switch to workspace branch
                        const branchCommand = `cd "${repoClonePath}" && git checkout -b ${workspaceBranch}`;
                        console.log(`🌿 Creating workspace branch: ${workspaceBranch}`);
                        
                        await execAsync(branchCommand, { timeout: 10000 });
                        console.log(`✅ Workspace branch created: ${workspaceBranch}`);
                        
                        repoResults.push({
                            repo_url: cloneUrl,
                            repo_name: repoName,
                            workspace_branch: workspaceBranch,
                            main_branch: mainBranch,
                            clone_path: repoClonePath,
                            status: 'ready',
                            cloned_at: new Date().toISOString()
                        });
                        
                    } catch (cloneError: any) {
                        console.error(`❌ Failed to setup repository ${repoName}:`, cloneError);
                        repoResults.push({
                            repo_url: cloneUrl,
                            repo_name: repoName,
                            workspace_branch: workspaceBranch,
                            main_branch: mainBranch,
                            status: 'error',
                            error: cloneError.message || String(cloneError),
                            attempted_at: new Date().toISOString()
                        });
                    }
                }
                
                // Save repository setup results
                await fs.writeFile(
                    path.join(workspacePath, 'target', 'repo-setup-results.json'),
                    JSON.stringify({
                        setup_timestamp: new Date().toISOString(),
                        repositories: repoResults,
                        status: 'completed',
                        successful_repos: repoResults.filter(r => r.status === 'ready').length,
                        failed_repos: repoResults.filter(r => r.status === 'error').length
                    }, null, 2)
                );
                
            } else {
                // Create empty workspace folder for agent output
                await fs.writeFile(
                    path.join(workspacePath, 'target', 'workspace', 'README.md'),
                    '# Workspace Output\n\nThis directory is for agent-generated content.\n'
                );
            }
            
            // Save workspace metadata
            const workspaceMetadata = {
                ...workspaceDraft,
                status: 'published',
                published_at: new Date().toISOString(),
                workspace_path: workspacePath
            };
            
            await fs.writeFile(
                path.join(workspacePath, 'workspace.json'),
                JSON.stringify(workspaceMetadata, null, 2)
            );
            
            // Create comprehensive feedback system
            
            // Status file for agent communication
            await fs.writeFile(
                path.join(workspacePath, 'feedback', 'status.json'),
                JSON.stringify({
                    status: 'created',
                    progress: 0,
                    phase: 'initialization',
                    created_at: new Date().toISOString(),
                    last_updated: new Date().toISOString(),
                    active_agents: 0,
                    messages: ['Workspace created successfully'],
                    completion_signals: []
                }, null, 2)
            );
            
            // Progress tracking file
            await fs.writeFile(
                path.join(workspacePath, 'feedback', 'progress.json'),
                JSON.stringify({
                    overall_progress: 0,
                    phases: [],
                    milestones: [],
                    estimated_completion: null,
                    last_activity: new Date().toISOString()
                }, null, 2)
            );
            
            // Interactive feedback template
            const interactiveHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace: ${workspaceDraft.name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
        .status { padding: 20px; border-radius: 8px; margin: 20px 0; }
        .created { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .working { background: #fff3cd; border-left: 4px solid #ffc107; }
        .completed { background: #d4edda; border-left: 4px solid #28a745; }
        .error { background: #f8d7da; border-left: 4px solid #dc3545; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>🏗️ Workspace: ${workspaceDraft.name}</h1>
    <div class="status created">
        <h3>✅ Workspace Created</h3>
        <p>Your workspace has been successfully created and is ready for agent deployment.</p>
        <p class="timestamp">Created: ${new Date().toLocaleString()}</p>
    </div>
    
    <h2>📊 Context Items</h2>
    <ul>
        ${workspaceDraft.context_items.map((item: any) => `<li><strong>${item.title}</strong> (${item.source})</li>`).join('')}
    </ul>
    
    <h2>🎯 Next Steps</h2>
    <ol>
        <li>Deploy an agent to this workspace</li>
        <li>Monitor progress in the feedback section</li>
        <li>Review results when completed</li>
    </ol>
    
    <div id="live-updates">
        <!-- Agents will update this section -->
    </div>
    
    <script>
        // Auto-refresh every 30 seconds for live updates
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
            
            await fs.writeFile(
                path.join(workspacePath, 'feedback', 'interactive', 'index.html'),
                interactiveHTML
            );
            
            // Agent management setup
            await fs.writeFile(
                path.join(workspacePath, 'agents', 'active-agents.json'),
                JSON.stringify({
                    agents: [],
                    max_concurrent: 4,
                    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'],
                    next_color_index: 0
                }, null, 2)
            );
            
            // Master agent log
            await fs.writeFile(
                path.join(workspacePath, 'agents', 'master-log.json'),
                JSON.stringify({
                    workspace_id: workspaceId,
                    created_at: new Date().toISOString(),
                    total_interactions: 0,
                    agents_deployed: 0,
                    log_entries: []
                }, null, 2)
            );
            
            // Create VSCode workspace file for proper IDE integration
            const vscodeWorkspace = {
                folders: [
                    {
                        name: `📁 Context`,
                        path: "./context"
                    },
                    {
                        name: `🎯 Target`,
                        path: "./target"
                    },
                    {
                        name: `📊 Feedback`,
                        path: "./feedback"
                    },
                    {
                        name: `🤖 Agents`,
                        path: "./agents"
                    }
                ],
                settings: {
                    "files.readonlyInclude": {
                        "context/**": true
                    },
                    "explorer.compactFolders": false,
                    "workbench.tree.indent": 20
                },
                extensions: {
                    recommendations: [
                        "ms-vscode.vscode-json",
                        "redhat.vscode-yaml"
                    ]
                }
            };
            
            await fs.writeFile(
                path.join(workspacePath, `${workspaceDraft.name.replace(/[^a-zA-Z0-9]/g, '-')}.code-workspace`),
                JSON.stringify(vscodeWorkspace, null, 2)
            );
            
            // Create README for the workspace
            const readmeContent = `# ${workspaceDraft.name}

## Workspace Structure

This workspace follows the 4-component architecture:

### 📁 Context (Read-Only)
Contains all context items imported for this workspace:
- \`tickets/\` - JIRA tickets and issue data
- \`files/\` - File attachments and documents  
- \`data/\` - Git repositories and data sources

### 🎯 Target
Work area for agents and outputs:
- \`repo-clone/\` - Cloned repositories for development
- \`workspace/\` - Agent-generated content and deliverables
- \`build/\` - Build artifacts and compiled outputs

### 📊 Feedback
Status and progress tracking:
- \`status.json\` - Current workspace status
- \`progress.json\` - Progress tracking data
- \`interactive/\` - Interactive HTML feedback pages
- \`results/\` - Final results and outputs
- \`logs/\` - Detailed operation logs

### 🤖 Agents
Agent management and history:
- \`active-agents.json\` - Currently deployed agents
- \`master-log.json\` - Master interaction log
- \`states/\` - Individual agent state files
- \`history/\` - Detailed agent history and sessions

## Getting Started

1. Deploy an agent using the workspace management interface
2. Monitor progress through the feedback system
3. Review results in the target and feedback directories
4. Use the interactive feedback page for real-time updates

---
*Generated on ${new Date().toLocaleString()}*
`;
            
            await fs.writeFile(
                path.join(workspacePath, 'README.md'),
                readmeContent
            );
            
            return NextResponse.json({
                success: true,
                workspace_id: workspaceId,
                workspace_path: workspacePath,
                message: 'Workspace published successfully'
            });
        }
        
        return NextResponse.json({
            success: false,
            error: 'Unknown action'
        }, { status: 400 });
        
    } catch (error) {
        console.error('Workspace operation failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process workspace operation',
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    await ensureWorkspaceDir();
    
    try {
        // List all workspaces
        const workspaceDirs = await fs.readdir(WORKSPACE_BASE_DIR);
        const workspaces = [];
        
        for (const dir of workspaceDirs) {
            const workspacePath = path.join(WORKSPACE_BASE_DIR, dir);
            const stat = await fs.stat(workspacePath);
            
            if (stat.isDirectory()) {
                try {
                    const metadataPath = path.join(workspacePath, 'workspace.json');
                    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
                    workspaces.push(metadata);
                } catch (error) {
                    console.error(`Failed to read workspace ${dir}:`, error);
                }
            }
        }
        
        return NextResponse.json({
            success: true,
            workspaces: workspaces
        });
        
    } catch (error) {
        console.error('Failed to list workspaces:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to list workspaces'
        }, { status: 500 });
    }
}