export interface EmailProvider {
    type: 'outlook' | 'gmail' | 'imap' | 'exchange';
    name: string;
    icon: string;
    authRequired: boolean;
    configFields: EmailConfigField[];
}
export interface EmailConfigField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'select';
    required: boolean;
    placeholder?: string;
    options?: string[];
    description?: string;
}
export interface EmailConnection {
    provider: EmailProvider;
    config: Record<string, any>;
    authenticated: boolean;
    lastTested?: string;
    error?: string;
}
export interface EmailMessage {
    id: string;
    messageId: string;
    threadId?: string;
    subject: string;
    from: EmailAddress;
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    date: string;
    body: EmailBody;
    attachments: EmailAttachment[];
    headers: Record<string, string>;
    flags: string[];
    folder?: string;
    importance?: 'low' | 'normal' | 'high';
}
export interface EmailAddress {
    address: string;
    name?: string;
}
export interface EmailBody {
    text?: string;
    html?: string;
    preview?: string;
}
export interface EmailAttachment {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    contentId?: string;
    isInline: boolean;
    data?: Buffer | string;
}
export interface EmailThread {
    id: string;
    subject: string;
    participants: EmailAddress[];
    messageCount: number;
    messages: EmailMessage[];
    firstMessage: string;
    lastMessage: string;
    folder?: string;
    labels?: string[];
}
export interface EmailSearchOptions {
    query?: string;
    folder?: string;
    from?: string;
    to?: string;
    subject?: string;
    dateFrom?: Date;
    dateTo?: Date;
    hasAttachment?: boolean;
    unread?: boolean;
    flagged?: boolean;
    limit?: number;
    offset?: number;
}
export interface EmailImportOptions {
    includeAttachments?: boolean;
    processThreads?: boolean;
    maxMessages?: number;
    maxAttachmentSize?: number; // in bytes
    folders?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
}
export interface EmailProcessingResult {
    message: EmailMessage;
    extractedText: string;
    attachments: ProcessedAttachment[];
    metadata: EmailMetadata;
}
export interface ProcessedAttachment {
    filename: string;
    contentType: string;
    size: number;
    extractedText?: string;
    thumbnailData?: string;
    isProcessable: boolean;
}
export interface EmailMetadata {
    threadLength: number;
    participantCount: number;
    domain: string;
    isAutoReply: boolean;
    isNewsletter: boolean;
    priority: 'low' | 'normal' | 'high';
    classification: EmailClassification;
}
export interface EmailClassification {
    category: 'business' | 'personal' | 'newsletter' | 'notification' | 'spam' | 'unknown';
    confidence: number;
    keywords: string[];
    sender_classification: 'internal' | 'external' | 'automated';
}
// Provider configurations
export const EMAIL_PROVIDERS: EmailProvider[] = [
    {
        type: 'outlook',
        name: 'Microsoft Outlook',
        icon: '📧',
        authRequired: true,
        configFields: [
            {
                key: 'clientId',
                label: 'Client ID',
                type: 'text',
                required: true,
                description: 'Azure App Registration Client ID'
            },
            {
                key: 'clientSecret',
                label: 'Client Secret',
                type: 'password',
                required: true,
                description: 'Azure App Registration Client Secret'
            },
            {
                key: 'tenantId',
                label: 'Tenant ID',
                type: 'text',
                required: true,
                description: 'Azure AD Tenant ID'
            }
        ]
    },
    {
        type: 'gmail',
        name: 'Gmail',
        icon: '📮',
        authRequired: true,
        configFields: [
            {
                key: 'clientId',
                label: 'Client ID',
                type: 'text',
                required: true,
                description: 'Google OAuth Client ID'
            },
            {
                key: 'clientSecret',
                label: 'Client Secret',
                type: 'password',
                required: true,
                description: 'Google OAuth Client Secret'
            }
        ]
    },
    {
        type: 'imap',
        name: 'IMAP',
        icon: '📨',
        authRequired: false,
        configFields: [
            {
                key: 'host',
                label: 'IMAP Server',
                type: 'text',
                required: true,
                placeholder: 'imap.example.com'
            },
            {
                key: 'port',
                label: 'Port',
                type: 'number',
                required: true,
                placeholder: '993'
            },
            {
                key: 'username',
                label: 'Username',
                type: 'text',
                required: true,
                placeholder: 'user@example.com'
            },
            {
                key: 'password',
                label: 'Password',
                type: 'password',
                required: true
            },
            {
                key: 'secure',
                label: 'Use SSL/TLS',
                type: 'select',
                required: true,
                options: ['true', 'false']
            }
        ]
    },
    {
        type: 'exchange',
        name: 'Exchange Server',
        icon: '🏢',
        authRequired: false,
        configFields: [
            {
                key: 'serverUrl',
                label: 'Exchange Server URL',
                type: 'text',
                required: true,
                placeholder: 'https://exchange.company.com'
            },
            {
                key: 'domain',
                label: 'Domain',
                type: 'text',
                required: true,
                placeholder: 'DOMAIN'
            },
            {
                key: 'username',
                label: 'Username',
                type: 'text',
                required: true
            },
            {
                key: 'password',
                label: 'Password',
                type: 'password',
                required: true
            }
        ]
    }
];
// Default search options
export const DEFAULT_EMAIL_SEARCH: EmailSearchOptions = {
    limit: 50,
    offset: 0,
    hasAttachment: false,
    unread: false,
    flagged: false
};
// Default import options
export const DEFAULT_EMAIL_IMPORT: EmailImportOptions = {
    includeAttachments: true,
    processThreads: true,
    maxMessages: 100,
    maxAttachmentSize: 10 * 1024 * 1024, // 10MB
    folders: ['INBOX']
};