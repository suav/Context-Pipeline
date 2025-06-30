/**
 * Workspace Feedback API Route
 * Serves interactive feedback HTML content
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_BASE_DIR = path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const feedbackPath = path.join(workspacePath, 'feedback', 'interactive', 'index.html');
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Try to load the interactive HTML feedback
        try {
            const htmlContent = await fs.readFile(feedbackPath, 'utf-8');
            
            return new NextResponse(htmlContent, {
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
            
        } catch (error) {
            // Fallback: generate basic feedback content
            const fallbackHTML = await generateFallbackFeedback(workspacePath, workspaceId);
            
            return new NextResponse(fallbackHTML, {
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
        }
        
    } catch (error) {
        console.error('Failed to load workspace feedback:', error);
        return NextResponse.json(
            { error: 'Failed to load feedback content' },
            { status: 500 }
        );
    }
}

async function generateFallbackFeedback(workspacePath: string, workspaceId: string): Promise<string> {
    try {
        // Load workspace metadata
        let workspaceName = workspaceId;
        let contextItems: any[] = [];
        let status: any = {};
        let agents: any[] = [];
        
        // Try to load workspace info
        try {
            const metadataPath = path.join(workspacePath, 'workspace.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            workspaceName = metadata.name || workspaceId;
            contextItems = metadata.context_items || [];
        } catch (error) {
            console.warn('Could not load workspace metadata:', error);
        }
        
        // Try to load status
        try {
            const statusPath = path.join(workspacePath, 'feedback', 'status.json');
            status = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
        } catch (error) {
            console.warn('Could not load status:', error);
        }
        
        // Try to load agents
        try {
            const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
            const agentData = JSON.parse(await fs.readFile(agentsPath, 'utf-8'));
            agents = agentData.agents || [];
        } catch (error) {
            console.warn('Could not load agents:', error);
        }
        
        // Generate fallback HTML
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace: ${workspaceName}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 20px; 
            background: #f8fafc;
            color: #334155;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: white; 
            padding: 24px; 
            border-radius: 12px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 24px;
        }
        .status { 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid;
        }
        .created { background: #ecfdf5; border-left-color: #10b981; }
        .working { background: #fefce8; border-left-color: #eab308; }
        .completed { background: #dcfce7; border-left-color: #22c55e; }
        .error { background: #fef2f2; border-left-color: #ef4444; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        .card { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .agent { 
            display: flex; 
            align-items: center; 
            gap: 12px; 
            padding: 12px; 
            border-radius: 6px; 
            margin: 8px 0;
            background: #f1f5f9;
        }
        .agent-color { width: 12px; height: 12px; border-radius: 50%; }
        pre { background: #f1f5f9; padding: 15px; border-radius: 6px; overflow-x: auto; }
        .timestamp { color: #64748b; font-size: 0.9em; }
        .refresh-note { 
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            background: #3b82f6; 
            color: white; 
            padding: 12px 16px; 
            border-radius: 6px; 
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏗️ Workspace: ${workspaceName}</h1>
            <p class="timestamp">Workspace ID: ${workspaceId}</p>
        </div>
        
        <div class="status ${status.status === 'completed' ? 'completed' : status.active_agents > 0 ? 'working' : 'created'}">
            <h3>${status.status === 'completed' ? '✅ Completed' : status.active_agents > 0 ? '🔄 Working' : '📋 Ready'}</h3>
            <p>${status.status === 'completed' ? 'All tasks completed successfully' : 
                status.active_agents > 0 ? `${status.active_agents} agent(s) currently working` : 
                'Workspace ready for agent deployment'}</p>
            <p class="timestamp">Last updated: ${status.last_updated ? new Date(status.last_updated).toLocaleString() : 'Unknown'}</p>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📊 Context Items (${contextItems.length})</h3>
                <ul>
                    ${contextItems.map(item => `<li><strong>${item.title || item.id}</strong> (${item.source})</li>`).join('')}
                </ul>
            </div>
            
            <div class="card">
                <h3>🤖 Agents (${agents.length})</h3>
                ${agents.length > 0 ? 
                    agents.map(agent => `
                        <div class="agent">
                            <div class="agent-color" style="background-color: ${agent.color}"></div>
                            <div>
                                <strong>${agent.name}</strong><br>
                                <small>${agent.status} • Created ${new Date(agent.created_at).toLocaleString()}</small>
                            </div>
                        </div>
                    `).join('') : 
                    '<p>No agents deployed yet</p>'
                }
            </div>
            
            <div class="card">
                <h3>📈 Progress</h3>
                <p>Phase: ${status.phase || 'Ready'}</p>
                <p>Progress: ${status.progress || 0}%</p>
                ${status.messages && status.messages.length > 0 ? `
                    <h4>Recent Messages:</h4>
                    <ul>
                        ${status.messages.slice(-5).map((msg: any) => `<li>${msg}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        </div>
        
        <div class="refresh-note">
            🔄 Auto-refreshing every 30 seconds
        </div>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
        
    } catch (error) {
        console.error('Failed to generate fallback feedback:', error);
        return `<!DOCTYPE html>
<html><head><title>Error</title></head>
<body><h1>Error loading workspace feedback</h1><p>${error}</p></body>
</html>`;
    }
}