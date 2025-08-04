import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return Response.json({ error: 'File path is required' }, { status: 400 });
    }
    
    // Security: ensure the path doesn't escape the workspace
    const normalizedPath = path.normalize(filePath).replace(/^[/\\]+/, '');
    if (normalizedPath.includes('..')) {
      return Response.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    // Read files from the proper directory (handle different file types)
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    // Define workspace metadata files that should be served from workspace root
    const workspaceMetadataFiles = [
      'CLAUDE.md', 'workspace.json', 'permissions.json', 'commands.json', 
      'README.md', 'context-manifest.json'
    ];
    
    // Extract the base filename for metadata check
    const baseFileName = path.basename(normalizedPath);
    
    let fullPath: string;
    let isWorkspaceMetadata = false;
    
    // Check if this is a workspace metadata file or in workspace folders
    if (workspaceMetadataFiles.includes(baseFileName) || 
        normalizedPath.startsWith('context/') || 
        normalizedPath.startsWith('.claude/') ||
        normalizedPath.startsWith('agents/') ||
        normalizedPath.startsWith('feedback/')) {
      // Serve from workspace root for metadata and workspace folders
      fullPath = path.join(workspaceDir, normalizedPath);
      isWorkspaceMetadata = true;
    } else if (normalizedPath.startsWith('target/')) {
      // Target files - use existing target path logic
      fullPath = path.join(workspaceDir, normalizedPath);
    } else {
      // Try to determine the correct location for other files
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
            
            // Check where file exists
            if (require('fs').existsSync(repoPath)) {
              fullPath = repoPath;
            } else if (require('fs').existsSync(targetPath)) {
              fullPath = targetPath;
            } else {
              // File doesn't exist
              return Response.json({ error: 'File not found' }, { status: 404 });
            }
          } else {
            // Multiple repos or no repos, try target dir
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
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        return Response.json({ error: 'Path is not a file' }, { status: 400 });
      }
      
      // Read file content
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Get file metadata
      const extension = path.extname(fullPath).toLowerCase();
      const language = getLanguageFromExtension(extension);
      
      return Response.json({
        content,
        language,
        size: stats.size,
        modified: stats.mtime,
        path: filePath,
        readOnly: isWorkspaceMetadata,
        metadata: isWorkspaceMetadata ? {
          type: 'workspace-metadata',
          description: 'Workspace configuration file - read-only for validation'
        } : undefined
      });
      
    } catch (error) {
      console.error('Error reading file:', error);
      return Response.json({ 
        error: 'Failed to read file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in content endpoint:', error);
    return Response.json({ 
      error: 'Failed to read file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.md': 'markdown',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.fish': 'shell',
    '.ps1': 'powershell',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.r': 'r',
    '.m': 'matlab',
    '.tex': 'latex',
    '.dockerfile': 'dockerfile',
    '.gitignore': 'git',
    '.env': 'dotenv',
    '.ini': 'ini',
    '.toml': 'toml',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.graphql': 'graphql',
    '.gql': 'graphql'
  };
  
  return languageMap[extension] || 'plaintext';
}