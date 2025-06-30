/**
 * JIRA Importer for Context Pipeline
 * 
 * Real JIRA API integration using your actual credentials
 */

import { config } from '@/lib/config';
import { ContextItem, ImportResult } from '@/features/context-import/types';

export class JiraImporter {
    
    constructor(private credentials: any = {}) {
        // Use environment variables or passed credentials
        this.baseUrl = credentials.baseUrl || process.env.JIRA_BASE_URL || config.jira.baseUrl;
        this.username = credentials.username || process.env.JIRA_USERNAME || config.jira.username;
        this.apiToken = credentials.apiToken || process.env.JIRA_API_TOKEN || config.jira.apiToken;
        this.maxResults = credentials.maxResults || config.jira.maxResults;
        
        if (!this.baseUrl || !this.username || !this.apiToken) {
            throw new Error('JIRA credentials not configured. Please set environment variables.');
        }
    }
    
    private baseUrl: string;
    private username: string;
    private apiToken: string;
    private maxResults: number;
    
    /**
     * Build authorization header
     */
    private getAuthHeader(): string {
        const auth = Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');
        return `Basic ${auth}`;
    }
    
    /**
     * Build JQL query from search parameters
     */
    private buildJqlQuery(searchParams: any): string {
        if (typeof searchParams === 'string') {
            return searchParams;
        }
        
        const conditions: string[] = [];
        
        // Handle different search parameter types
        if (searchParams.assignee) {
            if (searchParams.assignee === 'currentUser()') {
                conditions.push('assignee = currentUser()');
            } else {
                conditions.push(`assignee = "${searchParams.assignee}"`);
            }
        }
        
        if (searchParams.status) {
            conditions.push(`status = "${searchParams.status}"`);
        }
        
        if (searchParams.priority) {
            conditions.push(`priority = "${searchParams.priority}"`);
        }
        
        if (searchParams.project) {
            conditions.push(`project = "${searchParams.project}"`);
        }
        
        if (searchParams.labels && searchParams.labels.length > 0) {
            const labelConditions = searchParams.labels.map((label: string) => `labels = "${label}"`);
            conditions.push(`(${labelConditions.join(' OR ')})`);
        }
        
        // Handle custom JQL
        if (searchParams.jql) {
            conditions.push(searchParams.jql);
        }
        
        // Handle direct query string
        if (searchParams.query) {
            return searchParams.query;
        }
        
        // Default query if no conditions
        if (conditions.length === 0) {
            return 'assignee = currentUser() AND status != Done ORDER BY updated DESC';
        }
        
        return conditions.join(' AND ') + ' ORDER BY updated DESC';
    }
    
    /**
     * Search JIRA tickets using JQL
     */
    async search(searchParams: any = {}): Promise<ImportResult> {
        try {
            const jql = this.buildJqlQuery(searchParams);
            console.log('🔍 JIRA Query:', jql);
            
            // URL encode the JQL
            const encodedJql = encodeURIComponent(jql);
            const fields = config.jira.defaultFields;
            const maxResults = searchParams.maxResults || this.maxResults;
            
            const url = `${this.baseUrl}/rest/api/3/search?jql=${encodedJql}&maxResults=${maxResults}&fields=${fields}`;
            
            console.log('🌐 JIRA URL:', url.replace(this.apiToken, '***'));
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`JIRA API error ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            // Transform JIRA response to context import format
            const contextItems = data.issues.map((issue: any) => this.transformJiraIssue(issue));
            
            return {
                success: true,
                source: 'jira',
                query: jql,
                total: data.total,
                items: contextItems,
                metadata: {
                    maxResults: data.maxResults,
                    startAt: data.startAt,
                    isLast: data.startAt + data.issues.length >= data.total
                }
            };
            
        } catch (error) {
            console.error('❌ JIRA Import Error:', error);
            return {
                success: false,
                source: 'jira',
                error: (error as Error).message,
                items: [],
                total: 0
            };
        }
    }
    
    /**
     * Transform JIRA issue to universal context format
     */
    private transformJiraIssue(issue: any): ContextItem {
        const fields = issue.fields;
        
        return {
            // Universal context fields
            id: issue.key,
            title: `${issue.key}: ${fields.summary}`,
            description: (typeof fields.description === 'string' ? fields.description : fields.summary),
            content: {
                key: issue.key,
                summary: fields.summary,
                description: fields.description,
                status: fields.status?.name,
                priority: fields.priority?.name,
                assignee: fields.assignee?.displayName,
                created: fields.created,
                updated: fields.updated,
                labels: fields.labels || [],
                raw: issue // Keep full JIRA data
            },
            
            // Context metadata
            metadata: {
                source: 'jira',
                ticket_id: issue.key,
                jira_url: `${this.baseUrl}/browse/${issue.key}`,
                priority: fields.priority?.name,
                status: fields.status?.name,
                assignee: fields.assignee?.displayName || 'Unassigned',
                created: fields.created,
                updated: fields.updated,
                labels: fields.labels || []
            },
            
            // For processing pipeline
            source: 'jira',
            type: 'jira_ticket',
            preview: this.generatePreview(fields),
            tags: this.extractTags(fields),
            added_at: new Date().toISOString(),
            size_bytes: JSON.stringify(issue).length
        };
    }
    
    /**
     * Generate preview text from JIRA issue
     */
    private generatePreview(fields: any): string {
        let preview = fields.summary || 'No summary';
        
        if (fields.description && typeof fields.description === 'string') {
            // Clean up JIRA markup and get first paragraph
            const cleanDesc = fields.description
                .replace(/\{[^}]*\}/g, '') // Remove JIRA markup
                .replace(/\n+/g, ' ')      // Collapse newlines
                .trim();
            
            if (cleanDesc.length > 0) {
                preview += ': ' + cleanDesc;
            }
        }
        
        return preview.substring(0, 200) + (preview.length > 200 ? '...' : '');
    }
    
    /**
     * Extract tags from JIRA issue
     */
    private extractTags(fields: any): string[] {
        const tags = ['jira'];
        
        if (fields.priority?.name) {
            tags.push(`priority-${fields.priority.name.toLowerCase()}`);
        }
        
        if (fields.status?.name) {
            tags.push(`status-${fields.status.name.toLowerCase().replace(/\s+/g, '-')}`);
        }
        
        if (fields.labels) {
            tags.push(...fields.labels.map((label: string) => `label-${label.toLowerCase()}`));
        }
        
        return tags;
    }
    
    /**
     * Test JIRA connection
     */
    async testConnection() {
        try {
            const url = `${this.baseUrl}/rest/api/3/myself`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Connection failed: ${response.status}`);
            }
            
            const user = await response.json();
            return {
                success: true,
                user: {
                    displayName: user.displayName,
                    emailAddress: user.emailAddress,
                    accountId: user.accountId
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }
}