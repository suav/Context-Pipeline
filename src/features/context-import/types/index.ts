/**
 * Context Import Types
 * 
 * All type definitions for the context import feature
 */

export type ContextSource = 'jira' | 'email' | 'slack' | 'git' | 'file';

export type ContextType = 'jira_ticket' | 'email_thread' | 'slack_message' | 'git_repository' | 'document' | 'unknown';

export interface ContextItem {
    id: string;
    title: string;
    description: string;
    content: any;
    preview: string;
    metadata: Record<string, any>;
    tags: string[];
    source: ContextSource;
    type: ContextType;
    added_at: string;
    size_bytes: number;
}

export interface ImportResult {
    success: boolean;
    source: ContextSource;
    query?: string;
    items: ContextItem[];
    total: number;
    error?: string;
    mock?: boolean;
    metadata?: Record<string, any>;
}

export interface ProcessResult {
    success: boolean;
    processed_items: ContextItem[];
    total_processed: number;
    error?: string;
}

export interface LibraryIndex {
    created: string;
    last_updated: string;
    total_items: number;
    items: LibraryItem[];
}

export interface LibraryItem {
    id: string;
    title: string;
    description: string;
    preview: string;
    source: ContextSource;
    type: ContextType;
    tags: string[];
    added_at: string;
    size_bytes: number;
    content_file: string;
}

export interface QueryTemplate {
    id: string;
    name: string;
    description: string;
    query: string;
    category: string;
    popular: boolean;
}

export interface QueryCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
}

export interface CustomQuery extends QueryTemplate {
    created: string;
    custom: true;
    usage_count: number;
    last_used: string | null;
    updated?: string;
}

// Workflow stages
export const WORKFLOW_STAGES = {
    IMPORT: 'import',
    PROCESS: 'process', 
    LIBRARY: 'library',
    WORKSPACE: 'workspace'
} as const;

// Stage configuration for UI (removed import stage - now handled via modal)
export const STAGE_CONFIG = [
    { key: 'library', label: 'Library', icon: '📚', description: 'Manage context items' },
    { key: 'workspace', label: 'Workspace', icon: '🏗️', description: 'Create workspaces' }
];

// Source configuration for UI
export const SOURCE_CONFIG = [
    { 
        type: 'jira', 
        name: 'JIRA Tickets', 
        icon: '🎫', 
        description: 'Import tickets, bugs, and stories',
        placeholder: 'assignee = currentUser() AND status != Done'
    },
    { 
        type: 'email', 
        name: 'Email Messages', 
        icon: '📧', 
        description: 'Import emails and threads',
        placeholder: 'from:support@company.com subject:bug'
    },
    { 
        type: 'slack', 
        name: 'Slack Messages', 
        icon: '💬', 
        description: 'Import conversations',
        placeholder: 'bug OR issue in:#general'
    },
    { 
        type: 'git', 
        name: 'Git Repositories', 
        icon: '📁', 
        description: 'Import documentation and code',
        placeholder: 'path:docs/ OR filename:README*'
    }
];