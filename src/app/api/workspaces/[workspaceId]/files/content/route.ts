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
    
    const fullPath = path.join(process.cwd(), 'storage', 'workspaces', workspaceId, normalizedPath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        return Response.json({ error: 'Path is not a file' }, { status: 400 });
      }
      
      // Check file size (limit to 10MB for Monaco)
      if (stats.size > 10 * 1024 * 1024) {
        return Response.json({ 
          error: 'File too large', 
          size: stats.size 
        }, { status: 413 });
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      const extension = path.extname(filePath).toLowerCase();
      
      // Determine language for Monaco
      const languageMap: Record<string, string> = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.json': 'json',
        '.md': 'markdown',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.xml': 'xml',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sql': 'sql',
        '.sh': 'shell',
        '.bash': 'shell',
        '.ps1': 'powershell',
        '.r': 'r',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.vue': 'vue',
        '.lua': 'lua',
        '.dart': 'dart',
      };
      
      return Response.json({
        success: true,
        path: filePath,
        content,
        language: languageMap[extension] || 'plaintext',
        size: stats.size,
        modified: stats.mtime,
      });
      
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return Response.json({ error: 'File not found' }, { status: 404 });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error reading file:', error);
    return Response.json({ 
      error: 'Failed to read file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}