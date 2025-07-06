/**
 * Tool Approval API Route
 * Handles user approval/denial of agent tool usage
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
        const { messageId, toolName, approved } = body;
        
        if (!messageId || !toolName || typeof approved !== 'boolean') {
            return NextResponse.json(
                { error: 'messageId, toolName, and approved (boolean) are required' },
                { status: 400 }
            );
        }
        
        const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
        const claudeConfigPath = path.join(workspacePath, '.claude.json');
        
        // Check if workspace exists
        try {
            await fs.access(workspacePath);
        } catch {
            return NextResponse.json(
                { error: 'Workspace not found' },
                { status: 404 }
            );
        }
        
        // Update Claude configuration with tool approval
        let claudeConfig;
        try {
            const configData = await fs.readFile(claudeConfigPath, 'utf-8');
            claudeConfig = JSON.parse(configData);
        } catch {
            // Create new config if it doesn't exist
            claudeConfig = {
                installMethod: "unknown",
                autoUpdates: true,
                firstStartTime: new Date().toISOString(),
                userID: "user",
                projects: {}
            };
        }
        
        // Ensure project structure exists
        const projectPath = `/mnt/c/Users/EnricoPatarini/Development Projects/Second-Rebuild/context-pipeline`;
        if (!claudeConfig.projects[projectPath]) {
            claudeConfig.projects[projectPath] = {
                allowedTools: [],
                history: [],
                mcpContextUris: [],
                mcpServers: {},
                enabledMcpjsonServers: [],
                disabledMcpjsonServers: [],
                hasTrustDialogAccepted: false,
                projectOnboardingSeenCount: 0,
                hasClaudeMdExternalIncludesApproved: false,
                hasClaudeMdExternalIncludesWarningShown: false
            };
        }
        
        const project = claudeConfig.projects[projectPath];
        
        if (approved) {
            // Add tool to allowed list if not already there
            if (!project.allowedTools.includes(toolName)) {
                project.allowedTools.push(toolName);
            }
            
            // Set trust dialog as accepted for future tool uses
            project.hasTrustDialogAccepted = true;
            
            console.log(`✅ Tool ${toolName} approved and added to allowed tools for agent ${agentId}`);
        } else {
            // Remove tool from allowed list if it was there
            project.allowedTools = project.allowedTools.filter((tool: string) => tool !== toolName);
            
            console.log(`❌ Tool ${toolName} denied and removed from allowed tools for agent ${agentId}`);
        }
        
        // Save updated Claude configuration
        await fs.writeFile(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
        
        // Log the approval action
        console.log(`Tool approval: ${toolName} ${approved ? 'APPROVED' : 'DENIED'} for message ${messageId}`);
        
        return NextResponse.json({
            success: true,
            message: `Tool ${toolName} ${approved ? 'approved' : 'denied'} successfully`,
            toolName,
            approved,
            allowedTools: project.allowedTools
        });
        
    } catch (error) {
        console.error('Failed to process tool approval:', error);
        return NextResponse.json(
            { error: 'Failed to process tool approval' },
            { status: 500 }
        );
    }
}