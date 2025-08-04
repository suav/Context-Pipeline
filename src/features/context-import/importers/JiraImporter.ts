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
    private getAuthHeader(): string {
        const auth = Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');
        return `Basic ${auth}`;
    }
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
    async search(searchParams: any = {}): Promise<ImportResult> {
        try {
            const jql = this.buildJqlQuery(searchParams);
            console.log('🔍 JIRA Query:', jql);
            // Validate JQL before sending
            const validationResult = await this.validateJql(jql);
            if (!validationResult.valid) {
                throw new Error(`Invalid JQL: ${validationResult.error}`);
            }
            // URL encode the JQL
            const encodedJql = encodeURIComponent(jql);
            const fields = config.jira.defaultFields + ',attachment';
            const maxResults = searchParams.maxResults || this.maxResults;
            const url = `${this.baseUrl}/rest/api/3/search?jql=${encodedJql}&maxResults=${maxResults}&fields=${fields}`;
            // console.log removed - contained sensitive data);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            if (!response.ok) {
                const errorText = await response.text();
                const errorDetails = this.parseJiraError(response.status, errorText);
                throw new Error(errorDetails);
            }
            const data = await response.json();
            // Transform JIRA response to context import format
            const contextItems = await Promise.all(
                data.issues.map(async (issue: any) => await this.transformJiraIssue(issue))
            );
            return {
                success: true,
                source: 'jira',
                query: jql,
                total: data.total,
                items: contextItems,
                metadata: {
                    maxResults: data.maxResults,
                    startAt: data.startAt,
                    isLast: data.startAt + data.issues.length >= data.total,
                    executionTime: Date.now()
                }
            };
        } catch (error) {
            console.error('❌ JIRA Import Error:', error);
            return {
                success: false,
                source: 'jira',
                error: this.formatErrorMessage(error as Error),
                items: [],
                total: 0
            };
        }
    }
    private async transformJiraIssue(issue: any): Promise<ContextItem> {
        const fields = issue.fields;
        // Process attachments if they exist
        const attachments = await this.processAttachments(fields.attachment || []);
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
                reporter: fields.reporter?.displayName,
                created: fields.created,
                updated: fields.updated,
                labels: fields.labels || [],
                components: fields.components?.map((c: any) => c.name) || [],
                fixVersions: fields.fixVersions?.map((v: any) => v.name) || [],
                attachments: attachments,
                commentCount: fields.comment?.total || 0,
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
                reporter: fields.reporter?.displayName || 'Unknown',
                created: fields.created,
                updated: fields.updated,
                labels: fields.labels || [],
                components: fields.components?.map((c: any) => c.name) || [],
                hasAttachments: attachments.length > 0,
                attachmentCount: attachments.length
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
    private async processAttachments(attachments: any[]): Promise<any[]> {
        if (!attachments || attachments.length === 0) {
            return [];
        }
        return attachments.map(attachment => ({
            id: attachment.id,
            filename: attachment.filename,
            size: attachment.size,
            mimeType: attachment.mimeType,
            created: attachment.created,
            author: attachment.author?.displayName,
            downloadUrl: attachment.content,
            thumbnail: attachment.thumbnail
        }));
    }
    private async validateJql(jql: string): Promise<{valid: boolean, error?: string}> {
        try {
            // Basic JQL validation
            if (!jql || jql.trim().length === 0) {
                return { valid: false, error: 'JQL query cannot be empty' };
            }
            // Check for common JQL syntax issues - only block standalone SQL keywords, not field names
            const forbidden = ['DROP', 'DELETE', 'INSERT'];
            const upperJql = jql.toUpperCase();
            
            // Only block standalone words, not as part of field names like 'createdAt' or 'updatedAt'
            for (const word of forbidden) {
                // Use word boundaries to avoid blocking valid field names
                const regex = new RegExp(`\\b${word}\\b`, 'i');
                if (regex.test(jql)) {
                    return { valid: false, error: `JQL contains forbidden keyword: ${word}` };
                }
            }
            // Check for balanced parentheses
            let parenCount = 0;
            for (const char of jql) {
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
                if (parenCount < 0) {
                    return { valid: false, error: 'Unbalanced parentheses in JQL' };
                }
            }
            if (parenCount !== 0) {
                return { valid: false, error: 'Unbalanced parentheses in JQL' };
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: `JQL validation error: ${(error as Error).message}` };
        }
    }
    private parseJiraError(status: number, errorText: string): string {
        try {
            const errorData = JSON.parse(errorText);
            switch (status) {
                case 400:
                    if (errorData.errorMessages && errorData.errorMessages.length > 0) {
                        return `Bad Request: ${errorData.errorMessages[0]}`;
                    }
                    return 'Bad Request: Invalid query or parameters';
                case 401:
                    return 'Authentication failed: Please check your JIRA credentials';
                case 403:
                    return 'Access denied: You do not have permission to access this resource';
                case 404:
                    return 'Not found: The requested resource does not exist';
                case 429:
                    return 'Rate limit exceeded: Too many requests. Please try again later';
                case 500:
                    return 'JIRA server error: Please try again later';
                default:
                    return `JIRA API error (${status}): ${errorData.message || errorText}`;
            }
        } catch {
            return `HTTP ${status}: ${errorText}`;
        }
    }
    private formatErrorMessage(error: Error): string {
        const message = error.message;
        // Common error patterns and user-friendly messages
        if (message.includes('ENOTFOUND') || message.includes('network')) {
            return 'Network error: Cannot connect to JIRA server. Please check your connection and JIRA URL.';
        }
        if (message.includes('timeout')) {
            return 'Request timeout: JIRA server is taking too long to respond. Please try again.';
        }
        if (message.includes('credentials') || message.includes('Authentication')) {
            return 'Authentication error: Please check your JIRA username and API token.';
        }
        if (message.includes('Invalid JQL')) {
            return `JQL Syntax Error: ${message}`;
        }
        return message;
    }
    async bulkImport(jql: string, options: {
        maxResults?: number,
        batchSize?: number,
        onProgress?: (current: number, total: number) => void
    } = {}): Promise<ImportResult> {
        const { maxResults = 1000, batchSize = 50, onProgress } = options;
        const allItems: any[] = [];
        let startAt = 0;
        let totalResults = 0;
        try {
            do {
                const result = await this.search({
                    query: jql,
                    maxResults: batchSize,
                    startAt: startAt
                });
                if (!result.success) {
                    throw new Error(result.error || 'Bulk import failed');
                }
                allItems.push(...result.items);
                totalResults = result.total;
                startAt += batchSize;
                onProgress?.(allItems.length, Math.min(totalResults, maxResults));
            } while (startAt < totalResults && allItems.length < maxResults);
            return {
                success: true,
                source: 'jira',
                query: jql,
                total: totalResults,
                items: allItems.slice(0, maxResults),
                metadata: {
                    bulkImport: true,
                    requestedMax: maxResults,
                    actualTotal: totalResults
                }
            };
        } catch (error) {
            return {
                success: false,
                source: 'jira',
                error: this.formatErrorMessage(error as Error),
                items: allItems, // Return partial results
                total: allItems.length
            };
        }
    }
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