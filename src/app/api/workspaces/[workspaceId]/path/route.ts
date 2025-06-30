/**
 * Workspace Path API Route
 * Returns absolute file system paths for IDE integration
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Use persistent storage for workspaces so changes persist
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
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
        
        // Get absolute path and convert WSL to Windows format
        const absolutePath = path.resolve(workspacePath);
        
        // Convert WSL path to Windows path for IDE compatibility
        const windowsPath = absolutePath.replace(/^\/mnt\/([a-z])\//i, '$1:\\').replace(/\//g, '\\');
        
        console.log('🔄 Path conversion:', { absolutePath, windowsPath });
        
        // Look for .code-workspace file
        let workspaceFile = null;
        try {
            const files = await fs.readdir(workspacePath);
            const workspaceFiles = files.filter(f => f.endsWith('.code-workspace'));
            if (workspaceFiles.length > 0) {
                const workspaceFilePath = path.resolve(workspacePath, workspaceFiles[0]);
                workspaceFile = workspaceFilePath.replace(/^\/mnt\/([a-z])\//i, '$1:\\').replace(/\//g, '\\');
            }
        } catch (error) {
            console.warn('Could not read workspace directory:', error);
        }
        
        // Load workspace metadata for name
        let workspaceName = workspaceId;
        try {
            const metadataPath = path.join(workspacePath, 'workspace.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            workspaceName = metadata.name || workspaceId;
        } catch (error) {
            console.warn('Could not load workspace metadata:', error);
        }
        
        return NextResponse.json({
            success: true,
            workspace_id: workspaceId,
            workspace_name: workspaceName,
            absolute_path: windowsPath,
            workspace_file: workspaceFile,
            relative_path: `storage/workspaces/${workspaceId}`
        });
        
    } catch (error) {
        console.error('Failed to get workspace path:', error);
        return NextResponse.json(
            { error: 'Failed to get workspace path' },
            { status: 500 }
        );
    }
}