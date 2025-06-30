/**
 * Agent History API Route
 * Provides detailed history and logs for a specific agent
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_BASE_DIR = path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentHistoryPath = path.join(workspacePath, 'agents', 'history', agentId, 'history.json');
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
        
        // Load agent state (current info)
        let agentState = null;
        try {
            const stateData = await fs.readFile(agentStatePath, 'utf-8');
            agentState = JSON.parse(stateData);
        } catch (error) {
            console.warn('Could not load agent state:', error);
        }
        
        // Load agent history
        try {
            const historyData = await fs.readFile(agentHistoryPath, 'utf-8');
            const history = JSON.parse(historyData);
            
            // Merge current state info if available
            if (agentState) {
                history.current_status = agentState.status;
                history.last_activity = agentState.last_activity;
                history.current_task = agentState.current_task;
            }
            
            return NextResponse.json(history);
            
        } catch (error) {
            // If no history file exists, create a basic response from state
            if (agentState) {
                return NextResponse.json({
                    agent_id: agentId,
                    name: agentState.name || 'Unknown Agent',
                    created_at: agentState.created_at || new Date().toISOString(),
                    total_interactions: agentState.interaction_count || 0,
                    sessions: [],
                    current_session: null,
                    current_status: agentState.status,
                    last_activity: agentState.last_activity,
                    current_task: agentState.current_task
                });
            }
            
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }
        
    } catch (error) {
        console.error('Failed to get agent history:', error);
        return NextResponse.json(
            { error: 'Failed to load agent history' },
            { status: 500 }
        );
    }
}