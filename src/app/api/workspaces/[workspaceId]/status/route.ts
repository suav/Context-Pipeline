/**
 * Workspace Status API Route
 * Provides real-time status information for workspace cards
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiCache, cacheKeys } from '@/lib/api-cache';

// Use persistent storage for workspaces so changes persist
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        
        // Check cache first
        const cacheKey = cacheKeys.workspaceStatus(workspaceId);
        const cached = apiCache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }
        
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        
        // Check if workspace exists (use sync version for faster check)
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Load status information in parallel
        const statusPath = path.join(workspacePath, 'feedback', 'status.json');
        const progressPath = path.join(workspacePath, 'feedback', 'progress.json');
        const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
        
        // Create parallel file read promises
        const filePromises = [
            fs.readFile(statusPath, 'utf-8').then(data => ({ type: 'status', data: JSON.parse(data) })).catch(() => ({ type: 'status', data: null })),
            fs.readFile(progressPath, 'utf-8').then(data => ({ type: 'progress', data: JSON.parse(data) })).catch(() => ({ type: 'progress', data: null })),
            fs.readFile(agentsPath, 'utf-8').then(data => ({ type: 'agents', data: JSON.parse(data) })).catch(() => ({ type: 'agents', data: null }))
        ];
        
        // Execute all file reads in parallel
        const results = await Promise.all(filePromises);
        
        // Extract results
        let status: any = null;
        let progress: any = null;
        let agents: any[] = [];
        
        results.forEach(result => {
            switch (result.type) {
                case 'status':
                    status = result.data;
                    break;
                case 'progress':
                    progress = result.data;
                    break;
                case 'agents':
                    agents = result.data?.agents || [];
                    break;
            }
        });
        
        const response = {
            success: true,
            workspace_id: workspaceId,
            status: {
                phase: status?.phase || 'ready',
                progress: progress?.overall_progress || 0,
                active_agents: agents.length,
                last_updated: status?.last_updated || new Date().toISOString(),
                messages: status?.messages || []
            },
            agents: agents.map((agent: any) => ({
                id: agent.id,
                name: agent.name,
                color: agent.color,
                status: agent.status,
                created_at: agent.created_at
            }))
        };
        
        // Cache the response for 2 seconds
        apiCache.set(cacheKey, response, 2000);
        
        return NextResponse.json(response);
        
    } catch (error) {
        console.error('Failed to get workspace status:', error);
        return NextResponse.json(
            { error: 'Failed to load workspace status' },
            { status: 500 }
        );
    }
}