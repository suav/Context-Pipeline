import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const { filePath, content } = body;
    
    if (!filePath || content === undefined) {
      return Response.json({ error: 'File path and content are required' }, { status: 400 });
    }
    
    // Security: ensure the path doesn't escape the workspace
    const normalizedPath = path.normalize(filePath).replace(/^[/\\]+/, '');
    if (normalizedPath.includes('..')) {
      return Response.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    // Save files to the proper directory (handle repo-clone structure)
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    let fullPath: string;
    
    // If path already includes the full workspace structure, use it directly
    if (normalizedPath.startsWith('target/')) {
      fullPath = path.join(workspaceDir, normalizedPath);
    } else {
      // Try to determine the correct location
      const targetDir = path.join(workspaceDir, 'target');
      const hasTargetDir = require('fs').existsSync(targetDir);
      
      if (hasTargetDir) {
        // Check if this is a repo-clone scenario
        const repoCloneDir = path.join(targetDir, 'repo-clone');
        if (require('fs').existsSync(repoCloneDir)) {
          // Look for the repository directory
          const repoDirs = require('fs').readdirSync(repoCloneDir);
          if (repoDirs.length === 1) {
            // Single repo, check if file exists there
            const repoPath = path.join(repoCloneDir, repoDirs[0], normalizedPath);
            const targetPath = path.join(targetDir, normalizedPath);
            
            // Check if file exists in repo-clone
            if (require('fs').existsSync(path.dirname(repoPath))) {
              fullPath = repoPath;
            } else if (require('fs').existsSync(path.dirname(targetPath))) {
              fullPath = targetPath;
            } else {
              // Default to repo-clone for new files in git repos
              fullPath = repoPath;
            }
          } else {
            // Multiple repos or no repos, use target dir
            fullPath = path.join(targetDir, normalizedPath);
          }
        } else {
          // No repo-clone, use target directory
          fullPath = path.join(targetDir, normalizedPath);
        }
      } else {
        // No target directory, use workspace root (backwards compatibility)
        fullPath = path.join(workspaceDir, normalizedPath);
      }
    }
    
    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file content
      await fs.writeFile(fullPath, content, 'utf-8');
      
      // Get file stats
      const stats = await fs.stat(fullPath);
      
      return Response.json({
        success: true,
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        // Include flag to trigger file list refresh
        fileCreated: true,
        fullPath: fullPath
      });
      
    } catch (error) {
      console.error('Error saving file:', error);
      return Response.json({ 
        error: 'Failed to save file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in save endpoint:', error);
    return Response.json({ 
      error: 'Failed to save file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}