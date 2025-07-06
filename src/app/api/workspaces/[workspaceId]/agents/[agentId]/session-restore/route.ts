/**
 * Session Restore API Route
 * Attempts to restore a previous Claude session for continuity
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; agentId: string }> }
) {
    try {
        const { workspaceId, agentId } = await params;
        const body = await request.json();
        const { sessionId, model } = body;
        
        if (!sessionId) {
            return NextResponse.json(
                { error: 'sessionId is required' },
                { status: 400 }
            );
        }
        
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
        
        // Load agent state to check for session continuity
        let agentState;
        try {
            const agentStateData = await fs.readFile(agentStatePath, 'utf-8');
            agentState = JSON.parse(agentStateData);
        } catch {
            // No existing state - session cannot be restored
            return NextResponse.json({
                success: true,
                restored: false,
                reason: 'No previous agent state found',
                sessionId: null
            });
        }
        
        // Check if the session ID matches and is recent (within last 24 hours)
        const now = new Date();
        const lastActivity = agentState.last_activity ? new Date(agentState.last_activity) : null;
        const isRecent = lastActivity && (now.getTime() - lastActivity.getTime()) < 24 * 60 * 60 * 1000;
        
        if (agentState.last_session_id === sessionId && isRecent) {
            // Session can potentially be restored
            console.log(`🔄 Attempting to restore session ${sessionId} for agent ${agentId}`);
            
            // Update agent state to indicate session restoration attempt
            agentState.status = 'restoring';
            agentState.last_activity = now.toISOString();
            agentState.session_restore_attempted = now.toISOString();
            agentState.current_task = `Restoring session ${sessionId.slice(-8)}`;
            
            await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
            
            return NextResponse.json({
                success: true,
                restored: true,
                sessionId: sessionId,
                reason: 'Session found and restoration attempted',
                lastActivity: lastActivity.toISOString(),
                agentStatus: agentState.status
            });
            
        } else {
            // Session is too old or doesn't match - start fresh
            console.log(`❌ Cannot restore session ${sessionId}: ${!isRecent ? 'too old' : 'session ID mismatch'}`);
            
            // Update agent state for new session
            agentState.status = 'idle';
            agentState.last_activity = now.toISOString();
            agentState.last_session_id = null; // Clear old session
            agentState.current_task = null;
            
            await fs.writeFile(agentStatePath, JSON.stringify(agentState, null, 2));
            
            return NextResponse.json({
                success: true,
                restored: false,
                reason: !isRecent ? 'Session too old (>24h)' : 'Session ID mismatch',
                sessionId: null,
                lastActivity: lastActivity ? lastActivity.toISOString() : null
            });
        }
        
    } catch (error) {
        console.error('Failed to restore session:', error);
        return NextResponse.json(
            { error: 'Failed to restore session' },
            { status: 500 }
        );
    }
}