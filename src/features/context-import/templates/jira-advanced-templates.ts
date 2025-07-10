import { QueryTemplate } from '@/features/context-import/types';
export const JIRA_ADVANCED_TEMPLATES: QueryTemplate[] = [
    // Development-focused templates
    {
        id: 'dev-my-active-tickets',
        name: 'My Active Development Tickets',
        description: 'All tickets assigned to me that are currently being worked on',
        query: 'assignee = currentUser() AND status IN ("In Progress", "In Review", "Testing") ORDER BY priority DESC, updated DESC',
        category: 'development',
        popular: true
    },
    {
        id: 'dev-high-priority-bugs',
        name: 'High Priority Bugs',
        description: 'Critical and high priority bugs across all projects',
        query: 'type = Bug AND priority IN (Highest, High) AND status != Done ORDER BY priority DESC, created DESC',
        category: 'development',
        popular: true
    },
    {
        id: 'dev-sprint-backlog',
        name: 'Current Sprint Backlog',
        description: 'All items in the current sprint',
        query: 'Sprint in openSprints() AND Sprint not in futureSprints() ORDER BY rank ASC',
        category: 'development',
        popular: true
    },
    {
        id: 'dev-blocked-tickets',
        name: 'Blocked Tickets',
        description: 'Tickets that are blocked and need attention',
        query: 'status = "Blocked" OR labels = "blocked" OR priority = Blocker ORDER BY updated DESC',
        category: 'development',
        popular: true
    },
    {
        id: 'dev-ready-for-testing',
        name: 'Ready for Testing',
        description: 'Development complete, ready for QA testing',
        query: 'status IN ("Ready for Testing", "QA", "Testing") ORDER BY priority DESC, updated DESC',
        category: 'development',
        popular: true
    },
    // Project Management templates
    {
        id: 'pm-overdue-tickets',
        name: 'Overdue Tickets',
        description: 'Tickets that are past their due date',
        query: 'due < now() AND status NOT IN (Done, Closed, Resolved) ORDER BY due ASC',
        category: 'project-management',
        popular: true
    },
    {
        id: 'pm-unassigned-tickets',
        name: 'Unassigned Tickets',
        description: 'Tickets without an assignee that need attention',
        query: 'assignee is EMPTY AND status NOT IN (Done, Closed, Resolved) ORDER BY priority DESC, created DESC',
        category: 'project-management',
        popular: true
    },
    {
        id: 'pm-recently-created',
        name: 'Recently Created (Last 7 Days)',
        description: 'New tickets created in the last week',
        query: 'created >= -7d ORDER BY created DESC',
        category: 'project-management',
        popular: true
    },
    {
        id: 'pm-epic-progress',
        name: 'Epic Progress Tracking',
        description: 'All stories under specific epics with progress',
        query: '"Epic Link" is not EMPTY ORDER BY "Epic Link", priority DESC',
        category: 'project-management',
        popular: false
    },
    // Team Collaboration templates
    {
        id: 'team-code-review',
        name: 'Code Review Required',
        description: 'Tickets in code review status',
        query: 'status IN ("Code Review", "Peer Review", "In Review") ORDER BY updated ASC',
        category: 'team',
        popular: true
    },
    {
        id: 'team-my-reported',
        name: 'Issues I Reported',
        description: 'Tickets I have reported/created',
        query: 'reporter = currentUser() ORDER BY created DESC',
        category: 'team',
        popular: false
    },
    {
        id: 'team-watching',
        name: 'Issues I\'m Watching',
        description: 'Tickets I am watching for updates',
        query: 'watcher = currentUser() ORDER BY updated DESC',
        category: 'team',
        popular: false
    },
    {
        id: 'team-needs-feedback',
        name: 'Needs Feedback',
        description: 'Tickets requiring feedback or input',
        query: 'labels IN ("needs-feedback", "feedback-required") OR status = "Waiting for feedback" ORDER BY priority DESC',
        category: 'team',
        popular: true
    },
    // Quality & Testing templates
    {
        id: 'qa-failed-tests',
        name: 'Failed Tests',
        description: 'Tickets that failed testing and need rework',
        query: 'status IN ("Failed Testing", "Reopened", "Failed QA") ORDER BY priority DESC, updated DESC',
        category: 'quality',
        popular: true
    },
    {
        id: 'qa-regression-bugs',
        name: 'Regression Bugs',
        description: 'Bugs that were previously working',
        query: 'type = Bug AND labels = "regression" ORDER BY priority DESC, created DESC',
        category: 'quality',
        popular: true
    },
    {
        id: 'qa-production-issues',
        name: 'Production Issues',
        description: 'Issues affecting production environment',
        query: 'labels IN ("production", "live-issue") OR priority = Blocker ORDER BY priority DESC, created DESC',
        category: 'quality',
        popular: true
    },
    // Advanced search templates
    {
        id: 'advanced-component-bugs',
        name: 'Component-Specific Bugs',
        description: 'Bugs in specific components (modify component name)',
        query: 'type = Bug AND component = "API" ORDER BY priority DESC, created DESC',
        category: 'advanced',
        popular: false
    },
    {
        id: 'advanced-fixversion-progress',
        name: 'Fix Version Progress',
        description: 'Progress on specific fix version (modify version)',
        query: 'fixVersion = "1.2.0" ORDER BY status ASC, priority DESC',
        category: 'advanced',
        popular: false
    },
    {
        id: 'advanced-custom-field',
        name: 'Custom Field Query',
        description: 'Query using custom fields (modify field name)',
        query: 'cf[10001] = "High" ORDER BY updated DESC',
        category: 'advanced',
        popular: false
    },
    {
        id: 'advanced-time-tracking',
        name: 'Time Tracking Analysis',
        description: 'Tickets with time tracking information',
        query: 'timeoriginalestimate > 0 AND timespent > 0 ORDER BY "Time Spent" DESC',
        category: 'advanced',
        popular: false
    },
    // Business-focused templates
    {
        id: 'business-user-stories',
        name: 'User Stories',
        description: 'All user stories across projects',
        query: 'type = "User Story" ORDER BY priority DESC, created DESC',
        category: 'business',
        popular: true
    },
    {
        id: 'business-features',
        name: 'New Features',
        description: 'New feature requests and enhancements',
        query: 'type IN ("New Feature", "Enhancement", "Feature") ORDER BY priority DESC, created DESC',
        category: 'business',
        popular: true
    },
    {
        id: 'business-customer-requests',
        name: 'Customer Requests',
        description: 'Tickets tagged as customer requests',
        query: 'labels IN ("customer-request", "client-request") ORDER BY priority DESC, created DESC',
        category: 'business',
        popular: false
    }
];
export const JIRA_TEMPLATE_CATEGORIES = [
    {
        id: 'development',
        name: 'Development',
        icon: '💻',
        description: 'Templates for developers and coding tasks'
    },
    {
        id: 'project-management',
        name: 'Project Management',
        icon: '📋',
        description: 'Templates for project tracking and management'
    },
    {
        id: 'team',
        name: 'Team Collaboration',
        icon: '👥',
        description: 'Templates for team communication and collaboration'
    },
    {
        id: 'quality',
        name: 'Quality & Testing',
        icon: '🧪',
        description: 'Templates for QA and testing workflows'
    },
    {
        id: 'business',
        name: 'Business',
        icon: '💼',
        description: 'Templates for business requirements and features'
    },
    {
        id: 'advanced',
        name: 'Advanced',
        icon: '⚡',
        description: 'Complex queries and advanced use cases'
    }
];
export function getTemplatesByCategory(category: string): QueryTemplate[] {
    return JIRA_ADVANCED_TEMPLATES.filter(template => template.category === category);
}
export function getPopularTemplates(): QueryTemplate[] {
    return JIRA_ADVANCED_TEMPLATES.filter(template => template.popular);
}
export function getTemplateById(id: string): QueryTemplate | undefined {
    return JIRA_ADVANCED_TEMPLATES.find(template => template.id === id);
}
export function searchTemplates(query: string): QueryTemplate[] {
    const lowerQuery = query.toLowerCase();
    return JIRA_ADVANCED_TEMPLATES.filter(template =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery)
    );
}