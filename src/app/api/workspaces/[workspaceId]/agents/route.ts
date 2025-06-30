/**
 * Workspace Agents API Route
 * Manages agent deployment and tracking for workspaces
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Use persistent storage for workspaces so changes persist
const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
        
        // Load active agents
        try {
            const agentsData = await fs.readFile(agentsPath, 'utf-8');
            const agentInfo = JSON.parse(agentsData);
            
            return NextResponse.json({
                success: true,
                workspace_id: workspaceId,
                agents: agentInfo.agents || [],
                max_concurrent: agentInfo.max_concurrent || 4,
                available_colors: agentInfo.colors || []
            });
            
        } catch (error) {
            return NextResponse.json({
                success: true,
                workspace_id: workspaceId,
                agents: [],
                max_concurrent: 4,
                available_colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']
            });
        }
        
    } catch (error) {
        console.error('Failed to get workspace agents:', error);
        return NextResponse.json(
            { error: 'Failed to load workspace agents' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        const body = await request.json();
        const { name, title } = body;
        
        if (!name || name.trim() === '') {
            return NextResponse.json(
                { error: 'Agent name is required' },
                { status: 400 }
            );
        }
        
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
        const masterLogPath = path.join(workspacePath, 'agents', 'master-log.json');
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Load current agents
        let agentInfo;
        try {
            const agentsData = await fs.readFile(agentsPath, 'utf-8');
            agentInfo = JSON.parse(agentsData);
        } catch {
            // Create default agent info if file doesn't exist
            agentInfo = {
                agents: [],
                max_concurrent: 8,
                colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'],
                next_color_index: 0
            };
        }
        
        // Check if at max capacity
        if (agentInfo.agents.length >= agentInfo.max_concurrent) {
            return NextResponse.json(
                { error: `Maximum of ${agentInfo.max_concurrent} agents allowed per workspace` },
                { status: 400 }
            );
        }
        
        // Create new agent
        const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const agentColor = agentInfo.colors[agentInfo.next_color_index % agentInfo.colors.length];
        
        const newAgent = {
            id: agentId,
            name: name.trim(),
            title: title && title.trim() ? title.trim() : undefined,
            color: agentColor,
            status: 'idle',
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            workspace_id: workspaceId
        };
        
        // Add agent to list
        agentInfo.agents.push(newAgent);
        agentInfo.next_color_index = (agentInfo.next_color_index + 1) % agentInfo.colors.length;
        
        // Save updated agents
        await fs.writeFile(agentsPath, JSON.stringify(agentInfo, null, 2));
        
        // Create agent state directory
        const agentStatesDir = path.join(workspacePath, 'agents', 'states');
        await fs.mkdir(agentStatesDir, { recursive: true });
        const agentStatePath = path.join(agentStatesDir, `${agentId}.json`);
        await fs.writeFile(agentStatePath, JSON.stringify({
            agent_id: agentId,
            name: newAgent.name,
            title: newAgent.title,
            color: newAgent.color,
            created_at: newAgent.created_at,
            current_task: null,
            status: 'idle',
            interaction_count: 0,
            last_activity: newAgent.created_at
        }, null, 2));
        
        // Create agent history directory
        const agentHistoryDir = path.join(workspacePath, 'agents', 'history', agentId);
        await fs.mkdir(agentHistoryDir, { recursive: true });
        
        // Initialize agent history
        const agentHistoryPath = path.join(agentHistoryDir, 'history.json');
        await fs.writeFile(agentHistoryPath, JSON.stringify({
            agent_id: agentId,
            name: newAgent.name,
            created_at: newAgent.created_at,
            total_interactions: 0,
            sessions: [],
            current_session: null
        }, null, 2));
        
        // Update master log
        try {
            const masterLogData = await fs.readFile(masterLogPath, 'utf-8');
            const masterLog = JSON.parse(masterLogData);
            
            masterLog.agents_deployed += 1;
            masterLog.total_interactions += 1;
            masterLog.log_entries.push({
                timestamp: new Date().toISOString(),
                event: 'agent_deployed',
                agent_id: agentId,
                agent_name: newAgent.name,
                details: 'Agent deployed and ready for tasks'
            });
            
            await fs.writeFile(masterLogPath, JSON.stringify(masterLog, null, 2));
        } catch (error) {
            console.warn('Could not update master log:', error);
        }
        
        // Update workspace status
        try {
            const statusPath = path.join(workspacePath, 'feedback', 'status.json');
            const statusData = await fs.readFile(statusPath, 'utf-8');
            const status = JSON.parse(statusData);
            
            status.active_agents = agentInfo.agents.length;
            status.last_updated = new Date().toISOString();
            status.messages.push(`Agent "${newAgent.name}" deployed successfully`);
            
            await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
        } catch (error) {
            console.warn('Could not update status:', error);
        }
        
        return NextResponse.json({
            success: true,
            message: 'Agent deployed successfully',
            agent: {
                id: newAgent.id,
                name: newAgent.name,
                title: newAgent.title,
                color: newAgent.color,
                status: newAgent.status,
                created_at: newAgent.created_at
            }
        });
        
    } catch (error) {
        console.error('Failed to deploy agent:', error);
        return NextResponse.json(
            { error: 'Failed to deploy agent' },
            { status: 500 }
        );
    }
}