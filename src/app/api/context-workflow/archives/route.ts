import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
const ARCHIVE_DIR = path.join(process.cwd(), 'storage', 'archives');
// Ensure archive directory exists
async function ensureArchiveDir() {
    try {
        await fs.access(ARCHIVE_DIR);
    } catch {
        await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    }
}
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;
        await ensureArchiveDir();
        switch (action) {
            case 'archive_workspace':
                return await archiveWorkspace(body);
            case 'archive_draft':
                return await archiveWorkspaceDraft(body);
            case 'restore':
                return await restoreFromArchive(body);
            default:
                return NextResponse.json(
                    { error: `Unsupported action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('❌ Archive API Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: `Server error: ${(error as Error).message}`
            },
            { status: 500 }
        );
    }
}
export async function GET() {
    try {
        await ensureArchiveDir();
        // List all archived items
        const files = await fs.readdir(ARCHIVE_DIR);
        const archiveFiles = files.filter(f => f.endsWith('.json'));
        const archives = await Promise.all(
            archiveFiles.map(async (file) => {
                const filePath = path.join(ARCHIVE_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const archiveData = JSON.parse(content);
                return {
                    filename: file,
                    ...archiveData,
                    archived_at: archiveData.timestamp
                };
            })
        );
        // Group by type
        const grouped = {
            workspaces: archives.filter(a => a.type === 'workspace'),
            drafts: archives.filter(a => a.type === 'workspace_draft'),
            removals: archives.filter(a => a.action === 'force_remove_item'),
            other: archives.filter(a => !['workspace', 'workspace_draft'].includes(a.type) && a.action !== 'force_remove_item')
        };
        return NextResponse.json({
            success: true,
            archives: grouped,
            total: archives.length
        });
    } catch (error) {
        console.error('❌ Archive GET Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: `Failed to load archives: ${(error as Error).message}`,
                archives: { workspaces: [], drafts: [], removals: [], other: [] },
                total: 0
            },
            { status: 500 }
        );
    }
}
async function archiveWorkspace(body: any) {
    try {
        const { workspace, reason = 'manual_archive' } = body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFileName = `workspace-${workspace.id}-${timestamp}.json`;
        const archiveData = {
            id: workspace.id,
            type: 'workspace',
            timestamp: new Date().toISOString(),
            reason,
            original_data: workspace,
            metadata: {
                archived_by: 'system',
                archive_reason: reason,
                original_status: workspace.status || 'published',
                context_item_count: workspace.context_items?.length || 0,
                agent_count: workspace.agents?.length || 0
            },
            restoration_info: {
                can_restore: true,
                restore_type: 'workspace',
                dependencies: workspace.context_items?.map((item: any) => item.id) || []
            }
        };
        // Save archive
        const archivePath = path.join(ARCHIVE_DIR, archiveFileName);
        await fs.writeFile(archivePath, JSON.stringify(archiveData, null, 2));
        console.log(`📦 Archived workspace: ${workspace.name} -> ${archiveFileName}`);
        return NextResponse.json({
            success: true,
            message: `Workspace "${workspace.name}" archived successfully`,
            archiveFile: archiveFileName,
            archiveData: {
                id: archiveData.id,
                type: archiveData.type,
                timestamp: archiveData.timestamp,
                reason: archiveData.reason
            }
        });
    } catch (error) {
        throw new Error(`Failed to archive workspace: ${(error as Error).message}`);
    }
}
async function archiveWorkspaceDraft(body: any) {
    try {
        const { draft, reason = 'manual_archive' } = body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFileName = `draft-${draft.id}-${timestamp}.json`;
        const archiveData = {
            id: draft.id,
            type: 'workspace_draft',
            timestamp: new Date().toISOString(),
            reason,
            original_data: draft,
            metadata: {
                archived_by: 'system',
                archive_reason: reason,
                original_status: draft.status || 'draft',
                context_item_count: draft.context_items?.length || 0,
                last_modified: draft.last_updated || draft.created_at
            },
            restoration_info: {
                can_restore: true,
                restore_type: 'workspace_draft',
                dependencies: draft.context_items?.map((item: any) => item.id) || []
            }
        };
        // Save archive
        const archivePath = path.join(ARCHIVE_DIR, archiveFileName);
        await fs.writeFile(archivePath, JSON.stringify(archiveData, null, 2));
        console.log(`📦 Archived workspace draft: ${draft.name} -> ${archiveFileName}`);
        return NextResponse.json({
            success: true,
            message: `Workspace draft "${draft.name}" archived successfully`,
            archiveFile: archiveFileName,
            archiveData: {
                id: archiveData.id,
                type: archiveData.type,
                timestamp: archiveData.timestamp,
                reason: archiveData.reason
            }
        });
    } catch (error) {
        throw new Error(`Failed to archive workspace draft: ${(error as Error).message}`);
    }
}
async function restoreFromArchive(body: any) {
    try {
        const { archiveFile, targetType = 'draft' } = body;
        const archivePath = path.join(ARCHIVE_DIR, archiveFile);
        const archiveContent = await fs.readFile(archivePath, 'utf-8');
        const archiveData = JSON.parse(archiveContent);
        if (!archiveData.restoration_info?.can_restore) {
            return NextResponse.json({
                success: false,
                error: 'This archive cannot be restored'
            }, { status: 400 });
        }
        // Prepare restored item
        const restoredItem = {
            ...archiveData.original_data,
            id: `${archiveData.original_data.id}-restored-${Date.now()}`,
            name: `${archiveData.original_data.name} (Restored)`,
            status: targetType === 'draft' ? 'draft' : 'published',
            restored_from: archiveFile,
            restored_at: new Date().toISOString(),
            restoration_metadata: {
                original_id: archiveData.original_data.id,
                archived_at: archiveData.timestamp,
                archive_reason: archiveData.reason
            }
        };
        // Restore based on target type
        if (targetType === 'draft') {
            // Restore as workspace draft
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/workspace-drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    workspaceDraft: restoredItem
                })
            });
            if (!response.ok) {
                throw new Error('Failed to restore as workspace draft');
            }
        } else {
            // Restore as published workspace
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/context-workflow/workspaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'restore',
                    workspace: restoredItem
                })
            });
            if (!response.ok) {
                throw new Error('Failed to restore as published workspace');
            }
        }
        console.log(`♻️ Restored from archive: ${archiveFile} as ${targetType}`);
        return NextResponse.json({
            success: true,
            message: `Successfully restored "${restoredItem.name}" as ${targetType}`,
            restoredItem: {
                id: restoredItem.id,
                name: restoredItem.name,
                type: targetType,
                restored_at: restoredItem.restored_at
            }
        });
    } catch (error) {
        throw new Error(`Failed to restore from archive: ${(error as Error).message}`);
    }
}