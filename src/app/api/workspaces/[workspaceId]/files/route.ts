import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Simple in-memory cache with TTL
const fileCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    
    // Check cache first
    const cacheKey = `files-${workspaceId}`;
    const cached = fileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Response.json(cached.data);
    }
    
    const baseDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);

    // Check if workspace exists
    try {
      await fs.access(baseDir);
    } catch {
      return Response.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get all files recursively with optimizations
    const getFiles = async (dir: string, basePath: string = '', depth: number = 0): Promise<any[]> => {
      // Increased depth limit to capture deep directory structures
      const MAX_DEPTH = 15;
      if (depth > MAX_DEPTH) return [];
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files: any[] = [];
        
        // Process entries in parallel for better performance
        const promises = entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(basePath, entry.name);

          // Skip hidden directories except .claude, and node_modules
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules') return null;
            if (entry.name.startsWith('.') && entry.name !== '.claude') return null;
            
            // Get children in parallel
            const children = await getFiles(fullPath, relativePath, depth + 1);
            return {
              path: '/' + relativePath.replace(/\\/g, '/'),
              name: entry.name,
              type: 'directory',
              children
            };
          } else {
            // Skip certain file types for performance
            const ext = path.extname(entry.name).toLowerCase();
            if (['.pyc', '.pyo', '.class', '.o', '.obj', '.exe', '.dll', '.so'].includes(ext)) return null;
            
            try {
              const stats = await fs.stat(fullPath);
              return {
                path: '/' + relativePath.replace(/\\/g, '/'),
                name: entry.name,
                type: 'file',
                size: stats.size,
                modified: stats.mtime
              };
            } catch {
              return null;
            }
          }
        });
        
        const results = await Promise.all(promises);
        return results.filter(item => item !== null);
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
        return [];
      }
    };

    const workspaceFiles = await getFiles(baseDir);

    // Organize by main folders
    const organized = {
      context: workspaceFiles.find(f => f.name === 'context') || { name: 'context', type: 'directory', children: [] },
      target: workspaceFiles.find(f => f.name === 'target') || { name: 'target', type: 'directory', children: [] },
      feedback: workspaceFiles.find(f => f.name === 'feedback') || { name: 'feedback', type: 'directory', children: [] },
      agents: workspaceFiles.find(f => f.name === 'agents') || { name: 'agents', type: 'directory', children: [] },
      other: workspaceFiles.filter(f => !['context', 'target', 'feedback', 'agents'].includes(f.name))
    };

    const responseData = { 
      success: true,
      workspaceId,
      files: organized,
      cached: false
    };
    
    // Cache the result
    fileCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    
    return Response.json(responseData);

  } catch (error) {
    console.error('Error fetching workspace files:', error);
    return Response.json({ 
      error: 'Failed to fetch workspace files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}