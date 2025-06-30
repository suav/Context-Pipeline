/**
 * Individual Agent API Route
 * Get specific agent information including preferred model
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentStatePath = path.join(workspacePath, 'agents', 'states', `${agentId}.json`);
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Load agent state
        try {
            const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
            const agentState = JSON.parse(agentStateData);
            
            return NextResponse.json({
                success: true,
                agent: agentState
            });
            
        } catch (error) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }
        
    } catch (error) {
        console.error('Failed to get agent:', error);
        return NextResponse.json(
            { error: 'Failed to load agent information' },
            { status: 500 }
        );
    }
}