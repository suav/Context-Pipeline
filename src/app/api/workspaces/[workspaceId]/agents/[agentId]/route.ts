/**
 * Individual Agent API Route
 * Handles updating specific agent properties
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const body = await request.json();
        const { name } = body;
        
        if (!name || name.trim() === '') {
            return NextResponse.json(
                { error: 'Agent name is required' },
                { status: 400 }
            );
        }
        
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
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
        
        // Load and update active agents list
        try {
            const agentsData = await fs.readFile(agentsPath, 'utf-8');
            const agentInfo = JSON.parse(agentsData);
            
            const agentIndex = agentInfo.agents.findIndex((agent: any) => agent.id === agentId);
            if (agentIndex === -1) {
                return NextResponse.json(
                    { error: 'Agent not found' },
                    { status: 404 }
                );
            }
            
            // Update agent name
            agentInfo.agents[agentIndex].name = name.trim();
            
            // Save updated agents list
            await fs.writeFile(agentsPath, JSON.stringify(agentInfo, null, 2));
            
        } catch (error) {
            return NextResponse.json(
                { error: 'Agent not found in active agents list' },
                { status: 404 }
            );
        }
        
        // Update agent state
        try {
            const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
            const agentState = JSON.parse(agentStateData);
            
            agentState.name = name.trim();
            agentState.last_activity = new Date().toISOString();
            
            await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
        } catch (error) {
            console.warn('Could not update agent state:', error);
        }
        
        return NextResponse.json({
            success: true,
            message: 'Agent name updated successfully',
            agent: {
                id: agentId,
                name: name.trim()
            }
        });
        
    } catch (error) {
        console.error('Failed to update agent:', error);
        return NextResponse.json(
            { error: 'Failed to update agent' },
            { status: 500 }
        );
    }
}