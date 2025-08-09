import { WorkspaceTemplate } from '../types';

export const builtInTemplates: Omit<WorkspaceTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_stats'>[] = [
  {
    name: 'Bug Fix Standard',
    description: 'Comprehensive bug fix workspace with JIRA ticket, repository access, and automated analysis',
    category: 'development',
    created_by: 'system',
    version: '1.0.0',
    
    context_requirements: [
      {
        id: 'req_bug_ticket',
        type: 'wildcard',
        wildcard_type: 'generic_ticket',
        wildcard_filters: {
          tags: ['bug', 'issue'],
          content_type: ['jira_ticket']
        },
        required: true,
        display_name: 'Bug Ticket',
        description: 'The JIRA ticket or issue describing the bug'
      },
      {
        id: 'req_main_repo',
        type: 'wildcard', 
        wildcard_type: 'generic_repository',
        wildcard_filters: {
          tags: ['main', 'primary', 'production']
        },
        required: true,
        display_name: 'Main Repository',
        description: 'The primary repository where the bug needs to be fixed'
      },
      {
        id: 'req_coding_standards',
        type: 'explicit',
        context_item_id: 'lib_coding_standards_001', // This would be a specific document
        required: false,
        display_name: 'Coding Standards',
        description: 'Organization coding standards and best practices'
      }
    ],
    
    workspace_config: {
      naming_pattern: 'Bug Fix: {{jira.key}} - {{jira.summary}}',
      directory_structure: [
        'context',
        'target',
        'feedback',
        'agents'
      ],
      permissions_template: 'developer_standard',
      file_templates: [
        {
          name: 'CLAUDE.md',
          path: 'CLAUDE.md',
          content: `# Bug Fix Workspace: {{jira.key}}

## Bug Description
{{jira.description}}

## Priority
{{jira.priority}}

## Assigned Developer
{{jira.assignee}}

## Instructions for AI Agent

You are working on a bug fix in this workspace. Your tasks:

1. **Analyze the Bug**: Review the JIRA ticket and understand the issue
2. **Investigate Code**: Examine the codebase to identify the root cause
3. **Develop Fix**: Create a targeted fix that addresses the bug
4. **Test**: Ensure the fix works and doesn't break existing functionality
5. **Document**: Update any relevant documentation

## Available Commands
- analyze_bug: Deep analysis of the bug from ticket and code
- create_fix_plan: Generate step-by-step fix plan
- implement_fix: Apply the fix to the codebase
- run_tests: Execute relevant tests
- update_docs: Update documentation if needed

## Resources
- Bug ticket: {{jira.url}}
- Repository: {{git.url}}
- Priority: {{jira.priority}}
- Due date: {{jira.duedate}}
`,
          overwrite_existing: true
        },
        {
          name: 'README.md',
          path: 'README.md', 
          content: `# Bug Fix Workspace

**Ticket**: {{jira.key}} - {{jira.summary}}
**Status**: {{jira.status}}
**Priority**: {{jira.priority}}
**Assignee**: {{jira.assignee}}

## Workspace Structure

- \`context/\` - Bug ticket and repository context
- \`target/\` - Working area for implementing the fix
- \`feedback/\` - Testing results and validation
- \`agents/\` - AI agent conversation history

## Quick Start

1. Review the bug details in the context folder
2. Use the AI agent to analyze the issue
3. Implement the fix in the target folder
4. Test and validate the solution
5. Update documentation as needed
`,
          overwrite_existing: true
        }
      ]
    },
    
    agent_templates: [
      {
        name: 'Bug Analyst',
        model: 'claude',
        commands: ['analyze_bug', 'create_fix_plan', 'investigate_code'],
        permissions: ['read_context', 'write_target', 'run_tests'],
        auto_deploy: true,
        description: 'Analyzes bugs and creates fix plans'
      }
    ],
    
    variables: [
      {
        name: 'jira.key',
        type: 'string',
        description: 'JIRA ticket key (e.g., BUG-123)',
        required: true
      },
      {
        name: 'jira.summary',
        type: 'string', 
        description: 'Bug summary/title',
        required: true
      },
      {
        name: 'jira.description',
        type: 'string',
        description: 'Detailed bug description',
        required: false,
        default_value: 'No description provided'
      },
      {
        name: 'jira.priority',
        type: 'select',
        description: 'Bug priority level',
        required: false,
        default_value: 'Medium',
        options: ['Critical', 'High', 'Medium', 'Low']
      },
      {
        name: 'jira.assignee',
        type: 'string',
        description: 'Assigned developer',
        required: false,
        default_value: 'Unassigned'
      }
    ]
  },

  {
    name: 'Feature Development',
    description: 'Complete feature development workspace with epic, repositories, and design documents',
    category: 'development', 
    created_by: 'system',
    version: '1.0.0',
    
    context_requirements: [
      {
        id: 'req_feature_epic',
        type: 'wildcard',
        wildcard_type: 'generic_ticket',
        wildcard_filters: {
          tags: ['epic', 'feature', 'story'],
          content_type: ['jira_ticket']
        },
        required: true,
        display_name: 'Feature Epic/Story',
        description: 'The JIRA epic or story describing the feature'
      },
      {
        id: 'req_frontend_repo',
        type: 'wildcard',
        wildcard_type: 'generic_repository', 
        wildcard_filters: {
          tags: ['frontend', 'ui', 'client']
        },
        required: false,
        display_name: 'Frontend Repository',
        description: 'Frontend/UI repository for the feature'
      },
      {
        id: 'req_backend_repo',
        type: 'wildcard',
        wildcard_type: 'generic_repository',
        wildcard_filters: {
          tags: ['backend', 'api', 'server']
        },
        required: false,
        display_name: 'Backend Repository', 
        description: 'Backend/API repository for the feature'
      },
      {
        id: 'req_design_docs',
        type: 'wildcard',
        wildcard_type: 'generic_document',
        wildcard_filters: {
          tags: ['design', 'specification', 'requirements']
        },
        required: false,
        display_name: 'Design Documentation',
        description: 'Feature design and specification documents'
      }
    ],
    
    workspace_config: {
      naming_pattern: 'Feature: {{jira.key}} - {{jira.summary}}',
      directory_structure: [
        'context',
        'target/frontend', 
        'target/backend',
        'feedback',
        'agents'
      ],
      permissions_template: 'developer_full_access',
      file_templates: [
        {
          name: 'CLAUDE.md',
          path: 'CLAUDE.md',
          content: `# Feature Development: {{jira.key}}

## Feature Overview
{{jira.description}}

## Requirements
{{requirements}}

## Architecture Considerations
{{architecture_notes}}

## Instructions for AI Agent

You are developing a new feature. Your responsibilities:

1. **Analyze Requirements**: Review the epic/story and design documents
2. **Plan Architecture**: Design the technical implementation approach
3. **Frontend Development**: Implement UI/UX components as needed
4. **Backend Development**: Implement APIs and business logic
5. **Integration**: Ensure frontend and backend work together
6. **Testing**: Write and execute comprehensive tests
7. **Documentation**: Update technical and user documentation

## Available Commands
- analyze_requirements: Deep dive into feature requirements
- design_architecture: Create technical design
- implement_frontend: Build UI components
- implement_backend: Build API endpoints
- integrate_components: Connect frontend and backend
- write_tests: Create comprehensive test suite
- update_documentation: Maintain docs

## Feature Details
- Epic: {{jira.url}}
- Priority: {{jira.priority}}  
- Timeline: {{timeline}}
- Team: {{team}}
`,
          overwrite_existing: true
        }
      ]
    },
    
    agent_templates: [
      {
        name: 'Feature Architect',
        model: 'claude',
        commands: ['analyze_requirements', 'design_architecture', 'plan_implementation'],
        permissions: ['read_context', 'write_target', 'create_docs'],
        auto_deploy: true,
        description: 'Analyzes requirements and designs feature architecture'
      },
      {
        name: 'Full Stack Developer',
        model: 'claude',
        commands: ['implement_frontend', 'implement_backend', 'integrate_components', 'write_tests'],
        permissions: ['read_context', 'write_target', 'run_tests', 'deploy_staging'],
        auto_deploy: false,
        description: 'Implements frontend and backend components'
      }
    ],
    
    variables: [
      {
        name: 'jira.key',
        type: 'string',
        description: 'JIRA epic/story key',
        required: true
      },
      {
        name: 'jira.summary', 
        type: 'string',
        description: 'Feature summary/title',
        required: true
      },
      {
        name: 'requirements',
        type: 'string',
        description: 'Detailed feature requirements',
        required: false,
        default_value: 'See epic for requirements'
      },
      {
        name: 'timeline',
        type: 'string',
        description: 'Development timeline/sprint',
        required: false,
        default_value: 'Current sprint'
      },
      {
        name: 'team',
        type: 'string',
        description: 'Development team',
        required: false,
        default_value: 'Development Team'
      }
    ]
  },

  {
    name: 'Code Review',
    description: 'Code review workspace for analyzing pull requests and providing feedback',
    category: 'development',
    created_by: 'system', 
    version: '1.0.0',
    
    context_requirements: [
      {
        id: 'req_pull_request',
        type: 'wildcard',
        wildcard_type: 'generic_repository',
        wildcard_filters: {
          tags: ['pull-request', 'merge-request', 'code-review']
        },
        required: true,
        display_name: 'Pull Request',
        description: 'The pull request to be reviewed'
      },
      {
        id: 'req_style_guide',
        type: 'explicit',
        context_item_id: 'lib_style_guide_001',
        required: false,
        display_name: 'Style Guide',
        description: 'Code style and formatting guidelines'
      },
      {
        id: 'req_security_checklist',
        type: 'explicit', 
        context_item_id: 'lib_security_checklist_001',
        required: false,
        display_name: 'Security Checklist',
        description: 'Security review checklist and guidelines'
      }
    ],
    
    workspace_config: {
      naming_pattern: 'Code Review: {{pr.title}}',
      directory_structure: [
        'context',
        'feedback',
        'agents'
      ],
      permissions_template: 'reviewer_access',
      file_templates: [
        {
          name: 'CLAUDE.md',
          path: 'CLAUDE.md',
          content: `# Code Review: {{pr.title}}

## Pull Request Details
- **Author**: {{pr.author}}
- **Branch**: {{pr.branch}}
- **Target**: {{pr.target_branch}}
- **Changes**: {{pr.files_changed}} files changed

## Review Objectives
{{review_objectives}}

## Instructions for AI Agent

You are conducting a code review. Focus on:

1. **Code Quality**: Check for clean, maintainable code
2. **Security**: Identify potential security vulnerabilities  
3. **Performance**: Look for performance implications
4. **Style Compliance**: Ensure adherence to coding standards
5. **Test Coverage**: Verify adequate test coverage
6. **Documentation**: Check for proper documentation

## Available Commands
- analyze_changes: Review all code changes in the PR
- check_security: Security vulnerability analysis
- verify_tests: Validate test coverage and quality
- style_review: Check code style compliance
- performance_review: Analyze performance implications
- generate_feedback: Create comprehensive review feedback

## Review Criteria
- Security best practices
- Performance considerations  
- Code maintainability
- Test adequacy
- Style guide compliance
`,
          overwrite_existing: true
        }
      ]
    },
    
    agent_templates: [
      {
        name: 'Code Reviewer',
        model: 'claude',
        commands: ['analyze_changes', 'check_security', 'verify_tests', 'style_review'],
        permissions: ['read_context', 'write_feedback'],
        auto_deploy: true,
        description: 'Comprehensive code review and feedback generation'
      }
    ],
    
    variables: [
      {
        name: 'pr.title',
        type: 'string', 
        description: 'Pull request title',
        required: true
      },
      {
        name: 'pr.author',
        type: 'string',
        description: 'Pull request author',
        required: false,
        default_value: 'Unknown'
      },
      {
        name: 'review_objectives',
        type: 'string',
        description: 'Specific review objectives',
        required: false,
        default_value: 'Standard code review for quality, security, and maintainability'
      }
    ]
  },

  {
    name: 'Documentation Update',
    description: 'Documentation workspace for updating technical documentation, APIs, and user guides',
    category: 'documentation',
    created_by: 'system',
    version: '1.0.0',
    
    context_requirements: [
      {
        id: 'req_doc_ticket',
        type: 'wildcard',
        wildcard_type: 'generic_ticket', 
        wildcard_filters: {
          tags: ['documentation', 'docs', 'update']
        },
        required: true,
        display_name: 'Documentation Request',
        description: 'Ticket or request for documentation updates'
      },
      {
        id: 'req_existing_docs',
        type: 'wildcard',
        wildcard_type: 'generic_document',
        wildcard_filters: {
          tags: ['documentation', 'readme', 'wiki']
        },
        required: false,
        display_name: 'Existing Documentation',
        description: 'Current documentation that needs updating'
      },
      {
        id: 'req_source_code',
        type: 'wildcard',
        wildcard_type: 'generic_repository',
        required: false,
        display_name: 'Source Code',
        description: 'Source code repository for technical documentation'
      }
    ],
    
    workspace_config: {
      naming_pattern: 'Docs: {{doc.title}}',
      directory_structure: [
        'context',
        'target/docs',
        'feedback', 
        'agents'
      ],
      permissions_template: 'documentation_writer',
      file_templates: [
        {
          name: 'CLAUDE.md',
          path: 'CLAUDE.md',
          content: `# Documentation Update: {{doc.title}}

## Documentation Scope
{{doc.scope}}

## Target Audience
{{doc.audience}}

## Instructions for AI Agent

You are updating documentation. Your tasks:

1. **Review Current Docs**: Analyze existing documentation for gaps and issues
2. **Research Changes**: Understand what needs to be documented
3. **Write Content**: Create clear, comprehensive documentation
4. **Structure Information**: Organize content logically
5. **Review Quality**: Ensure accuracy and clarity
6. **Update Cross-References**: Maintain consistency across docs

## Available Commands
- analyze_existing_docs: Review current documentation state
- research_changes: Investigate what needs documenting
- write_documentation: Create new documentation content
- update_existing_docs: Revise existing documentation
- review_quality: Check for accuracy and clarity
- update_navigation: Maintain doc structure and links

## Documentation Standards
- Clear, concise writing
- Proper formatting and structure
- Code examples where appropriate
- Screenshots for UI documentation
- Regular updates and maintenance
`,
          overwrite_existing: true
        }
      ]
    },
    
    agent_templates: [
      {
        name: 'Technical Writer',
        model: 'claude',
        commands: ['analyze_existing_docs', 'write_documentation', 'update_existing_docs', 'review_quality'],
        permissions: ['read_context', 'write_target', 'create_docs'],
        auto_deploy: true,
        description: 'Creates and maintains technical documentation'
      }
    ],
    
    variables: [
      {
        name: 'doc.title',
        type: 'string',
        description: 'Documentation title/topic',
        required: true
      },
      {
        name: 'doc.scope', 
        type: 'string',
        description: 'Scope of documentation updates',
        required: false,
        default_value: 'Update existing documentation'
      },
      {
        name: 'doc.audience',
        type: 'select',
        description: 'Target audience for documentation',
        required: false,
        default_value: 'Developers',
        options: ['Developers', 'End Users', 'System Administrators', 'Mixed Audience']
      }
    ]
  }
];

export default builtInTemplates;