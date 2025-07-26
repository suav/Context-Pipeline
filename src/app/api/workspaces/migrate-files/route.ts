import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

interface FileMigrationResult {
    workspaceId: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
    details?: any;
}

/**
 * Migrate workspace files to target directory for git tracking
 */
export async function POST(request: NextRequest) {
    try {
        const { workspaceIds = [], dryRun = false } = await request.json();
        
        console.log(`📁 Starting workspace file migration to target/ directories (dry run: ${dryRun})`);
        
        // Get all workspaces if none specified
        let workspacesToMigrate = workspaceIds;
        if (workspacesToMigrate.length === 0) {
            try {
                const workspaceDirs = await fs.readdir(WORKSPACE_BASE_DIR);
                const validWorkspaces = [];
                for (const dir of workspaceDirs) {
                    const workspacePath = path.join(WORKSPACE_BASE_DIR, dir);
                    try {
                        const stat = await fs.stat(workspacePath);
                        if (stat.isDirectory()) {
                            validWorkspaces.push(dir);
                        }
                    } catch {}
                }
                workspacesToMigrate = validWorkspaces;
            } catch (error) {
                return NextResponse.json({
                    success: false,
                    error: 'Failed to list workspaces for migration'
                }, { status: 500 });
            }
        }
        
        const results: FileMigrationResult[] = [];
        
        for (const workspaceId of workspacesToMigrate) {
            console.log(`📂 Processing workspace: ${workspaceId}`);
            
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
                        message: 'Target directory not found - run git migration first'
                    });
                    continue;
                }
                
                // Find workspace files that should be in target directory
                const workspaceFiles = await findWorkspaceFiles(workspacePath, targetPath);
                
                if (workspaceFiles.length === 0) {
                    results.push({
                        workspaceId,
                        status: 'skipped',
                        message: 'No workspace files found to migrate',
                        details: { filesFound: 0 }
                    });
                    continue;
                }
                
                if (dryRun) {
                    results.push({
                        workspaceId,
                        status: 'success',
                        message: `Would migrate ${workspaceFiles.length} files to target directory`,
                        details: {
                            filesToMigrate: workspaceFiles.map(f => f.relativePath),
                            totalFiles: workspaceFiles.length
                        }
                    });
                    continue;
                }
                
                // Perform actual file migration
                console.log(`📦 Migrating ${workspaceFiles.length} files in workspace ${workspaceId}...`);
                
                const migratedFiles = [];
                const errors = [];
                
                for (const fileInfo of workspaceFiles) {
                    try {
                        const sourceFile = path.join(workspacePath, fileInfo.relativePath);
                        const targetFile = path.join(targetPath, 'workspace', fileInfo.relativePath);
                        
                        // Ensure target directory exists
                        const targetDir = path.dirname(targetFile);
                        await fs.mkdir(targetDir, { recursive: true });
                        
                        // Copy file to target location
                        await fs.copyFile(sourceFile, targetFile);
                        
                        // Verify copy was successful
                        const sourceStats = await fs.stat(sourceFile);
                        const targetStats = await fs.stat(targetFile);
                        
                        if (sourceStats.size === targetStats.size) {
                            migratedFiles.push({
                                from: fileInfo.relativePath,
                                to: `workspace/${fileInfo.relativePath}`,
                                size: sourceStats.size
                            });
                            
                            // Remove original file after successful copy
                            await fs.unlink(sourceFile);
                            console.log(`✅ Migrated: ${fileInfo.relativePath}`);
                        } else {
                            errors.push(`Size mismatch for ${fileInfo.relativePath}`);
                        }
                        
                    } catch (error) {
                        console.error(`❌ Failed to migrate ${fileInfo.relativePath}:`, error);
                        errors.push(`${fileInfo.relativePath}: ${error.message}`);
                    }
                }
                
                // Add migrated files to git if migration was successful
                if (migratedFiles.length > 0 && errors.length === 0) {
                    try {
                        // Add all files to git
                        await execAsync('git add workspace/', { cwd: targetPath });
                        
                        // Create commit for migrated files
                        const commitMessage = `Migrate workspace files to target directory\n\nMigrated ${migratedFiles.length} files:\n${migratedFiles.map(f => `- ${f.from} → ${f.to}`).join('\n')}\n\nFiles are now tracked in the workspace git repository.`;
                        
                        await execAsync(`git -c user.name="Context Pipeline Migration" -c user.email="noreply@context-pipeline.dev" commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
                            cwd: targetPath 
                        });
                        
                        console.log(`✅ Committed ${migratedFiles.length} migrated files to git`);
                        
                    } catch (gitError) {
                        console.warn(`⚠️ Could not commit migrated files to git: ${gitError.message}`);
                        // Don't fail the migration if git commit fails
                    }
                }
                
                results.push({
                    workspaceId,
                    status: migratedFiles.length > 0 && errors.length === 0 ? 'success' : 'error',
                    message: errors.length > 0 ? 
                        `Migrated ${migratedFiles.length} files, ${errors.length} errors` :
                        `Successfully migrated ${migratedFiles.length} files to target directory`,
                    details: {
                        migratedFiles,
                        errors,
                        totalProcessed: workspaceFiles.length
                    }
                });
                
            } catch (error) {
                console.error(`❌ Failed to migrate files in workspace ${workspaceId}:`, error);
                results.push({
                    workspaceId,
                    status: 'error',
                    message: `File migration failed: ${error.message}`,
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
        
        console.log(`🎯 File migration complete: ${summary.successful} successful, ${summary.skipped} skipped, ${summary.failed} failed`);
        
        return NextResponse.json({
            success: true,
            dryRun,
            summary,
            results
        });
        
    } catch (error) {
        console.error('File migration failed:', error);
        return NextResponse.json({
            success: false,
            error: 'File migration process failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * Find workspace files that should be migrated to target directory
 */
async function findWorkspaceFiles(workspacePath: string, targetPath: string): Promise<{relativePath: string, isFile: boolean}[]> {
    const workspaceFiles: {relativePath: string, isFile: boolean}[] = [];
    
    // Directories to exclude from migration (these should stay in workspace root)
    const excludeDirs = ['context', 'target', 'feedback', 'agents', '.git', 'node_modules'];
    
    const scanDirectory = async (dir: string, basePath: string = '') => {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const relativePath = path.join(basePath, entry.name).replace(/\\\\/g, '/');
                const fullPath = path.join(dir, entry.name);
                
                // Skip excluded directories if we're at workspace root
                if (basePath === '' && excludeDirs.includes(entry.name)) {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    await scanDirectory(fullPath, relativePath);
                } else if (entry.isFile()) {
                    // Only migrate certain file types that should be in the workspace
                    const ext = path.extname(entry.name).toLowerCase();
                    const workspaceFileExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.yml', '.yaml', '.xml', '.html', '.css', '.scss', '.sql', '.sh', '.bash'];
                    
                    // Also include files without extensions and common config files
                    const configFiles = ['Dockerfile', 'Makefile', 'README', 'LICENSE', '.env', '.gitignore'];
                    const isConfigFile = configFiles.includes(entry.name) || configFiles.some(cf => entry.name.startsWith(cf));
                    
                    if (workspaceFileExts.includes(ext) || isConfigFile || !ext) {
                        workspaceFiles.push({ relativePath, isFile: true });
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
        }
    };
    
    await scanDirectory(workspacePath);
    return workspaceFiles;
}

/**
 * Get file migration status for workspaces
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
                await fs.access(workspacePath);
                
                const workspaceFiles = await findWorkspaceFiles(workspacePath, targetPath);
                
                return NextResponse.json({
                    success: true,
                    workspaceId,
                    filesToMigrate: workspaceFiles.length,
                    files: workspaceFiles.map(f => f.relativePath)
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
                        const workspaceFiles = await findWorkspaceFiles(workspacePath, targetPath);
                        
                        workspaceStatuses.push({
                            workspaceId: dir,
                            filesToMigrate: workspaceFiles.length,
                            needsMigration: workspaceFiles.length > 0
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
                    totalFiles: workspaceStatuses.reduce((sum, w) => sum + w.filesToMigrate, 0)
                }
            });
        }
    } catch (error) {
        console.error('Failed to check file migration status:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to check file migration status'
        }, { status: 500 });
    }
}