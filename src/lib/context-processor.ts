import crypto from 'crypto';
import { ContextItem, ContextSource, ContextType } from '@/features/context-import/types';
export class ContextProcessor {
    static generateContextId(): string {
        return 'ctx-' + crypto.randomBytes(8).toString('hex');
    }
    static async processContext(
        rawContent: any,
        sourceType: ContextSource,
        metadata: Record<string, any> = {}
    ): Promise<ContextItem> {
        const contextItem: ContextItem = {
            id: this.generateContextId(),
            type: this.inferContextType(sourceType, rawContent),
            title: this.extractTitle(rawContent, metadata, sourceType),
            description: this.generateDescription(sourceType, metadata),
            content: this.sanitizeContent(rawContent),
            preview: this.generatePreview(rawContent),
            metadata: this.enrichMetadata(metadata, sourceType),
            tags: this.extractTags(rawContent, metadata),
            source: sourceType,
            added_at: new Date().toISOString(),
            size_bytes: JSON.stringify(rawContent).length
        };
        return contextItem;
    }
    static inferContextType(sourceType: ContextSource, content: any): ContextType {
        const typeMap: Record<ContextSource, ContextType> = {
            'jira': 'jira_ticket',
            'email': 'email_thread',
            'slack': 'slack_message',
            'git': 'git_repository',
            'file': 'document'
        };
        return typeMap[sourceType] || 'unknown';
    }
    static extractTitle(content: any, metadata: Record<string, any>, sourceType: ContextSource): string {
        if (metadata.title) return metadata.title;
        if (content.title) return content.title;
        if (content.summary) return content.summary;
        if (content.subject) return content.subject;
        if (content.key && content.summary) return `${content.key}: ${content.summary}`;
        // Generate title based on source type
        const now = new Date().toISOString().split('T')[0];
        return `${sourceType.toUpperCase()} Import - ${now}`;
    }
    static generateDescription(sourceType: ContextSource, metadata: Record<string, any>): string {
        const descriptions: Record<ContextSource, string> = {
            'jira': 'JIRA ticket containing requirements and specifications',
            'email': 'Email thread with relevant context and communication',
            'slack': 'Slack conversation with team discussions',
            'git': 'Git repository with code and documentation',
            'file': 'Document file with additional context'
        };
        return descriptions[sourceType] || `Content imported from ${sourceType}`;
    }
    static sanitizeContent(content: any): any {
        // Remove potential security issues, normalize format
        if (typeof content === 'string') {
            return content.trim();
        }
        return content;
    }
    static generatePreview(content: any): string {
        let text = '';
        if (typeof content === 'string') {
            text = content;
        } else if (content.description) {
            text = content.description;
        } else if (content.body) {
            text = content.body;
        } else if (content.summary) {
            text = content.summary;
        } else {
            text = JSON.stringify(content);
        }
        return text.substring(0, 150) + (text.length > 150 ? '...' : '');
    }
    static enrichMetadata(metadata: Record<string, any>, sourceType: ContextSource): Record<string, any> {
        return {
            ...metadata,
            source: sourceType,
            processed_at: new Date().toISOString(),
            processor_version: '1.0.0'
        };
    }
    static extractTags(content: any, metadata: Record<string, any>): string[] {
        const tags: string[] = [];
        // Add source tag
        tags.push(metadata.source || 'unknown');
        // Extract from content
        if (content.labels) tags.push(...content.labels);
        if (content.tags) tags.push(...content.tags);
        if (metadata.priority) tags.push(`priority-${metadata.priority.toLowerCase()}`);
        if (metadata.status) tags.push(`status-${metadata.status.toLowerCase()}`);
        return [...new Set(tags)]; // Remove duplicates
    }
}