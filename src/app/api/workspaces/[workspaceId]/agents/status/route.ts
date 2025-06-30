/**
 * Agent Status API Route
 * Provides aggregate status information for all agents in a workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { apiCache, cacheKeys } from '@/lib/api-cache';

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        
        // Check cache first
        const cacheKey = cacheKeys.agentStatus(workspaceId);
        const cached = apiCache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
        const statesDir = path.join(workspacePath, 'agents', 'states');
        
        // Check if workspace exists (fast fail for non-existent workspaces)
        try {
            await fs.access(workspacePath);
        } catch {
            // Cache the 404 response briefly to avoid repeated filesystem checks
            const errorResponse = { error: 'Workspace not found' };
            apiCache.set(cacheKey, errorResponse, 5000);
            return NextResponse.json(errorResponse, { status: 404 });
        }
        
        // Load active agents
        let agents = [];
        try {
            const agentsData = await fs.readFile(agentsPath, 'utf-8');
            const agentInfo = JSON.parse(agentsData);
            agents = agentInfo.agents || [];
        } catch {
            // No agents file means no agents
            return NextResponse.json({
                success: true,
                status: {
                    total: 0,
                    active: 0,
                    idle: 0,
                    error: 0
                },
                agents: []
            });
        }
        
        // Load individual agent states in parallel
        const statusCounts = {
            total: agents.length,
            active: 0,
            idle: 0,
            error: 0
        };
        
        // Create parallel promises for all agent state reads
        const statePromises = agents.map(async (agent: {id: string, name: string, color?: string}) => {
            try {
                const statePath = path.join(statesDir, `${agent.id}.json`);
                const stateData = await fs.readFile(statePath, 'utf-8');
                const state = JSON.parse(stateData);
                
                return {
                    id: agent.id,
                    name: agent.name,
                    color: agent.color,
                    status: state.status || 'idle',
                    last_activity: state.last_activity,
                    current_task: state.current_task,
                    interaction_count: state.interaction_count || 0,
                    _status: state.status || 'idle'
                };
            } catch {
                // Agent state file missing, treat as idle
                return {
                    id: agent.id,
                    name: agent.name,
                    color: agent.color,
                    status: 'idle',
                    last_activity: new Date().toISOString(),
                    current_task: null,
                    interaction_count: 0,
                    _status: 'idle'
                };
            }
        });
        
        // Execute all file reads in parallel
        const agentStates = await Promise.all(statePromises);
        
        // Count statuses after parallel processing
        agentStates.forEach(agent => {
            if (agent._status === 'active') {
                statusCounts.active++;
            } else if (agent._status === 'error') {
                statusCounts.error++;
            } else {
                statusCounts.idle++;
            }
        });
        
        // Remove internal _status field
        agentStates.forEach(agent => delete agent._status);
        
        const response = {
            success: true,
            status: statusCounts,
            agents: agentStates,
            workspace_id: workspaceId,
            last_updated: new Date().toISOString()
        };
        
        // Cache the response for 1 second (shorter due to more dynamic nature)
        apiCache.set(cacheKey, response, 1000);
        
        return NextResponse.json(response);
        
    } catch (error) {
        console.error('Failed to get agent status:', error);
        return NextResponse.json(
            { error: 'Failed to load agent status' },
            { status: 500 }
        );
    }
}