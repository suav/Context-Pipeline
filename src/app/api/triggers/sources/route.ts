import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/triggers/sources - Get available trigger sources and context items
 * Returns JIRA credentials, Git repositories, library items, and pre-built trigger templates
 */
export async function GET(request: NextRequest) {
  try {
    const sources = {
      jira_instances: [],
      git_repositories: [],
      library_items: [],
      prebuilt_templates: []
    };

    // 1. Load JIRA credentials
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      const content = await fs.readFile(envPath, 'utf8');
      const lines = content.split('\n');
      const vars: Record<string, string> = {};
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            vars[key.trim()] = valueParts.join('=').trim();
          }
        }
      });

      // Check for JIRA credentials
      if (vars.JIRA_BASE_URL || vars.JIRA_URL) {
        const jiraUrl = vars.JIRA_BASE_URL || vars.JIRA_URL;
        const jiraEmail = vars.JIRA_USERNAME || vars.JIRA_EMAIL || vars.USER_EMAIL;
        
        if (jiraUrl && jiraEmail) {
          sources.jira_instances.push({
            id: 'jira-env-1',
            name: 'Primary JIRA Instance',
            url: jiraUrl,
            email: jiraEmail,
            status: 'active'
          });
        }
      }

      // Check for Git repositories
      const repoUrls = Object.keys(vars).filter(key => key === 'REPO_URL' || key.startsWith('REPO_URL_'));
      
      repoUrls.forEach((urlKey, index) => {
        const repoUrl = vars[urlKey];
        if (!repoUrl) return;
        
        const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'Repository';
        const suffix = urlKey === 'REPO_URL' ? '' : `_${urlKey.split('_')[2]}`;
        const userName = vars[`GIT_USER_NAME${suffix}`];
        const userEmail = vars[`GIT_USER_EMAIL${suffix}`];
        
        sources.git_repositories.push({
          id: `git-repo-${index + 1}`,
          name: `Git: ${repoName}`,
          url: repoUrl,
          user_name: userName,
          user_email: userEmail,
          status: 'active'
        });
      });
    } catch (error) {
      console.warn('Could not load credentials:', error);
    }

    // 2. Load library items
    try {
      const libraryDir = path.join(process.cwd(), 'storage', 'context-library');
      const items = await fs.readdir(libraryDir);
      
      for (const item of items) {
        if (item.endsWith('.json')) {
          try {
            const itemPath = path.join(libraryDir, item);
            const itemData = await fs.readFile(itemPath, 'utf-8');
            const libraryItem = JSON.parse(itemData);
            
            // Only include items that can be monitored for changes
            const monitorableTypes = ['jira_ticket', 'jira_project', 'git_repository', 'email_thread'];
            
            if (monitorableTypes.includes(libraryItem.type)) {
              sources.library_items.push({
                id: libraryItem.id,
                title: libraryItem.title,
                type: libraryItem.type,
                source: libraryItem.source,
                description: libraryItem.description,
                metadata: libraryItem.metadata,
                created_at: libraryItem.created_at,
                trigger_compatible: true
              });
            }
          } catch (error) {
            // Skip malformed items
            continue;
          }
        }
      }
    } catch (error) {
      console.warn('Could not load library items:', error);
    }

    // 3. Create pre-built trigger templates
    const templates = [];

    // JIRA-based templates
    if (sources.jira_instances.length > 0) {
      templates.push({
        id: 'jira-to-dev',
        name: 'JIRA → Development Workspace',
        description: 'Create development workspace when JIRA ticket moves to "In Progress"',
        icon: '🎫→💻',
        type: 'jira_status',
        trigger_config: {
          jira_project: 'AUTO_DETECT',
          status_transition: 'To Do → In Progress',
          polling_interval_ms: 300000
        },
        conditions: [{
          id: 'status-change',
          type: 'status_change',
          config: {
            from_status: 'To Do',
            to_status: 'In Progress'
          }
        }],
        actions: [{
          id: 'create-workspace',
          type: 'create_workspace',
          config: {
            auto_deploy: true,
            workspace_title_override: '{{jira.key}} - {{jira.summary}}',
            context_refresh: true,
            agents_to_deploy: ['development-specialist', 'analysis-expert']
          }
        }],
        compatible_sources: sources.jira_instances.length
      });

      templates.push({
        id: 'jira-to-review',
        name: 'JIRA → Code Review',
        description: 'Create review workspace when ticket moves to "Code Review"',
        icon: '🎫→👀',
        type: 'jira_status',
        trigger_config: {
          jira_project: 'AUTO_DETECT',
          status_transition: '* → Code Review',
          polling_interval_ms: 180000
        },
        conditions: [{
          id: 'status-change',
          type: 'status_change',
          config: {
            to_status: 'Code Review'
          }
        }],
        actions: [{
          id: 'create-workspace',
          type: 'create_workspace',
          config: {
            auto_deploy: true,
            workspace_title_override: 'Review: {{jira.key}}',
            context_refresh: true,
            agents_to_deploy: ['security-auditor', 'testing-engineer']
          }
        }],
        compatible_sources: sources.jira_instances.length
      });
    }

    // Git-based templates  
    if (sources.git_repositories.length > 0) {
      templates.push({
        id: 'git-pr-ready',
        name: 'Git → PR Ready Workspace',
        description: 'Create workspace when feature branch is pushed',
        icon: '🌿→📋',
        type: 'git_push',
        trigger_config: {
          repository: 'AUTO_DETECT',
          branch_pattern: 'feature/*',
          polling_interval_ms: 120000
        },
        conditions: [{
          id: 'branch-push',
          type: 'new_commit',
          config: {
            branch_pattern: 'feature/*'
          }
        }],
        actions: [{
          id: 'create-workspace',
          type: 'create_workspace',
          config: {
            auto_deploy: true,
            workspace_title_override: 'PR Prep: {{branch_name}}',
            context_refresh: true,
            agents_to_deploy: ['testing-engineer', 'security-auditor']
          }
        }],
        compatible_sources: sources.git_repositories.length
      });

      templates.push({
        id: 'git-hotfix',
        name: 'Git → Hotfix Deployment',
        description: 'Deploy hotfix workspace when hotfix branch is created',
        icon: '🚨→⚡',
        type: 'git_push',
        trigger_config: {
          repository: 'AUTO_DETECT',
          branch_pattern: 'hotfix/*',
          polling_interval_ms: 60000
        },
        conditions: [{
          id: 'hotfix-branch',
          type: 'new_commit',
          config: {
            branch_pattern: 'hotfix/*'
          }
        }],
        actions: [{
          id: 'create-workspace',
          type: 'create_workspace',
          config: {
            auto_deploy: true,
            workspace_title_override: 'HOTFIX: {{branch_name}}',
            context_refresh: true,
            agents_to_deploy: ['security-auditor', 'testing-engineer', 'development-specialist']
          }
        }],
        compatible_sources: sources.git_repositories.length
      });
    }

    // Combined JIRA + Git templates
    if (sources.jira_instances.length > 0 && sources.git_repositories.length > 0) {
      templates.push({
        id: 'jira-git-deploy',
        name: 'JIRA + Git → Deployment',
        description: 'Deploy when JIRA ticket is "Done" and branch is merged',
        icon: '🎫+🌿→🚀',
        type: 'jira_status',
        trigger_config: {
          jira_project: 'AUTO_DETECT',
          repository: 'AUTO_DETECT',
          status_transition: '* → Done',
          polling_interval_ms: 300000
        },
        conditions: [
          {
            id: 'jira-done',
            type: 'status_change',
            config: {
              to_status: 'Done'
            }
          }
        ],
        actions: [{
          id: 'deploy-workspace',
          type: 'create_workspace',
          config: {
            auto_deploy: false,
            workspace_title_override: 'Deploy: {{jira.key}}',
            context_refresh: true,
            agents_to_deploy: ['testing-engineer']
          }
        }],
        compatible_sources: sources.jira_instances.length + sources.git_repositories.length
      });
    }

    sources.prebuilt_templates = templates;

    return NextResponse.json({
      success: true,
      sources,
      summary: {
        jira_instances: sources.jira_instances.length,
        git_repositories: sources.git_repositories.length,
        library_items: sources.library_items.length,
        prebuilt_templates: sources.prebuilt_templates.length,
        total_compatible_sources: sources.jira_instances.length + sources.git_repositories.length
      }
    });

  } catch (error) {
    console.error('Failed to get trigger sources:', error);
    return NextResponse.json(
      { error: 'Failed to load trigger sources' },
      { status: 500 }
    );
  }
}