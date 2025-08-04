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
// Extract workspace memory for evaluation
async function extractWorkspaceMemory(workspacePath: string, workspaceMetadata: any) {
    const memory = {
        workspace_id: workspaceMetadata.id,
        name: workspaceMetadata.name,
        published_at: workspaceMetadata.published_at,
        unpublished_at: new Date().toISOString(),
        summary: {
            total_context_items: workspaceMetadata.context_items?.length || 0,
            context_sources: [...new Set(workspaceMetadata.context_items?.map((item: any) => item.source) || [])],
            agent_deployments: 0,
            total_interactions: 0,
            key_outcomes: []
        },
        agents: {
            deployed_agents: [],
            total_conversations: 0,
            key_conversations: []
        },
        files: {
            created_files: [],
            modified_files: [],
            key_outputs: []
        },
        progress: {
            milestones_reached: [],
            completion_percentage: 0,
            time_active: null
        },
        evaluation_notes: []
    };

    try {
        // Extract agent information
        const agentsPath = path.join(workspacePath, 'agents');
        try {
            await fs.access(agentsPath);
            
            // Read active agents
            const activeAgentsPath = path.join(agentsPath, 'active-agents.json');
            try {
                const activeAgents = JSON.parse(await fs.readFile(activeAgentsPath, 'utf-8'));
                memory.agents.deployed_agents = activeAgents.agents || [];
            } catch {}

            // Read master log
            const masterLogPath = path.join(agentsPath, 'master-log.json');
            try {
                const masterLog = JSON.parse(await fs.readFile(masterLogPath, 'utf-8'));
                memory.agents.total_conversations = masterLog.total_interactions || 0;
                memory.summary.agent_deployments = masterLog.agents_deployed || 0;
                memory.summary.total_interactions = masterLog.total_interactions || 0;
                
                // Extract key conversation snippets
                if (masterLog.log_entries && masterLog.log_entries.length > 0) {
                    memory.agents.key_conversations = masterLog.log_entries
                        .slice(-5) // Last 5 entries
                        .map((entry: any) => ({
                            timestamp: entry.timestamp,
                            agent_id: entry.agent_id,
                            action: entry.action,
                            summary: entry.summary || entry.message || 'No summary available'
                        }));
                }
            } catch {}

            // Scan for individual agent conversations
            const historyPath = path.join(agentsPath, 'history');
            try {
                await fs.access(historyPath);
                const historyFiles = await fs.readdir(historyPath);
                for (const file of historyFiles) {
                    if (file.endsWith('.json')) {
                        try {
                            const conversationPath = path.join(historyPath, file);
                            const conversation = JSON.parse(await fs.readFile(conversationPath, 'utf-8'));
                            if (conversation.messages && conversation.messages.length > 0) {
                                memory.evaluation_notes.push({
                                    source: 'agent_conversation',
                                    agent_id: file.replace('.json', ''),
                                    message_count: conversation.messages.length,
                                    first_message: conversation.messages[0]?.content?.substring(0, 200) + '...',
                                    last_message: conversation.messages[conversation.messages.length - 1]?.content?.substring(0, 200) + '...'
                                });
                            }
                        } catch {}
                    }
                }
            } catch {}
        } catch {}

        // Extract progress information
        const feedbackPath = path.join(workspacePath, 'feedback');
        try {
            await fs.access(feedbackPath);
            
            // Read status
            const statusPath = path.join(feedbackPath, 'status.json');
            try {
                const status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
                memory.progress.completion_percentage = status.progress || 0;
                if (status.created_at && status.last_updated) {
                    const start = new Date(status.created_at);
                    const end = new Date(status.last_updated);
                    memory.progress.time_active = Math.floor((end.getTime() - start.getTime()) / 1000); // seconds
                }
            } catch {}

            // Read progress data
            const progressPath = path.join(feedbackPath, 'progress.json');
            try {
                const progress = JSON.parse(await fs.readFile(progressPath, 'utf-8'));
                memory.progress.milestones_reached = progress.milestones || [];
            } catch {}
        } catch {}

        // Extract file outputs
        const targetPath = path.join(workspacePath, 'target');
        try {
            await fs.access(targetPath);
            
            // Scan workspace directory for created files
            const workspaceOutputPath = path.join(targetPath, 'workspace');
            try {
                const scanFiles = async (dirPath: string, relativePath: string = '') => {
                    const files = await fs.readdir(dirPath);
                    for (const file of files) {
                        const fullPath = path.join(dirPath, file);
                        const relPath = path.join(relativePath, file);
                        const stat = await fs.stat(fullPath);
                        
                        if (stat.isDirectory() && memory.files.created_files.length < 20) {
                            await scanFiles(fullPath, relPath);
                        } else if (stat.isFile() && memory.files.created_files.length < 20) {
                            memory.files.created_files.push({
                                path: relPath,
                                size: stat.size,
                                created: stat.birthtime,
                                modified: stat.mtime
                            });
                        }
                    }
                };
                
                await scanFiles(workspaceOutputPath);
            } catch {}

            // Check build outputs
            const buildPath = path.join(targetPath, 'build');
            try {
                const buildFiles = await fs.readdir(buildPath);
                for (const file of buildFiles) {
                    const filePath = path.join(buildPath, file);
                    const stat = await fs.stat(filePath);
                    if (stat.isFile()) {
                        memory.files.key_outputs.push({
                            type: 'build_artifact',
                            name: file,
                            path: `build/${file}`,
                            size: stat.size,
                            created: stat.birthtime
                        });
                    }
                }
            } catch {}
        } catch {}

        // Add summary evaluation
        if (memory.agents.deployed_agents.length > 0) {
            memory.evaluation_notes.push({
                source: 'workspace_summary',
                note: `Workspace had ${memory.agents.deployed_agents.length} deployed agents with ${memory.summary.total_interactions} total interactions`
            });
        }

        if (memory.files.created_files.length > 0) {
            memory.evaluation_notes.push({
                source: 'workspace_summary',
                note: `Workspace produced ${memory.files.created_files.length} output files`
            });
        }

        memory.summary.key_outcomes = [
            `${memory.summary.agent_deployments} agents deployed`,
            `${memory.summary.total_interactions} interactions recorded`,
            `${memory.files.created_files.length} files created`,
            `${memory.progress.completion_percentage}% completion reached`
        ];

    } catch (error) {
        console.error('Error extracting workspace memory:', error);
        memory.evaluation_notes.push({
            source: 'extraction_error',
            error: error instanceof Error ? error.message : String(error)
        });
    }

    return memory;
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
        if (action === 'unpublish') {
            // Unpublish workspace - convert back to draft or archive
            const { workspace_id, mode = 'draft' } = body; // mode: 'draft' or 'archive'
            
            if (!workspace_id) {
                return NextResponse.json({
                    success: false,
                    error: 'Workspace ID is required'
                }, { status: 400 });
            }

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

            // Load workspace metadata
            let workspaceMetadata;
            try {
                const metadataPath = path.join(workspacePath, 'workspace.json');
                workspaceMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            } catch {
                return NextResponse.json({
                    success: false,
                    error: 'Could not load workspace metadata'
                }, { status: 500 });
            }

            // Extract memory and key information for evaluation
            const workspaceMemory = await extractWorkspaceMemory(workspacePath, workspaceMetadata);
            
            if (mode === 'archive') {
                // Archive the workspace
                const archiveDir = path.join(process.cwd(), 'storage', 'archives', 'workspaces');
                await fs.mkdir(archiveDir, { recursive: true });

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const archiveName = `${workspace_id}-unpublished-${timestamp}`;
                const archivePath = path.join(archiveDir, archiveName);

                // Save workspace memory before moving
                await fs.writeFile(
                    path.join(workspacePath, 'workspace-memory.json'),
                    JSON.stringify(workspaceMemory, null, 2)
                );

                // Move workspace to archive
                await fs.rename(workspacePath, archivePath);

                // Update archive metadata
                const archivedMetadata = {
                    ...workspaceMetadata,
                    status: 'archived',
                    unpublished_at: new Date().toISOString(),
                    unpublish_mode: 'archive',
                    workspace_memory: workspaceMemory
                };

                await fs.writeFile(
                    path.join(archivePath, 'workspace.json'),
                    JSON.stringify(archivedMetadata, null, 2)
                );

                return NextResponse.json({
                    success: true,
                    message: `Workspace '${workspaceMetadata.name}' archived successfully`,
                    workspace_id,
                    archive_path: archiveName,
                    workspace_memory: workspaceMemory
                });
            } else {
                // Convert to draft
                const draftData = {
                    id: workspace_id,
                    name: workspaceMetadata.name,
                    description: workspaceMetadata.description || '',
                    context_items: workspaceMetadata.context_items || [],
                    created_at: workspaceMetadata.created_at || workspaceMetadata.published_at,
                    last_updated: new Date().toISOString(),
                    converted_from_workspace: true,
                    original_published_at: workspaceMetadata.published_at,
                    workspace_memory: workspaceMemory
                };

                // Save as draft
                const draftsDir = path.join(process.cwd(), 'storage', 'workspace-drafts');
                await fs.mkdir(draftsDir, { recursive: true });
                
                const currentPath = path.join(draftsDir, 'current-drafts.json');
                let currentData = { drafts: [] };
                
                try {
                    currentData = JSON.parse(await fs.readFile(currentPath, 'utf-8'));
                } catch {
                    // File doesn't exist, use default
                }

                // Add or update draft
                const existingIndex = currentData.drafts.findIndex((d: any) => d.id === workspace_id);
                if (existingIndex >= 0) {
                    currentData.drafts[existingIndex] = draftData;
                } else {
                    currentData.drafts.push(draftData);
                }

                await fs.writeFile(currentPath, JSON.stringify({
                    lastSync: new Date().toISOString(),
                    count: currentData.drafts.length,
                    drafts: currentData.drafts
                }, null, 2));

                // Archive the workspace files with memory
                const archiveDir = path.join(process.cwd(), 'storage', 'archives', 'workspaces');
                await fs.mkdir(archiveDir, { recursive: true });

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const archiveName = `${workspace_id}-converted-to-draft-${timestamp}`;
                const archivePath = path.join(archiveDir, archiveName);

                // Save workspace memory before moving
                await fs.writeFile(
                    path.join(workspacePath, 'workspace-memory.json'),
                    JSON.stringify(workspaceMemory, null, 2)
                );

                await fs.rename(workspacePath, archivePath);

                return NextResponse.json({
                    success: true,
                    message: `Workspace '${workspaceMetadata.name}' converted to draft successfully`,
                    workspace_id,
                    draft_data: draftData,
                    archive_path: archiveName,
                    workspace_memory: workspaceMemory
                });
            }
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
                
                // For git repositories, ensure we have complete item data from library
                let itemToSave = item;
                if (item.source === 'git' && item.type === 'git_repository' && !item.content?.owner) {
                    console.log(`🔄 Fetching complete repository data for ${item.id}...`);
                    try {
                        // Fetch full item from library
                        const libraryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/context-workflow/library`);
                        if (libraryResponse.ok) {
                            const libraryData = await libraryResponse.json();
                            const fullItem = libraryData.items?.find((libItem: any) => libItem.id === item.id);
                            if (fullItem && fullItem.content?.owner) {
                                console.log(`✅ Found complete repository data for ${item.id}`);
                                itemToSave = { ...item, content: fullItem.content, metadata: fullItem.metadata };
                            } else {
                                console.warn(`⚠️ Could not find complete repository data for ${item.id} in library`);
                            }
                        }
                    } catch (fetchError) {
                        console.warn(`⚠️ Could not fetch complete repository data for ${item.id}:`, fetchError);
                    }
                }
                
                try {
                    await fs.writeFile(itemPath, JSON.stringify(itemToSave, null, 2));
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
            const repoItems = workspaceDraft.context_items.filter((item: any) =>
                item.source === 'git' && item.type === 'git_repository'
            );
            if (repoItems.length > 0) {
                // Actually clone and set up all repositories (both writeable and read-only)
                console.log(`🌿 Setting up ${repoItems.length} repositories...`);
                const repoResults = [];
                
                // Fetch complete repository data from library for cloning
                let libraryItems = {};
                try {
                    const libraryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/context-workflow/library`);
                    if (libraryResponse.ok) {
                        const libraryData = await libraryResponse.json();
                        libraryItems = Object.fromEntries(
                            libraryData.items?.map((item: any) => [item.id, item]) || []
                        );
                        console.log(`📚 Loaded ${Object.keys(libraryItems).length} library items for repository cloning`);
                    }
                } catch (fetchError) {
                    console.warn(`⚠️ Could not fetch library data for repository cloning:`, fetchError);
                }
                
                for (const repoItem of repoItems) {
                    // Use complete library data if available, prioritize one with content
                    let fullRepoItem = repoItem;
                    if (libraryItems[repoItem.id]) {
                        const libraryItem = libraryItems[repoItem.id];
                        if (libraryItem.content && Object.keys(libraryItem.content).length > 0) {
                            fullRepoItem = libraryItem;
                        }
                    }
                    
                    // If still no content, try to find it in the workspace item or fallback
                    if (!fullRepoItem.content || !fullRepoItem.content.clone_url) {
                        console.warn(`⚠️ No repository content found for ${repoItem.id}, using fallback data`);
                        // Check if repoItem itself has content
                        if (repoItem.content && repoItem.content.clone_url) {
                            fullRepoItem = repoItem;
                        } else {
                            console.error(`❌ Cannot clone repository ${repoItem.id} - no clone URL available`);
                            repoResults.push({
                                repo_url: 'unknown',
                                repo_name: repoItem.id,
                                workspace_branch: null,
                                main_branch: 'main',
                                clone_mode: repoItem.library_metadata?.clone_mode || 'read-only',
                                status: 'error',
                                error: 'No clone URL available - missing repository content',
                                attempted_at: new Date().toISOString()
                            });
                            continue;
                        }
                    }
                    
                    const repoName = `${fullRepoItem.content.owner}-${fullRepoItem.content.repo}`;
                    const repoClonePath = path.join(workspacePath, 'target', 'repo-clone', repoName);
                    const workspaceBranch = `workspace-${workspaceId}`;
                    const cloneUrl = fullRepoItem.content.clone_url || fullRepoItem.content.repo_url;
                    const mainBranch = fullRepoItem.content.branch || 'main';
                    const cloneMode = fullRepoItem.library_metadata?.clone_mode || repoItem.library_metadata?.clone_mode || 'read-only';
                    
                    console.log(`📁 Cloning ${cloneUrl} to ${repoClonePath} (${cloneMode})`);
                    try {
                        // Ensure parent directory exists
                        await fs.mkdir(path.dirname(repoClonePath), { recursive: true });
                        // Use SSH URL for authentication, fallback to HTTPS
                        const gitUrl = fullRepoItem.content?.ssh_url || cloneUrl;
                        const cloneCommand = `git clone --depth 1 "${gitUrl}" "${repoClonePath}"`;
                        console.log(`🔄 Running: ${cloneCommand}`);
                        await execAsync(cloneCommand, { timeout: 30000 }); // 30 second timeout
                        console.log(`✅ Repository cloned successfully`);
                        
                        // Only create workspace branch for writeable repositories
                        if (cloneMode === 'writeable') {
                            const branchCommand = `cd "${repoClonePath}" && git checkout -b ${workspaceBranch}`;
                            console.log(`🌿 Creating workspace branch: ${workspaceBranch} (writeable mode)`);
                            await execAsync(branchCommand, { timeout: 10000 });
                            console.log(`✅ Workspace branch created: ${workspaceBranch}`);
                        } else {
                            console.log(`📖 Repository cloned in read-only mode (no workspace branch)`);
                        }
                        
                        repoResults.push({
                            repo_url: cloneUrl,
                            repo_name: repoName,
                            workspace_branch: cloneMode === 'writeable' ? workspaceBranch : null,
                            main_branch: mainBranch,
                            clone_path: repoClonePath,
                            clone_mode: cloneMode,
                            status: 'ready',
                            cloned_at: new Date().toISOString()
                        });
                    } catch (cloneError: any) {
                        console.error(`❌ Failed to setup repository ${repoName}:`, cloneError);
                        repoResults.push({
                            repo_url: cloneUrl,
                            repo_name: repoName,
                            workspace_branch: cloneMode === 'writeable' ? workspaceBranch : null,
                            main_branch: mainBranch,
                            clone_mode: cloneMode,
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
            }
            
            // Initialize target directory as a proper git repository for workspace operations
            console.log(`🔧 Initializing git repository in target directory...`);
            try {
                const targetPath = path.join(workspacePath, 'target');
                
                // Initialize git repository in target directory
                await execAsync('git init', { cwd: targetPath });
                console.log(`✅ Git repository initialized in target directory`);
                
                // Create initial commit with workspace structure
                const initialFiles = [];
                
                // Add workspace README if no repositories were cloned
                if (repoItems.length === 0) {
                    await fs.writeFile(
                        path.join(targetPath, 'README.md'),
                        `# ${workspaceDraft.name} - Workspace Repository\n\nThis is the git repository for workspace deliverables.\n\n## Directory Structure\n\n- \`workspace/\` - Agent-generated content and files\n- \`build/\` - Build artifacts and compiled outputs\n\n---\n*Workspace created: ${new Date().toLocaleString()}*\n`
                    );
                    initialFiles.push('README.md');
                } else {
                    // Create a workspace summary file
                    await fs.writeFile(
                        path.join(targetPath, 'WORKSPACE.md'),
                        `# ${workspaceDraft.name} - Workspace Repository\n\nThis workspace contains cloned repositories and deliverables.\n\n## Cloned Repositories\n\n${repoItems.map(repo => `- ${repo.title || repo.id}`).join('\n')}\n\n## Workspace Deliverables\n\nAgent-generated content and modifications will be tracked in this git repository.\n\n---\n*Workspace created: ${new Date().toLocaleString()}*\n`
                    );
                    initialFiles.push('WORKSPACE.md');
                }
                
                // Create workspace directory structure
                await fs.mkdir(path.join(targetPath, 'workspace'), { recursive: true });
                await fs.writeFile(
                    path.join(targetPath, 'workspace', '.gitkeep'),
                    '# This file keeps the workspace directory in git\n'
                );
                initialFiles.push('workspace/.gitkeep');
                
                // Create build directory structure  
                await fs.mkdir(path.join(targetPath, 'build'), { recursive: true });
                await fs.writeFile(
                    path.join(targetPath, 'build', '.gitkeep'),
                    '# This file keeps the build directory in git\n'
                );
                initialFiles.push('build/.gitkeep');
                
                // Add initial files to git
                for (const file of initialFiles) {
                    await execAsync(`git add "${file}"`, { cwd: targetPath });
                }
                
                // Create initial commit
                const commitMessage = `Initial workspace setup for ${workspaceDraft.name}\n\nWorkspace ID: ${workspaceId}\nCreated: ${new Date().toISOString()}\nContext items: ${workspaceDraft.context_items.length}\nRepositories: ${repoItems.length}`;
                
                await execAsync(`git -c user.name="Context Pipeline" -c user.email="noreply@context-pipeline.dev" commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
                    cwd: targetPath 
                });
                console.log(`✅ Initial commit created in workspace repository`);
                
                // If repositories were cloned with writeable mode, set up remote integration
                const writeableRepos = repoItems.filter(repo => 
                    (repo.library_metadata?.clone_mode || 'read-only') === 'writeable'
                );
                
                if (writeableRepos.length > 0) {
                    console.log(`🔗 Setting up remote integration for ${writeableRepos.length} writeable repositories...`);
                    // For now, we'll just create branches for workspace isolation
                    // Future enhancement: set up remote repositories for deployment
                    
                    const workspaceBranch = `workspace/${workspaceDraft.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}`;
                    await execAsync(`git checkout -b "${workspaceBranch}"`, { cwd: targetPath });
                    console.log(`✅ Created workspace branch: ${workspaceBranch}`);
                }
                
            } catch (gitError) {
                console.error(`❌ Failed to initialize git repository in target directory:`, gitError);
                // Don't fail the entire workspace creation, but log the error
                console.warn(`⚠️ Workspace created without git repository. Git operations may not work properly.`);
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
export async function DELETE(request: NextRequest) {
    await ensureWorkspaceDir();
    try {
        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('id');
        
        if (!workspaceId) {
            return NextResponse.json({
                success: false,
                error: 'Workspace ID is required'
            }, { status: 400 });
        }

        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json({
                success: false,
                error: 'Workspace not found'
            }, { status: 404 });
        }

        // Create archives directory if it doesn't exist
        const archiveDir = path.join(process.cwd(), 'storage', 'archives', 'workspaces');
        await fs.mkdir(archiveDir, { recursive: true });

        // Read workspace metadata for the archive
        let workspaceMetadata;
        try {
            const metadataPath = path.join(workspacePath, 'workspace.json');
            workspaceMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        } catch {
            workspaceMetadata = { id: workspaceId, name: `Workspace ${workspaceId}` };
        }

        // Create archive with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = `${workspaceId}-archived-${timestamp}`;
        const archivePath = path.join(archiveDir, archiveName);

        // Move workspace to archive
        await fs.rename(workspacePath, archivePath);

        // Update the archived workspace metadata
        const archivedMetadata = {
            ...workspaceMetadata,
            status: 'archived',
            archived_at: new Date().toISOString(),
            original_workspace_id: workspaceId,
            archive_location: archivePath
        };

        await fs.writeFile(
            path.join(archivePath, 'workspace.json'),
            JSON.stringify(archivedMetadata, null, 2)
        );

        // Create archive index entry
        const archiveIndexPath = path.join(archiveDir, 'archive-index.json');
        let archiveIndex = { archived_workspaces: [] };
        
        try {
            archiveIndex = JSON.parse(await fs.readFile(archiveIndexPath, 'utf-8'));
        } catch {
            // File doesn't exist, use default
        }

        archiveIndex.archived_workspaces.push({
            workspace_id: workspaceId,
            name: workspaceMetadata.name || `Workspace ${workspaceId}`,
            archived_at: new Date().toISOString(),
            archive_path: archiveName,
            original_created: workspaceMetadata.created_at || workspaceMetadata.published_at,
            context_items_count: workspaceMetadata.context_items?.length || 0
        });

        await fs.writeFile(archiveIndexPath, JSON.stringify(archiveIndex, null, 2));

        return NextResponse.json({
            success: true,
            message: `Workspace '${workspaceMetadata.name || workspaceId}' archived successfully`,
            archived_path: archiveName,
            workspace_id: workspaceId
        });

    } catch (error) {
        console.error('Failed to archive workspace:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to archive workspace',
            details: error instanceof Error ? error.message : String(error)
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