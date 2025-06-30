/**
 * Workspace Draft Types
 */

import { LibraryItem } from '@/features/context-library/types';

export interface WorkspaceDraft {
    id: string;
    name: string;
    created_at: string;
    updated_at?: string;
    status: 'draft' | 'publishing' | 'published';
    context_items: LibraryItem[];
    target_items: any[];
    feedback_config: {
        status_updates?: boolean;
        progress_tracking?: boolean;
        result_storage?: string;
    };
    agent_configs: AgentConfig[];
}

export interface AgentConfig {
    id: string;
    name: string;
    role: string;
    permissions: string[];
    commands: string[];
    model?: string;
    priority?: number;
}

export interface ContextManifest {
    workspace_id: string;
    created: string;
    last_updated: string;
    total_items: number;
    context_items: ContextManifestItem[];
    context_summary: string;
}

export interface ContextManifestItem {
    id: string;
    type: string;
    title: string;
    description: string;
    content_file: string;
    preview: string;
    metadata: Record<string, any>;
    tags: string[];
    added_at: string;
    size_bytes: number;
}