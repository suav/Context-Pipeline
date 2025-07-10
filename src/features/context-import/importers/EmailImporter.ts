import { ContextItem, ImportResult } from '@/features/context-import/types';
import { ContextProcessor } from '@/lib/context-processor';
import {
    EmailProvider,
    EmailConnection,
    EmailMessage,
    EmailThread,
    EmailSearchOptions,
    EmailImportOptions,
    EMAIL_PROVIDERS,
    DEFAULT_EMAIL_SEARCH,
    DEFAULT_EMAIL_IMPORT
} from '@/features/context-import/types/email-types';
import { EmailProcessor } from '@/features/context-import/services/EmailProcessor';
export class EmailImporter {
    private connection: EmailConnection | null = null;
    constructor(private options: EmailImportOptions = DEFAULT_EMAIL_IMPORT) {}
    static getProviders(): EmailProvider[] {
        return EMAIL_PROVIDERS;
    }
    async testConnection(provider: EmailProvider, config: Record<string, any>): Promise<{success: boolean, error?: string}> {
        try {
            // This would implement actual connection testing
            // For now, return a simulated response
            if (!this.validateConfig(provider, config)) {
                return { success: false, error: 'Invalid configuration parameters' };
            }
            // Simulate connection test
            await this.simulateConnectionTest(provider, config);
            this.connection = {
                provider,
                config,
                authenticated: true,
                lastTested: new Date().toISOString()
            };
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: `Connection failed: ${(error as Error).message}`
            };
        }
    }
    async import(searchOptions: EmailSearchOptions = DEFAULT_EMAIL_SEARCH): Promise<ImportResult> {
        try {
            if (!this.connection?.authenticated) {
                throw new Error('No authenticated email connection. Please test connection first.');
            }
            console.log('🔍 Email Search:', searchOptions);
            // Get messages from email provider
            const messages = await this.searchMessages(searchOptions);
            // Process messages into context items
            const contextItems: ContextItem[] = [];
            for (const message of messages) {
                try {
                    const processedResult = await EmailProcessor.processMessage(message);
                    const contextItem = await this.transformToContextItem(processedResult);
                    contextItems.push(contextItem);
                } catch (error) {
                    console.warn(`Failed to process email ${message.id}:`, error);
                }
            }
            // Process threads if enabled
            if (this.options.processThreads) {
                const threads = await this.groupIntoThreads(messages);
                for (const thread of threads) {
                    if (thread.messages.length > 1) {
                        const threadContext = await this.transformThreadToContextItem(thread);
                        contextItems.push(threadContext);
                    }
                }
            }
            return {
                success: true,
                source: 'email',
                items: contextItems,
                total: contextItems.length,
                metadata: {
                    provider: this.connection.provider.type,
                    searchOptions,
                    messagesFound: messages.length,
                    threadsProcessed: this.options.processThreads
                }
            };
        } catch (error) {
            console.error('❌ Email Import Error:', error);
            return {
                success: false,
                source: 'email',
                error: (error as Error).message,
                items: [],
                total: 0
            };
        }
    }
    private async searchMessages(options: EmailSearchOptions): Promise<EmailMessage[]> {
        if (!this.connection) {
            throw new Error('No email connection available');
        }
        // This would implement actual email search based on provider
        // For now, return mock data
        return this.getMockMessages(options);
    }
    private async transformToContextItem(processedResult: any): Promise<ContextItem> {
        const { message, extractedText, attachments, metadata } = processedResult;
        const contextItem = await ContextProcessor.processContext(
            {
                messageId: message.messageId,
                subject: message.subject,
                body: extractedText,
                from: message.from,
                to: message.to,
                date: message.date,
                attachments: attachments,
                raw: message
            },
            'email',
            {
                title: message.subject,
                email_id: message.id,
                message_id: message.messageId,
                thread_id: message.threadId,
                from_address: message.from.address,
                from_name: message.from.name,
                to_addresses: message.to.map(addr => addr.address),
                date: message.date,
                folder: message.folder,
                has_attachments: attachments.length > 0,
                attachment_count: attachments.length,
                participant_count: metadata.participantCount,
                is_auto_reply: metadata.isAutoReply,
                is_newsletter: metadata.isNewsletter,
                priority: metadata.priority,
                classification: metadata.classification,
                domain: metadata.domain
            }
        );
        return contextItem;
    }
    private async transformThreadToContextItem(thread: EmailThread): Promise<ContextItem> {
        const allMessages = thread.messages.map(msg =>
            `From: ${msg.from.name || msg.from.address}\nDate: ${msg.date}\n\n${msg.body.text || msg.body.preview || ''}`
        ).join('\n\n---\n\n');
        const contextItem = await ContextProcessor.processContext(
            {
                threadId: thread.id,
                subject: thread.subject,
                messages: allMessages,
                messageCount: thread.messageCount,
                participants: thread.participants,
                raw: thread
            },
            'email',
            {
                title: `Thread: ${thread.subject}`,
                thread_id: thread.id,
                message_count: thread.messageCount,
                participant_count: thread.participants.length,
                first_message: thread.firstMessage,
                last_message: thread.lastMessage,
                folder: thread.folder,
                labels: thread.labels,
                is_thread: true
            }
        );
        return contextItem;
    }
    private async groupIntoThreads(messages: EmailMessage[]): Promise<EmailThread[]> {
        const threadMap = new Map<string, EmailMessage[]>();
        // Group by thread ID or subject
        for (const message of messages) {
            const threadKey = message.threadId || this.normalizeSubject(message.subject);
            if (!threadMap.has(threadKey)) {
                threadMap.set(threadKey, []);
            }
            threadMap.get(threadKey)!.push(message);
        }
        // Convert to thread objects
        const threads: EmailThread[] = [];
        for (const [threadId, threadMessages] of threadMap.entries()) {
            if (threadMessages.length > 1) {
                const thread: EmailThread = {
                    id: threadId,
                    subject: threadMessages[0].subject,
                    participants: this.getUniqueParticipants(threadMessages),
                    messageCount: threadMessages.length,
                    messages: threadMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
                    firstMessage: threadMessages[0].date,
                    lastMessage: threadMessages[threadMessages.length - 1].date,
                    folder: threadMessages[0].folder
                };
                threads.push(thread);
            }
        }
        return threads;
    }
    private getUniqueParticipants(messages: EmailMessage[]): any[] {
        const participantMap = new Map<string, any>();
        for (const message of messages) {
            participantMap.set(message.from.address, message.from);
            message.to.forEach(addr => participantMap.set(addr.address, addr));
            message.cc?.forEach(addr => participantMap.set(addr.address, addr));
        }
        return Array.from(participantMap.values());
    }
    private normalizeSubject(subject: string): string {
        return subject
            .replace(/^(re|fwd?):\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    private validateConfig(provider: EmailProvider, config: Record<string, any>): boolean {
        for (const field of provider.configFields) {
            if (field.required && (!config[field.key] || config[field.key].toString().trim() === '')) {
                return false;
            }
        }
        return true;
    }
    private async simulateConnectionTest(provider: EmailProvider, config: Record<string, any>): Promise<void> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Simulate potential failures
        if (config.username === 'fail@test.com') {
            throw new Error('Authentication failed');
        }
        if (config.host === 'invalid.server.com') {
            throw new Error('Server not found');
        }
    }
    private getMockMessages(options: EmailSearchOptions): EmailMessage[] {
        const mockMessages: EmailMessage[] = [
            {
                id: 'msg-1',
                messageId: '<msg1@example.com>',
                threadId: 'thread-1',
                subject: 'Project Update - Q4 Planning',
                from: { address: 'manager@company.com', name: 'John Manager' },
                to: [{ address: 'team@company.com', name: 'Development Team' }],
                date: '2024-01-15T10:30:00Z',
                body: {
                    text: 'Hi team,\\n\\nHere is the update on our Q4 planning. We need to finalize the roadmap by end of this week.\\n\\nBest regards,\\nJohn',
                    preview: 'Hi team, Here is the update on our Q4 planning...'
                },
                attachments: [],
                headers: {},
                flags: ['\\Seen'],
                folder: 'INBOX',
                importance: 'normal'
            },
            {
                id: 'msg-2',
                messageId: '<msg2@example.com>',
                threadId: 'thread-2',
                subject: 'Bug Report - Login Issue',
                from: { address: 'qa@company.com', name: 'QA Team' },
                to: [{ address: 'dev@company.com', name: 'Developers' }],
                date: '2024-01-15T14:45:00Z',
                body: {
                    text: 'Found a critical bug in the login system. Users cannot authenticate with special characters in passwords.\\n\\nSteps to reproduce:\\n1. Try to login with password containing @#$\\n2. System returns error\\n\\nPriority: High',
                    preview: 'Found a critical bug in the login system...'
                },
                attachments: [{
                    id: 'att-1',
                    filename: 'screenshot.png',
                    contentType: 'image/png',
                    size: 145000,
                    isInline: false
                }],
                headers: {},
                flags: ['\\Seen', '\\Flagged'],
                folder: 'INBOX',
                importance: 'high'
            }
        ];
        // Apply basic filtering
        let filtered = mockMessages;
        if (options.from) {
            filtered = filtered.filter(msg =>
                msg.from.address.toLowerCase().includes(options.from!.toLowerCase())
            );
        }
        if (options.subject) {
            filtered = filtered.filter(msg =>
                msg.subject.toLowerCase().includes(options.subject!.toLowerCase())
            );
        }
        if (options.hasAttachment) {
            filtered = filtered.filter(msg => msg.attachments.length > 0);
        }
        return filtered.slice(0, options.limit || 50);
    }
    disconnect(): void {
        this.connection = null;
    }
    getConnectionStatus(): EmailConnection | null {
        return this.connection;
    }
}