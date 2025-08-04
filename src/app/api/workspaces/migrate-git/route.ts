import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

interface MigrationResult {
    workspaceId: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
    details?: any;
}

/**
 * Migrate existing workspaces to have proper isolated git repositories in target/ directories
 */
export async function POST(request: NextRequest) {
    try {
        const { workspaceIds = [], dryRun = false } = await request.json();
        
        console.log(`🔧 Starting workspace git migration (dry run: ${dryRun})`);
        
        // Get all workspaces if none specified
        let workspacesToMigrate = workspaceIds;
        if (workspacesToMigrate.length === 0) {
            try {
                const workspaceDirs = await fs.readdir(WORKSPACE_BASE_DIR);
                workspacesToMigrate = workspaceDirs.filter(async (dir) => {
                    const workspacePath = path.join(WORKSPACE_BASE_DIR, dir);
                    const stat = await fs.stat(workspacePath);
                    return stat.isDirectory();
                });
            } catch (error) {
                return NextResponse.json({
                    success: false,
                    error: 'Failed to list workspaces for migration'
                }, { status: 500 });
            }
        }
        
        const results: MigrationResult[] = [];
        
        for (const workspaceId of workspacesToMigrate) {
            console.log(`🔄 Processing workspace: ${workspaceId}`);
            
            try {
                const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
                const targetPath = path.join(workspacePath, 'target');
                
                // Check if workspace exists
                try {
                    await fs.access(workspacePath);
                } catch {
                    results.push({
                        workspaceId,
                        status: 'error',
                        message: 'Workspace directory not found'
                    });
                    continue;
                }
                
                // Check if target directory exists
                try {
                    await fs.access(targetPath);
                } catch {
                    results.push({
                        workspaceId,
                        status: 'error',
                        message: 'Target directory not found'
                    });
                    continue;
                }
                
                // Check current git status in target directory
                let needsMigration = false;
                let currentGitInfo = null;
                
                try {
                    // Check if it's already a git repository
                    await execAsync('git rev-parse --git-dir', { cwd: targetPath });
                    
                    // Check if it's pointing to the main Context-Pipeline repository
                    const { stdout: remoteOutput } = await execAsync('git remote -v', { cwd: targetPath });
                    const { stdout: rootOutput } = await execAsync('git rev-parse --show-toplevel', { cwd: targetPath });
                    
                    currentGitInfo = {
                        hasGit: true,
                        remotes: remoteOutput.trim(),
                        gitRoot: rootOutput.trim()
                    };
                    
                    // Check if git root points outside the target directory (indicating it's the main repo)
                    const targetAbsPath = path.resolve(targetPath);
                    const gitRootAbsPath = path.resolve(rootOutput.trim());
                    
                    if (!gitRootAbsPath.startsWith(targetAbsPath)) {
                        needsMigration = true;
                        console.log(`⚠️ Workspace ${workspaceId} has git repo pointing to ${gitRootAbsPath}, needs migration`);
                    } else if (remoteOutput.includes('Context-Pipeline.git')) {
                        needsMigration = true;
                        console.log(`⚠️ Workspace ${workspaceId} has git repo pointing to Context-Pipeline, needs migration`);
                    } else {
                        console.log(`✅ Workspace ${workspaceId} already has proper isolated git repository`);
                    }
                    
                } catch (gitError) {
                    // No git repository found, needs initialization
                    needsMigration = true;
                    currentGitInfo = {
                        hasGit: false,
                        error: gitError.message
                    };
                    console.log(`📝 Workspace ${workspaceId} has no git repository, needs initialization`);
                }
                
                if (!needsMigration) {
                    results.push({
                        workspaceId,
                        status: 'skipped',
                        message: 'Already has proper isolated git repository',
                        details: currentGitInfo
                    });
                    continue;
                }
                
                if (dryRun) {
                    results.push({
                        workspaceId,
                        status: 'success',
                        message: 'Would migrate - creating isolated git repository',
                        details: {
                            currentGit: currentGitInfo,
                            migrationPlan: 'Remove existing git, initialize new isolated repository'
                        }
                    });
                    continue;
                }
                
                // Perform actual migration
                console.log(`🔧 Migrating workspace ${workspaceId}...`);
                
                // Step 1: Backup any existing important files
                const backupFiles = [];
                try {
                    const files = await fs.readdir(targetPath);
                    for (const file of files) {
                        if (file !== '.git' && file !== 'repo-clone') {
                            backupFiles.push(file);
                        }
                    }
                } catch {}
                
                // Step 2: Remove existing .git directory if it points to external repo
                if (currentGitInfo?.hasGit) {
                    try {
                        await fs.rm(path.join(targetPath, '.git'), { recursive: true, force: true });
                        console.log(`🗑️ Removed existing git repository from ${workspaceId}`);
                    } catch (removeError) {
                        console.warn(`⚠️ Could not remove existing .git directory: ${removeError.message}`);
                    }
                }
                
                // Step 3: Initialize new git repository
                await execAsync('git init', { cwd: targetPath });
                console.log(`✅ Initialized new git repository in ${workspaceId}`);
                
                // Step 4: Create workspace structure and initial commit
                const workspaceMetadata = await loadWorkspaceMetadata(workspacePath);
                const workspaceName = workspaceMetadata?.name || workspaceId;
                
                // Create README for the workspace
                await fs.writeFile(
                    path.join(targetPath, 'WORKSPACE.md'),
                    `# ${workspaceName} - Migrated Workspace Repository\n\nThis workspace repository was migrated to use an isolated git repository.\n\n## Migration Info\n\n- Migrated: ${new Date().toLocaleString()}\n- Original workspace: ${workspaceId}\n- Previous git: ${currentGitInfo?.remotes || 'None'}\n\n## Directory Structure\n\n- \`workspace/\` - Agent-generated content and files\n- \`build/\` - Build artifacts and compiled outputs\n- \`repo-clone/\` - Cloned external repositories (if any)\n\n---\n*Migrated by Context Pipeline Git Migration*\n`
                );
                
                // Ensure workspace and build directories exist
                await fs.mkdir(path.join(targetPath, 'workspace'), { recursive: true });
                await fs.mkdir(path.join(targetPath, 'build'), { recursive: true });
                
                // Create .gitkeep files
                await fs.writeFile(path.join(targetPath, 'workspace', '.gitkeep'), '# Workspace directory\n');
                await fs.writeFile(path.join(targetPath, 'build', '.gitkeep'), '# Build directory\n');
                
                // Add files to git
                await execAsync('git add .', { cwd: targetPath });
                
                // Create initial commit
                const commitMessage = `Migrate workspace to isolated git repository\n\nWorkspace: ${workspaceName}\nID: ${workspaceId}\nMigrated: ${new Date().toISOString()}\n\nThis commit creates an isolated git repository for workspace deliverables.`;
                
                await execAsync(`git -c user.name="Context Pipeline Migration" -c user.email="noreply@context-pipeline.dev" commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
                    cwd: targetPath 
                });
                
                // Create a workspace branch
                const workspaceBranch = `workspace/${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-migrated`;
                await execAsync(`git checkout -b "${workspaceBranch}"`, { cwd: targetPath });
                
                console.log(`✅ Successfully migrated workspace ${workspaceId}`);
                
                results.push({
                    workspaceId,
                    status: 'success',
                    message: 'Successfully migrated to isolated git repository',
                    details: {
                        previousGit: currentGitInfo,
                        newBranch: workspaceBranch,
                        backupFiles: backupFiles.length
                    }
                });
                
            } catch (error) {
                console.error(`❌ Failed to migrate workspace ${workspaceId}:`, error);
                results.push({
                    workspaceId,
                    status: 'error',
                    message: `Migration failed: ${error.message}`,
                    details: error.stack
                });
            }
        }
        
        const summary = {
            total: results.length,
            successful: results.filter(r => r.status === 'success').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            failed: results.filter(r => r.status === 'error').length
        };
        
        console.log(`🎯 Migration complete: ${summary.successful} successful, ${summary.skipped} skipped, ${summary.failed} failed`);
        
        return NextResponse.json({
            success: true,
            dryRun,
            summary,
            results
        });
        
    } catch (error) {
        console.error('Migration failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Migration process failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * Get migration status for workspaces
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspaceId');
        
        if (workspaceId) {
            // Check specific workspace
            const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
            const targetPath = path.join(workspacePath, 'target');
            
            try {
                await fs.access(targetPath);
                
                // Check git status
                let gitStatus = null;
                try {
                    await execAsync('git rev-parse --git-dir', { cwd: targetPath });
                    const { stdout: remoteOutput } = await execAsync('git remote -v', { cwd: targetPath });
                    const { stdout: rootOutput } = await execAsync('git rev-parse --show-toplevel', { cwd: targetPath });
                    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: targetPath });
                    
                    gitStatus = {
                        hasGit: true,
                        remotes: remoteOutput.trim(),
                        gitRoot: rootOutput.trim(),
                        currentBranch: branchOutput.trim(),
                        needsMigration: !rootOutput.trim().includes(targetPath) || remoteOutput.includes('Context-Pipeline.git')
                    };
                } catch {
                    gitStatus = {
                        hasGit: false,
                        needsMigration: true
                    };
                }
                
                return NextResponse.json({
                    success: true,
                    workspaceId,
                    gitStatus
                });
            } catch {
                return NextResponse.json({
                    success: false,
                    error: 'Workspace not found'
                }, { status: 404 });
            }
        } else {
            // Check all workspaces
            const workspaceDirs = await fs.readdir(WORKSPACE_BASE_DIR);
            const workspaceStatuses = [];
            
            for (const dir of workspaceDirs) {
                try {
                    const workspacePath = path.join(WORKSPACE_BASE_DIR, dir);
                    const targetPath = path.join(workspacePath, 'target');
                    const stat = await fs.stat(workspacePath);
                    
                    if (stat.isDirectory()) {
                        let needsMigration = false;
                        let hasTarget = false;
                        
                        try {
                            await fs.access(targetPath);
                            hasTarget = true;
                            
                            try {
                                await execAsync('git rev-parse --git-dir', { cwd: targetPath });
                                const { stdout: rootOutput } = await execAsync('git rev-parse --show-toplevel', { cwd: targetPath });
                                needsMigration = !rootOutput.trim().includes(targetPath);
                            } catch {
                                needsMigration = true;
                            }
                        } catch {
                            // No target directory
                        }
                        
                        workspaceStatuses.push({
                            workspaceId: dir,
                            hasTarget,
                            needsMigration
                        });
                    }
                } catch (error) {
                    console.error(`Error checking workspace ${dir}:`, error);
                }
            }
            
            return NextResponse.json({
                success: true,
                workspaces: workspaceStatuses,
                summary: {
                    total: workspaceStatuses.length,
                    needsMigration: workspaceStatuses.filter(w => w.needsMigration).length,
                    hasTarget: workspaceStatuses.filter(w => w.hasTarget).length
                }
            });
        }
    } catch (error) {
        console.error('Failed to check migration status:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to check migration status'
        }, { status: 500 });
    }
}

async function loadWorkspaceMetadata(workspacePath: string) {
    try {
        const metadataPath = path.join(workspacePath, 'workspace.json');
        return JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    } catch {
        return null;
    }
}