import { QueryTemplate, QueryCategory, ContextSource } from '@/features/context-import/types';
export const QueryTemplates: Record<ContextSource, QueryTemplate[]> = {
    jira: [
        // Personal & Current Work
        {
            id: 'my-open-tickets',
            name: 'My Open Tickets',
            description: 'All tickets assigned to me that are not done',
            query: 'assignee = currentUser() AND status != done ORDER BY updated DESC',
            category: 'personal',
            popular: true
        },
        {
            id: 'my-current-sprint',
            name: 'My Current Sprint',
            description: 'My tickets in the current sprint',
            query: 'assignee = currentUser() AND Sprint in openSprints() AND status != done ORDER BY rank ASC',
            category: 'personal',
            popular: true
        },
        {
            id: 'my-in-progress-today',
            name: 'My Active Work Today',
            description: 'Tickets I am actively working on today',
            query: 'assignee = currentUser() AND status = "in progress" ORDER BY updated DESC',
            category: 'personal',
            popular: true
        },
        
        // Board & Status Column Queries
        {
            id: 'todo-column',
            name: 'To Do Column',
            description: 'All tickets in To Do status ready to be picked up',
            query: 'status = "to do" AND assignee is EMPTY ORDER BY priority DESC, created DESC',
            category: 'board',
            popular: true
        },
        {
            id: 'pending-pr-column',
            name: 'Pending PR Column',
            description: 'Tickets with code ready for pull request',
            query: 'status = "pending developer pull request" ORDER BY updated DESC',
            category: 'board',
            popular: true
        },
        {
            id: 'in-progress-column',
            name: 'In Progress Column',
            description: 'All tickets currently being worked on',
            query: 'status = "in progress" ORDER BY updated DESC',
            category: 'board',
            popular: true
        },
        {
            id: 'developer-review-column',
            name: 'Developer Review Column',
            description: 'Tickets in developer review phase',
            query: 'status = "Developer Review" ORDER BY updated ASC',
            category: 'board',
            popular: true
        },
        {
            id: 'qa-testing-column',
            name: 'QA Testing Column',
            description: 'Tickets in QA review and testing phase',
            query: 'status = "QA Review-Testing" ORDER BY priority DESC',
            category: 'board',
            popular: true
        },
        {
            id: 'release-ready-column',
            name: 'Release Ready Column',
            description: 'Tickets ready for production release',
            query: 'status = "release to prod" ORDER BY priority DESC',
            category: 'board',
            popular: false
        },
        {
            id: 'incomplete-code-column',
            name: 'Incomplete Code Column',
            description: 'Tickets with incomplete pushed code',
            query: 'status = "incomplete pushed code" ORDER BY updated DESC',
            category: 'board',
            popular: false
        },
        
        // Priority & Critical Items
        {
            id: 'critical-priority',
            name: 'Critical Priority',
            description: 'Highest priority items requiring immediate attention',
            query: 'priority IN (highest, block) AND status != done ORDER BY priority DESC, created DESC',
            category: 'priority',
            popular: true
        },
        {
            id: 'high-priority',
            name: 'High Priority Items',
            description: 'High priority tickets across all projects',
            query: 'priority = high AND status != done ORDER BY created DESC',
            category: 'priority',
            popular: true
        },
        {
            id: 'critical-in-title',
            name: 'Critical in Title',
            description: 'Tickets with "critical" mentioned in title or summary',
            query: '(summary ~ "critical" OR summary ~ "urgent" OR summary ~ "emergency") AND status != done ORDER BY priority DESC, created DESC',
            category: 'priority',
            popular: true
        },
        
        // Sprint & Board Management
        {
            id: 'current-sprint-all',
            name: 'Current Sprint - All Items',
            description: 'All items in the current active sprint',
            query: 'Sprint in openSprints() AND Sprint not in futureSprints() AND status != done ORDER BY rank ASC',
            category: 'sprint',
            popular: true
        },
        {
            id: 'sprint-blockers',
            name: 'Sprint Blockers',
            description: 'Blocked items in current sprint',
            query: 'Sprint in openSprints() AND (priority = block OR labels = blocked) AND status != done ORDER BY priority DESC',
            category: 'sprint',
            popular: true
        },
        {
            id: 'overdue-sprint',
            name: 'Overdue Sprint Items',
            description: 'Sprint items that are overdue',
            query: 'Sprint in openSprints() AND due < now() AND status != done ORDER BY due ASC',
            category: 'sprint',
            popular: false
        },
        
        // Bugs & Issues
        {
            id: 'recent-bugs',
            name: 'Recent Bugs',
            description: 'Bug tickets updated in the last 7 days',
            query: 'type = Bug AND updated >= -7d AND status != done ORDER BY priority DESC, updated DESC',
            category: 'bugs',
            popular: true
        },
        {
            id: 'production-bugs',
            name: 'Production Bugs',
            description: 'Bugs affecting production environment',
            query: 'type = Bug AND (labels IN (production, live, prod) OR priority IN (highest, block)) AND status != done ORDER BY priority DESC',
            category: 'bugs',
            popular: true
        },
        {
            id: 'unresolved-bugs',
            name: 'Unresolved Bugs',
            description: 'All open bugs not yet resolved',
            query: 'type = Bug AND status != done ORDER BY priority DESC, created DESC',
            category: 'bugs',
            popular: false
        },
        
        // Development Workflow
        {
            id: 'ready-for-dev',
            name: 'Ready for Development',
            description: 'Stories and tasks ready to be developed',
            query: 'status = "Ready for Development" AND type IN (Story, Task) AND status != done ORDER BY priority DESC',
            category: 'development',
            popular: false
        },
        {
            id: 'code-review-needed',
            name: 'Code Review Needed',
            description: 'Items waiting for code review',
            query: 'status = "Developer Review" ORDER BY updated ASC',
            category: 'development',
            popular: false
        },
        
        // Recent Activity
        {
            id: 'updated-today',
            name: 'Updated Today',
            description: 'All tickets updated today',
            query: 'updated >= -1d AND status != done ORDER BY updated DESC',
            category: 'recent',
            popular: false
        },
        {
            id: 'recent-stories',
            name: 'Recent User Stories',
            description: 'User stories created in the last 14 days',
            query: 'type = Story AND created >= -14d AND status != done ORDER BY created DESC',
            category: 'stories',
            popular: false
        },
        
        // Security & Compliance
        {
            id: 'security-issues',
            name: 'Security Related',
            description: 'Tickets tagged with security labels',
            query: 'labels in (security, vulnerability, auth, authentication) AND status != done ORDER BY priority DESC',
            category: 'security',
            popular: false
        }
    ],
    email: [
        {
            id: 'recent-support',
            name: 'Recent Support Emails',
            description: 'Support emails from the last 3 days',
            query: 'from:support AND newer_than:3d',
            category: 'support',
            popular: true
        },
        {
            id: 'bug-reports',
            name: 'Bug Reports',
            description: 'Emails containing bug reports or issues',
            query: 'subject:(bug OR issue OR problem OR error) AND newer_than:7d',
            category: 'bugs',
            popular: true
        },
        {
            id: 'feature-requests',
            name: 'Feature Requests',
            description: 'Customer feature requests and suggestions',
            query: 'subject:(feature OR request OR enhancement OR suggestion)',
            category: 'features',
            popular: false
        },
        {
            id: 'escalations',
            name: 'Escalated Issues',
            description: 'High priority customer escalations',
            query: 'subject:(urgent OR escalation OR priority) AND from:customer',
            category: 'escalations',
            popular: true
        }
    ],
    slack: [
        {
            id: 'recent-discussions',
            name: 'Recent Discussions',
            description: 'Messages from the last 24 hours',
            query: 'after:yesterday',
            category: 'recent',
            popular: true
        },
        {
            id: 'bug-mentions',
            name: 'Bug Mentions',
            description: 'Messages mentioning bugs or issues',
            query: 'bug OR issue OR broken OR error',
            category: 'bugs',
            popular: true
        },
        {
            id: 'deployment-chat',
            name: 'Deployment Discussion',
            description: 'Conversations about deployments',
            query: 'deploy OR deployment OR release OR production',
            category: 'deployments',
            popular: false
        },
        {
            id: 'dev-questions',
            name: 'Development Questions',
            description: 'Questions and help requests from developers',
            query: 'help OR question OR how to OR stuck',
            category: 'questions',
            popular: false
        },
        {
            id: 'incident-response',
            name: 'Incident Response',
            description: 'Incident and outage related discussions',
            query: 'incident OR outage OR down OR offline',
            category: 'incidents',
            popular: true
        }
    ],
    git: [
        {
            id: 'grab-repo',
            name: 'Grab Entire Repository',
            description: 'Clone/grab the entire {repo} repository for context',
            query: 'GRAB_REPO',
            category: 'repository',
            popular: true
        },
        {
            id: 'recent-docs',
            name: 'Recent Documentation',
            description: 'Documentation files updated recently in {repo}',
            query: 'repo:OWNER/REPO path:docs/ OR path:README* modified:>7d',
            category: 'documentation',
            popular: true
        },
        {
            id: 'config-files',
            name: 'Configuration Files',
            description: 'Configuration and setup files in {repo}',
            query: 'repo:OWNER/REPO path:config/ OR filename:.env OR filename:*.conf',
            category: 'config',
            popular: false
        },
        {
            id: 'api-docs',
            name: 'API Documentation',
            description: 'API related documentation and specs in {repo}',
            query: 'repo:OWNER/REPO path:api/ OR filename:swagger OR filename:openapi',
            category: 'api',
            popular: true
        },
        {
            id: 'security-docs',
            name: 'Security Documentation',
            description: 'Security policies and procedures in {repo}',
            query: 'repo:OWNER/REPO path:security/ OR filename:*security* OR content:authentication',
            category: 'security',
            popular: false
        },
        {
            id: 'troubleshooting',
            name: 'Troubleshooting Guides',
            description: 'Troubleshooting and FAQ documentation in {repo}',
            query: 'repo:OWNER/REPO filename:*troubleshoot* OR filename:*faq* OR content:"common issues"',
            category: 'support',
            popular: true
        },
        {
            id: 'recent-commits',
            name: 'Recent Changes',
            description: 'Files modified in recent commits in {repo}',
            query: 'repo:OWNER/REPO pushed:>7d',
            category: 'recent',
            popular: true
        },
        {
            id: 'package-files',
            name: 'Package & Build Files',
            description: 'Package managers and build configuration in {repo}',
            query: 'repo:OWNER/REPO filename:package.json OR filename:Dockerfile OR filename:*requirements*',
            category: 'config',
            popular: false
        }
    ],
    file: []
};
// Categories for organizing queries
export const QueryCategories: Record<string, QueryCategory> = {
    personal: { id: 'personal', name: 'Personal', icon: '👤', description: 'Items assigned to you' },
    board: { id: 'board', name: 'Board Columns', icon: '📋', description: 'Status columns on boards' },
    sprint: { id: 'sprint', name: 'Sprint Management', icon: '🏃', description: 'Sprint-based queries' },
    priority: { id: 'priority', name: 'Priority', icon: '⚡', description: 'High priority items' },
    bugs: { id: 'bugs', name: 'Bugs & Issues', icon: '🐛', description: 'Bug reports and problems' },
    development: { id: 'development', name: 'Development', icon: '💻', description: 'Development workflow items' },
    recent: { id: 'recent', name: 'Recent Activity', icon: '🕐', description: 'Recently updated items' },
    stories: { id: 'stories', name: 'Stories', icon: '📝', description: 'User stories and features' },
    security: { id: 'security', name: 'Security', icon: '🔒', description: 'Security related items' },
    status: { id: 'status', name: 'Status', icon: '📊', description: 'Filter by status' },
    repository: { id: 'repository', name: 'Repository', icon: '📁', description: 'Repository-level operations' },
    review: { id: 'review', name: 'Review', icon: '👀', description: 'Items ready for review' },
    support: { id: 'support', name: 'Support', icon: '🛟', description: 'Customer support items' },
    features: { id: 'features', name: 'Features', icon: '✨', description: 'Feature requests' },
    escalations: { id: 'escalations', name: 'Escalations', icon: '🚨', description: 'Urgent items' },
    deployments: { id: 'deployments', name: 'Deployments', icon: '🚀', description: 'Deployment related' },
    questions: { id: 'questions', name: 'Questions', icon: '❓', description: 'Help and questions' },
    incidents: { id: 'incidents', name: 'Incidents', icon: '🔥', description: 'Incidents and outages' },
    documentation: { id: 'documentation', name: 'Documentation', icon: '📚', description: 'Documentation files' },
    config: { id: 'config', name: 'Configuration', icon: '⚙️', description: 'Config files' },
    api: { id: 'api', name: 'API', icon: '🔌', description: 'API documentation' }
};
export function getTemplatesForSource(source: ContextSource, repoInfo?: { owner: string; repo: string; repoUrl: string } | null): QueryTemplate[] {
    const templates = QueryTemplates[source] || [];
    
    // For git sources, customize templates with repository info
    if (source === 'git' && repoInfo) {
        return templates.map(template => ({
            ...template,
            query: template.query.replace(/repo:OWNER\/REPO/g, `repo:${repoInfo.owner}/${repoInfo.repo}`),
            description: template.description.replace(/\{repo\}/g, `${repoInfo.owner}/${repoInfo.repo}`)
        }));
    }
    
    return templates;
}

export function getPopularTemplates(source: ContextSource, repoInfo?: { owner: string; repo: string; repoUrl: string } | null): QueryTemplate[] {
    const templates = getTemplatesForSource(source, repoInfo);
    return templates.filter(template => template.popular);
}
export function getTemplatesByCategory(source: ContextSource, category: string): QueryTemplate[] {
    const templates = QueryTemplates[source] || [];
    return templates.filter(template => template.category === category);
}
export function getCategoriesForSource(source: ContextSource): QueryCategory[] {
    const templates = QueryTemplates[source] || [];
    const categories = [...new Set(templates.map(t => t.category))];
    return categories.map(cat => QueryCategories[cat]).filter(cat => cat && cat.name); // Only return categories we have metadata for
}
export function searchTemplates(source: ContextSource, searchTerm: string): QueryTemplate[] {
    const templates = QueryTemplates[source] || [];
    const term = searchTerm.toLowerCase();
    return templates.filter(template =>
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.category.toLowerCase().includes(term)
    );
}