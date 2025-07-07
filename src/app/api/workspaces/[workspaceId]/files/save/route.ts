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
    
    const fullPath = path.join(process.cwd(), 'storage', 'workspaces', workspaceId, normalizedPath);
    
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