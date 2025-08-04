import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
const DRAFTS_DIR = path.join(process.cwd(), 'storage', 'workspace-drafts');
// Ensure drafts directory exists
async function ensureDraftsDir() {
    try {
        await fs.mkdir(DRAFTS_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create drafts directory:', error);
    }
}
export async function POST(request: NextRequest) {
    await ensureDraftsDir();
    try {
        const body = await request.json();
        const { action, drafts, workspaceDraft, itemId } = body;
        if (action === 'update') {
            // Update a specific workspace draft
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `draft-update-${workspaceDraft.id}-${timestamp}.json`;
            const filePath = path.join(DRAFTS_DIR, fileName);
            await fs.writeFile(filePath, JSON.stringify({
                timestamp: new Date().toISOString(),
                action: 'update',
                draft: workspaceDraft
            }, null, 2));
            return NextResponse.json({
                success: true,
                message: 'Workspace draft updated successfully',
                draft_id: workspaceDraft.id
            });
        }
        if (action === 'sync') {
            // Save drafts to file system
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `drafts-${timestamp}.json`;
            const filePath = path.join(DRAFTS_DIR, fileName);
            await fs.writeFile(filePath, JSON.stringify({
                timestamp: new Date().toISOString(),
                count: drafts.length,
                drafts: drafts
            }, null, 2));
            // Also save as current drafts
            const currentPath = path.join(DRAFTS_DIR, 'current-drafts.json');
            await fs.writeFile(currentPath, JSON.stringify({
                lastSync: new Date().toISOString(),
                count: drafts.length,
                drafts: drafts
            }, null, 2));
            return NextResponse.json({
                success: true,
                message: `Synced ${drafts.length} drafts to storage`,
                filePath: filePath
            });
        }
        if (action === 'remove_context_item') {
            // Remove a specific context item from all drafts
            try {
                const currentPath = path.join(DRAFTS_DIR, 'current-drafts.json');
                let currentData = { drafts: [] };
                try {
                    const data = await fs.readFile(currentPath, 'utf-8');
                    currentData = JSON.parse(data);
                } catch (error) {
                    // No current drafts file, nothing to do
                    return NextResponse.json({
                        success: true,
                        message: 'No drafts found to update',
                        removedFrom: []
                    });
                }
                let updatedCount = 0;
                const removedFrom: string[] = [];
                // Remove the context item from all drafts
                const updatedDrafts = currentData.drafts.map((draft: any) => {
                    const originalCount = draft.context_items?.length || 0;
                    const filteredItems = draft.context_items?.filter((item: any) => item.id !== itemId) || [];
                    if (filteredItems.length < originalCount) {
                        updatedCount++;
                        removedFrom.push(draft.name);
                        return {
                            ...draft,
                            context_items: filteredItems,
                            last_updated: new Date().toISOString()
                        };
                    }
                    return draft;
                });
                // Save updated drafts
                await fs.writeFile(currentPath, JSON.stringify({
                    lastSync: new Date().toISOString(),
                    count: updatedDrafts.length,
                    drafts: updatedDrafts
                }, null, 2));
                // Also create a removal log
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const logPath = path.join(DRAFTS_DIR, `item-removal-${timestamp}.json`);
                await fs.writeFile(logPath, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    action: 'remove_context_item',
                    itemId,
                    updatedDrafts: updatedCount,
                    removedFrom
                }, null, 2));
                return NextResponse.json({
                    success: true,
                    message: `Context item removed from ${updatedCount} draft(s)`,
                    removedFrom,
                    updatedDrafts: updatedCount
                });
            } catch (error) {
                console.error('Failed to remove context item from drafts:', error);
                return NextResponse.json({
                    success: false,
                    error: 'Failed to remove context item from drafts'
                }, { status: 500 });
            }
        }
        return NextResponse.json({
            success: false,
            error: 'Unknown action'
        }, { status: 400 });
    } catch (error) {
        console.error('Draft sync failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to sync drafts'
        }, { status: 500 });
    }
}
export async function GET(request: NextRequest) {
    await ensureDraftsDir();
    try {
        const currentPath = path.join(DRAFTS_DIR, 'current-drafts.json');
        try {
            const data = await fs.readFile(currentPath, 'utf-8');
            const parsed = JSON.parse(data);
            return NextResponse.json({
                success: true,
                drafts: parsed.drafts || [],
                lastSync: parsed.lastSync
            });
        } catch (error) {
            // No current drafts file
            return NextResponse.json({
                success: true,
                drafts: [],
                lastSync: null
            });
        }
    } catch (error) {
        console.error('Failed to load drafts:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to load drafts'
        }, { status: 500 });
    }
}