/**
 * Context Library API Route
 * 
 * Manages context items in the library for workspace creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const LIBRARY_DIR = path.join(process.cwd(), 'storage', 'context-library');

// Ensure library directory exists
async function ensureLibraryDir() {
    try {
        await fs.access(LIBRARY_DIR);
    } catch {
        await fs.mkdir(LIBRARY_DIR, { recursive: true });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, item } = body;
        
        await ensureLibraryDir();
        
        switch (action) {
            case 'add':
                return await addItemToLibrary(item);
            case 'remove':
                return await removeItemFromLibrary(item.id);
            case 'check_dependencies':
                return await checkItemDependencies(body.itemId);
            case 'force_remove':
                return await forceRemoveItemFromEverywhere(body.itemId);
            case 'sync':
                // Filter out invalid items before syncing
                const validItems = (body.libraryData || []).filter((item: any) => 
                    item && item.id && item.source && typeof item.id === 'string' && item.title
                );
                console.log(`📤 Sync: ${body.libraryData?.length || 0} received, ${validItems.length} valid`);
                return await syncFromLocalStorage(validItems);
            default:
                return NextResponse.json(
                    { error: `Unsupported action: ${action}` },
                    { status: 400 }
                );
        }
        
    } catch (error) {
        console.error('❌ Library API Error:', error);
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
        await ensureLibraryDir();
        
        // List all items in library
        const files = await fs.readdir(LIBRARY_DIR);
        const contextFiles = files.filter(f => f.endsWith('.json'));
        
        const items = await Promise.all(
            contextFiles.map(async (file) => {
                const filePath = path.join(LIBRARY_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(content);
            })
        );
        
        return NextResponse.json({
            success: true,
            items: items.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()),
            total: items.length
        });
        
    } catch (error) {
        console.error('❌ Library GET Error:', error);
        return NextResponse.json(
            { 
                success: false,
                error: `Failed to load library: ${(error as Error).message}`,
                items: [],
                total: 0
            },
            { status: 500 }
        );
    }
}

async function addItemToLibrary(item: any) {
    try {
        // Create a filename based on item ID and source
        const fileName = `${item.source}-${item.id.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
        const filePath = path.join(LIBRARY_DIR, fileName);
        
        // Check if item already exists
        try {
            await fs.access(filePath);
            return NextResponse.json({
                success: false,
                error: 'Item already exists in library'
            });
        } catch {
            // File doesn't exist, which is what we want
        }
        
        // Add library metadata
        const libraryItem = {
            ...item,
            library_metadata: {
                added_at: new Date().toISOString(),
                filename: fileName,
                status: 'active'
            }
        };
        
        // Save to library
        await fs.writeFile(filePath, JSON.stringify(libraryItem, null, 2));
        
        console.log('✅ Added to Library:', fileName);
        
        return NextResponse.json({
            success: true,
            message: 'Item added to library successfully',
            item: libraryItem,
            filename: fileName
        });
        
    } catch (error) {
        throw new Error(`Failed to add item to library: ${(error as Error).message}`);
    }
}

async function removeItemFromLibrary(itemId: string) {
    try {
        // Validate itemId
        if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
            return NextResponse.json({
                success: false,
                error: 'Invalid item ID provided'
            });
        }
        
        // Find the file for this item
        const files = await fs.readdir(LIBRARY_DIR);
        const safeItemId = itemId?.replace(/[^a-zA-Z0-9-]/g, '_') || '';
        const targetFile = files.find(f => f.includes(safeItemId));
        
        if (!targetFile) {
            return NextResponse.json({
                success: false,
                error: 'Item not found in library'
            });
        }
        
        const filePath = path.join(LIBRARY_DIR, targetFile);
        await fs.unlink(filePath);
        
        console.log('✅ Removed from Library:', targetFile);
        
        return NextResponse.json({
            success: true,
            message: 'Item removed from library successfully',
            filename: targetFile
        });
        
    } catch (error) {
        throw new Error(`Failed to remove item from library: ${(error as Error).message}`);
    }
}

async function syncFromLocalStorage(libraryData: any[]) {
    try {
        await ensureLibraryDir();
        
        // Create a complete library backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `library-backup-${timestamp}.json`;
        const backupPath = path.join(LIBRARY_DIR, backupFileName);
        
        // Save complete library as backup
        await fs.writeFile(backupPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            itemCount: libraryData.length,
            items: libraryData
        }, null, 2));
        
        // Also save as current library
        const currentLibraryPath = path.join(LIBRARY_DIR, 'current-library.json');
        await fs.writeFile(currentLibraryPath, JSON.stringify({
            lastSync: new Date().toISOString(),
            itemCount: libraryData.length,
            items: libraryData
        }, null, 2));
        
        // Save individual items (with validation)
        for (const item of libraryData) {
            // Skip invalid items
            if (!item || !item.id || !item.source || typeof item.id !== 'string') {
                console.warn('Skipping invalid library item:', item);
                continue;
            }
            
            const fileName = `${item.source}-${item.id?.replace(/[^a-zA-Z0-9-]/g, '_') || 'unknown'}-${item.library_metadata?.clone_mode || 'default'}.json`;
            const filePath = path.join(LIBRARY_DIR, fileName);
            await fs.writeFile(filePath, JSON.stringify(item, null, 2));
        }
        
        console.log(`✅ Synced ${libraryData.length} items to file system`);
        
        return NextResponse.json({
            success: true,
            message: `Synced ${libraryData.length} items to persistent storage`,
            backupFile: backupFileName,
            itemCount: libraryData.length
        });
        
    } catch (error) {
        throw new Error(`Failed to sync library: ${(error as Error).message}`);
    }
}

async function checkItemDependencies(itemId: string) {
    try {
        const dependencies = {
            drafts: [],
            published: []
        };
        
        // Check workspace drafts
        try {
            const draftsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/workspace-drafts`);
            if (draftsResponse.ok) {
                const draftsData = await draftsResponse.json();
                const affectedDrafts = draftsData.drafts?.filter((draft: any) => 
                    draft.context_items?.some((item: any) => item.id === itemId)
                ) || [];
                dependencies.drafts = affectedDrafts.map((draft: any) => ({
                    id: draft.id,
                    name: draft.name,
                    created_at: draft.created_at
                }));
            }
        } catch (error) {
            console.warn('Could not check workspace drafts:', error);
        }
        
        // Check published workspaces
        try {
            const workspacesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/context-workflow/workspaces`);
            if (workspacesResponse.ok) {
                const workspacesData = await workspacesResponse.json();
                const affectedWorkspaces = workspacesData.workspaces?.filter((workspace: any) => 
                    workspace.context_items?.some((item: any) => item.id === itemId)
                ) || [];
                dependencies.published = affectedWorkspaces.map((workspace: any) => ({
                    id: workspace.id,
                    name: workspace.name,
                    published_at: workspace.published_at
                }));
            }
        } catch (error) {
            console.warn('Could not check published workspaces:', error);
        }
        
        return NextResponse.json({
            success: true,
            dependencies,
            hasReferences: dependencies.drafts.length > 0 || dependencies.published.length > 0
        });
        
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: `Failed to check dependencies: ${(error as Error).message}`
        }, { status: 500 });
    }
}

async function forceRemoveItemFromEverywhere(itemId: string) {
    try {
        const archiveDir = path.join(process.cwd(), 'storage', 'archives');
        await fs.mkdir(archiveDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveData = {
            timestamp,
            action: 'force_remove_item',
            itemId,
            removedFrom: [] as string[]
        };
        
        // Remove from library
        await removeItemFromLibrary(itemId);
        archiveData.removedFrom.push('library');
        
        // Remove from workspace drafts
        try {
            const draftsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/workspace-drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'remove_context_item',
                    itemId 
                })
            });
            if (draftsResponse.ok) {
                archiveData.removedFrom.push('workspace_drafts');
            }
        } catch (error) {
            console.warn('Could not remove from workspace drafts:', error);
        }
        
        // Remove from published workspaces
        try {
            const workspacesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/context-workflow/workspaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'remove_context_item',
                    itemId
                })
            });
            if (workspacesResponse.ok) {
                archiveData.removedFrom.push('published_workspaces');
            }
        } catch (error) {
            console.warn('Could not remove from published workspaces:', error);
        }
        
        // Save removal archive
        const archiveFile = path.join(archiveDir, `item-removal-${timestamp}.json`);
        await fs.writeFile(archiveFile, JSON.stringify(archiveData, null, 2));
        
        console.log(`✅ Force removed item ${itemId} from all locations`);
        
        return NextResponse.json({
            success: true,
            message: `Item removed from ${archiveData.removedFrom.join(', ')}`,
            archiveFile: `item-removal-${timestamp}.json`,
            removedFrom: archiveData.removedFrom
        });
        
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: `Failed to force remove item: ${(error as Error).message}`
        }, { status: 500 });
    }
}