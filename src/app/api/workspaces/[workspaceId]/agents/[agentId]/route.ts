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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const body = await request.json();
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentStatePath = path.join(workspacePath, 'agents', 'states', `${agentId}.json`);
        
        // Load current agent state
        try {
            const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
            const agentState = JSON.parse(agentStateData);
            
            // Update fields from body
            if (body.name) agentState.name = body.name;
            if (body.title) agentState.title = body.title;
            if (body.preferredModel) agentState.preferred_model = body.preferredModel;
            
            // Update last activity
            agentState.last_activity = new Date().toISOString();
            
            // Save updated state
            await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
            
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
        console.error('Failed to update agent:', error);
        return NextResponse.json(
            { error: 'Failed to update agent' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        
        // Remove agent from active agents list
        const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
        try {
            const agentsData = await fs.readFile(agentsPath, 'utf-8');
            const agentInfo = JSON.parse(agentsData);
            
            // Filter out the agent to delete
            agentInfo.agents = agentInfo.agents.filter((agent: any) => agent.id !== agentId);
            
            await fs.writeFile(agentsPath, JSON.stringify(agentInfo, null, 2));
        } catch (error) {
            console.warn('Could not update active agents list:', error);
        }
        
        // Remove agent state file
        const agentStatePath = path.join(workspacePath, 'agents', 'states', `${agentId}.json`);
        try {
            await fs.unlink(agentStatePath);
        } catch (error) {
            console.warn('Could not remove agent state file:', error);
        }
        
        // Remove conversation history
        const conversationPath = path.join(workspacePath, 'agents', 'conversations', `${agentId}.json`);
        try {
            await fs.unlink(conversationPath);
        } catch (error) {
            console.warn('Could not remove conversation history:', error);
        }
        
        // Remove agent directory if it exists
        const agentDirPath = path.join(workspacePath, 'agents', agentId);
        try {
            await fs.rmdir(agentDirPath, { recursive: true });
        } catch (error) {
            console.warn('Could not remove agent directory:', error);
        }
        
        return NextResponse.json({
            success: true,
            message: 'Agent deleted successfully'
        });
        
    } catch (error) {
        console.error('Failed to delete agent:', error);
        return NextResponse.json(
            { error: 'Failed to delete agent' },
            { status: 500 }
        );
    }
}