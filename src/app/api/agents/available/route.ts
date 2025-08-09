import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/agents/available - Get all available agents for template configuration
 * Returns prebuilt agents, checkpoints, and active agents from all workspaces
 */
export async function GET(request: NextRequest) {
  try {
    const agents = [];

    // 1. Load prebuilt agents from command library
    try {
      const { STARTUP_COMMANDS, COMMAND_CATEGORIES } = await import('../../../features/agents/data/commandLibrary');
      
      const prebuiltAgents = [
        {
          id: 'analysis-expert',
          name: 'Analysis Expert',
          model: 'claude-3-5-sonnet-20241022',
          type: 'prebuilt',
          description: 'Specialized in code analysis, investigation, and debugging',
          base_prompt: 'You are an expert code analyst who excels at investigating codebases, debugging issues, and providing detailed analysis and recommendations.',
          commands: STARTUP_COMMANDS.filter(cmd => cmd.category === 'analysis').map(cmd => cmd.keyword),
          permissions: ['read_context', 'read_target', 'analyze_code'],
          usage_count: 143,
          success_rate: 0.94,
          source: 'system'
        },
        {
          id: 'development-specialist',
          name: 'Development Specialist', 
          model: 'claude-3-5-sonnet-20241022',
          type: 'prebuilt',
          description: 'Focused on feature development, planning, and implementation',
          base_prompt: 'You are a skilled developer who specializes in planning, implementing, and optimizing software features with best practices.',
          commands: STARTUP_COMMANDS.filter(cmd => cmd.category === 'development').map(cmd => cmd.keyword),
          permissions: ['read_context', 'read_target', 'write_target', 'git_operations'],
          usage_count: 187,
          success_rate: 0.89,
          source: 'system'
        },
        {
          id: 'security-auditor',
          name: 'Security Auditor',
          model: 'claude-3-5-sonnet-20241022',
          type: 'prebuilt',
          description: 'Security-focused analysis and vulnerability assessment',
          base_prompt: 'You are a security expert who performs comprehensive security audits, identifies vulnerabilities, and recommends security improvements.',
          commands: ['security_audit', 'analyze', 'review'],
          permissions: ['read_context', 'read_target', 'security_scan'],
          usage_count: 76,
          success_rate: 0.96,
          source: 'system'
        },
        {
          id: 'testing-engineer',
          name: 'Testing Engineer',
          model: 'claude-3-5-haiku-20241022',
          type: 'prebuilt',
          description: 'Specialized in test creation and quality assurance',
          base_prompt: 'You are a QA engineer who creates comprehensive test suites, validates implementations, and ensures code quality.',
          commands: STARTUP_COMMANDS.filter(cmd => cmd.category === 'testing').map(cmd => cmd.keyword),
          permissions: ['read_context', 'read_target', 'write_target', 'run_tests'],
          usage_count: 94,
          success_rate: 0.92,
          source: 'system'
        }
      ];

      agents.push(...prebuiltAgents);
    } catch (error) {
      console.warn('Could not load command library, skipping prebuilt agents:', error);
    }

    // 2. Load saved checkpoints
    try {
      const checkpointDir = path.join(process.cwd(), 'storage', 'checkpoints');
      const indexPath = path.join(checkpointDir, 'index.json');
      
      const indexData = await fs.readFile(indexPath, 'utf8');
      const checkpointIndex = JSON.parse(indexData);
      
      const checkpointAgents = checkpointIndex.map(checkpoint => ({
        id: `checkpoint_${checkpoint.id}`,
        name: `${checkpoint.agent_name} (Saved)`,
        model: checkpoint.model || 'claude-3-5-sonnet-20241022',
        type: 'checkpoint',
        description: checkpoint.description || `Saved agent expertise from ${new Date(checkpoint.created_at).toLocaleDateString()}`,
        base_prompt: 'Restored from checkpoint with learned expertise',
        commands: [], // Commands will be restored from checkpoint
        permissions: ['read_context', 'read_target', 'write_target'],
        checkpoint_id: checkpoint.id,
        usage_count: checkpoint.message_count || 0,
        success_rate: 0.95,
        source: 'checkpoint',
        created_at: checkpoint.created_at,
        agent_title: checkpoint.agent_title,
        source_workspace_id: checkpoint.source_workspace_id
      }));

      agents.push(...checkpointAgents);
    } catch (error) {
      console.warn('Could not load checkpoints:', error);
    }

    // 3. Load active agents from all workspaces
    try {
      const workspaceDir = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');
      const workspaces = await fs.readdir(workspaceDir);
      
      for (const workspaceId of workspaces) {
        try {
          const workspacePath = path.join(workspaceDir, workspaceId);
          const workspaceStats = await fs.stat(workspacePath);
          
          if (workspaceStats.isDirectory()) {
            const agentsPath = path.join(workspacePath, 'agents', 'active-agents.json');
            
            try {
              const agentsData = await fs.readFile(agentsPath, 'utf-8');
              const agentInfo = JSON.parse(agentsData);
              
              const workspaceAgents = agentInfo.agents.map(agent => ({
                id: `workspace_${workspaceId}_${agent.id}`,
                name: `${agent.name} (${workspaceId})`,
                model: agent.preferred_model || 'claude-3-5-sonnet-20241022',
                type: 'workspace',
                description: `Active agent from workspace: ${workspaceId}${agent.title ? ` - ${agent.title}` : ''}`,
                base_prompt: 'Active workspace agent with contextual knowledge',
                commands: [], // Commands would be loaded from agent state
                permissions: ['read_context', 'read_target', 'write_target'],
                agent_id: agent.id,
                workspace_id: workspaceId,
                color: agent.color,
                status: agent.status,
                usage_count: 0, // Could be calculated from history
                success_rate: 0.9,
                source: 'workspace',
                created_at: agent.created_at,
                last_activity: agent.last_activity
              }));

              agents.push(...workspaceAgents);
            } catch (error) {
              // No agents in this workspace, skip
            }
          }
        } catch (error) {
          // Skip problematic workspaces
          continue;
        }
      }
    } catch (error) {
      console.warn('Could not scan workspaces for agents:', error);
    }

    // Sort agents by relevance: prebuilt first, then checkpoints, then workspace agents
    const sortedAgents = agents.sort((a, b) => {
      const typeOrder = { prebuilt: 1, checkpoint: 2, workspace: 3 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      // Within same type, sort by usage/success
      return (b.usage_count || 0) - (a.usage_count || 0);
    });

    return NextResponse.json({
      success: true,
      agents: sortedAgents,
      summary: {
        total: agents.length,
        prebuilt: agents.filter(a => a.type === 'prebuilt').length,
        checkpoints: agents.filter(a => a.type === 'checkpoint').length,
        workspace_agents: agents.filter(a => a.type === 'workspace').length
      }
    });

  } catch (error) {
    console.error('Failed to get available agents:', error);
    return NextResponse.json(
      { error: 'Failed to load available agents' },
      { status: 500 }
    );
  }
}