import { ContextItem } from '@/features/context-import/types';
export interface LibraryItem extends ContextItem {
    library_metadata: {
        added_at: string;
        status: 'active' | 'archived';
        clone_mode?: 'read-only' | 'writeable' | 'context-only';
    };
}
export interface LibraryState {
    items: LibraryItem[];
    selectedItems: Set<string>;
    loading: boolean;
}
export interface WorkspaceCreationOptions {
    mode: 'all' | 'each';
    selectedItems: LibraryItem[];
}