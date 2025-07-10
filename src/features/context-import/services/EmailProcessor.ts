import {
    EmailMessage,
    EmailThread,
    EmailProcessingResult,
    EmailMetadata,
    EmailClassification,
    ProcessedAttachment
} from '@/features/context-import/types/email-types';
export class EmailProcessor {
    static async processMessage(message: EmailMessage): Promise<EmailProcessingResult> {
        const extractedText = this.extractTextContent(message);
        const processedAttachments = await this.processAttachments(message.attachments);
        const metadata = this.generateMetadata(message);
        return {
            message,
            extractedText,
            attachments: processedAttachments,
            metadata
        };
    }
    static async processThread(thread: EmailThread): Promise<EmailProcessingResult[]> {
        const results: EmailProcessingResult[] = [];
        for (const message of thread.messages) {
            const result = await this.processMessage(message);
            results.push(result);
        }
        return results;
    }
    private static extractTextContent(message: EmailMessage): string {
        let content = '';
        // Prefer plain text, fall back to HTML
        if (message.body.text) {
            content = message.body.text;
        } else if (message.body.html) {
            content = this.stripHtml(message.body.html);
        } else if (message.body.preview) {
            content = message.body.preview;
        }
        // Clean up the content
        content = this.cleanEmailContent(content);
        return content;
    }
    private static stripHtml(html: string): string {
        // Remove HTML tags
        let text = html.replace(/<[^>]*>/g, ' ');
        // Decode common HTML entities
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' '
        };
        for (const [entity, char] of Object.entries(entities)) {
            text = text.replace(new RegExp(entity, 'g'), char);
        }
        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();
        return text;
    }
    private static cleanEmailContent(content: string): string {
        // Remove email signatures
        content = this.removeSignatures(content);
        // Remove quoted text
        content = this.removeQuotedText(content);
        // Remove excessive whitespace
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        content = content.replace(/[ \t]+/g, ' ');
        content = content.trim();
        return content;
    }
    private static removeSignatures(content: string): string {
        const signaturePatterns = [
            /^--\s*$/m,
            /^Best regards?[,.]?\s*$/mi,
            /^Kind regards?[,.]?\s*$/mi,
            /^Sincerely[,.]?\s*$/mi,
            /^Thank you[,.]?\s*$/mi,
            /^Thanks[,.]?\s*$/mi,
            /Sent from my \w+/i,
            /Get Outlook for \w+/i
        ];
        for (const pattern of signaturePatterns) {
            const match = content.match(pattern);
            if (match && match.index) {
                content = content.substring(0, match.index).trim();
                break;
            }
        }
        return content;
    }
    private static removeQuotedText(content: string): string {
        const quotedPatterns = [
            /^On .* wrote:$/m,
            /^From: .*$/m,
            /^Sent: .*$/m,
            /^To: .*$/m,
            /^Subject: .*$/m,
            /^> .*/gm,
            /^\| .*/gm
        ];
        for (const pattern of quotedPatterns) {
            const match = content.match(pattern);
            if (match && match.index) {
                content = content.substring(0, match.index).trim();
                break;
            }
        }
        return content;
    }
    private static async processAttachments(attachments: any[]): Promise<ProcessedAttachment[]> {
        const processed: ProcessedAttachment[] = [];
        for (const attachment of attachments) {
            const processedAttachment: ProcessedAttachment = {
                filename: attachment.filename,
                contentType: attachment.contentType,
                size: attachment.size,
                isProcessable: this.isProcessableAttachment(attachment)
            };
            // Extract text from processable attachments
            if (processedAttachment.isProcessable) {
                processedAttachment.extractedText = await this.extractAttachmentText(attachment);
            }
            // Generate thumbnail for images
            if (attachment.contentType.startsWith('image/')) {
                processedAttachment.thumbnailData = await this.generateThumbnail(attachment);
            }
            processed.push(processedAttachment);
        }
        return processed;
    }
    private static isProcessableAttachment(attachment: any): boolean {
        const processableTypes = [
            'text/plain',
            'text/html',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        return processableTypes.includes(attachment.contentType);
    }
    private static async extractAttachmentText(attachment: any): Promise<string> {
        // This would use libraries like pdf-parse, mammoth, etc.
        // For now, return a placeholder
        return `[Text extraction from ${attachment.filename} would be implemented here]`;
    }
    private static async generateThumbnail(attachment: any): Promise<string> {
        // This would use image processing libraries
        // For now, return a placeholder
        return `[Thumbnail for ${attachment.filename} would be generated here]`;
    }
    private static generateMetadata(message: EmailMessage): EmailMetadata {
        const domain = this.extractDomain(message.from.address);
        const classification = this.classifyEmail(message);
        return {
            threadLength: 1, // Would be calculated from thread context
            participantCount: this.countParticipants(message),
            domain: domain,
            isAutoReply: this.isAutoReply(message),
            isNewsletter: this.isNewsletter(message),
            priority: this.determinePriority(message),
            classification: classification
        };
    }
    private static extractDomain(email: string): string {
        const match = email.match(/@(.+)$/);
        return match ? match[1].toLowerCase() : '';
    }
    private static countParticipants(message: EmailMessage): number {
        const participants = new Set<string>();
        participants.add(message.from.address);
        message.to.forEach(addr => participants.add(addr.address));
        message.cc?.forEach(addr => participants.add(addr.address));
        return participants.size;
    }
    private static isAutoReply(message: EmailMessage): boolean {
        const autoReplyIndicators = [
            'auto-reply',
            'automatic reply',
            'out of office',
            'vacation',
            'away',
            'do not reply'
        ];
        const subject = message.subject.toLowerCase();
        const body = (message.body.text || message.body.preview || '').toLowerCase();
        return autoReplyIndicators.some(indicator =>
            subject.includes(indicator) || body.includes(indicator)
        );
    }
    private static isNewsletter(message: EmailMessage): boolean {
        const newsletterIndicators = [
            'newsletter',
            'unsubscribe',
            'marketing',
            'promotional',
            'no-reply@',
            'noreply@'
        ];
        const fromAddress = message.from.address.toLowerCase();
        const subject = message.subject.toLowerCase();
        const body = (message.body.text || message.body.preview || '').toLowerCase();
        return newsletterIndicators.some(indicator =>
            fromAddress.includes(indicator) ||
            subject.includes(indicator) ||
            body.includes(indicator)
        );
    }
    private static determinePriority(message: EmailMessage): 'low' | 'normal' | 'high' {
        // Check importance header
        if (message.importance) {
            return message.importance;
        }
        // Check subject for priority indicators
        const subject = message.subject.toLowerCase();
        const highPriorityKeywords = ['urgent', 'asap', 'important', 'critical', 'emergency'];
        const lowPriorityKeywords = ['fyi', 'info', 'newsletter', 'update'];
        if (highPriorityKeywords.some(keyword => subject.includes(keyword))) {
            return 'high';
        }
        if (lowPriorityKeywords.some(keyword => subject.includes(keyword))) {
            return 'low';
        }
        return 'normal';
    }
    private static classifyEmail(message: EmailMessage): EmailClassification {
        const subject = message.subject.toLowerCase();
        const body = (message.body.text || message.body.preview || '').toLowerCase();
        const content = `${subject} ${body}`;
        // Business keywords
        const businessKeywords = ['meeting', 'project', 'deadline', 'budget', 'proposal', 'contract'];
        const personalKeywords = ['lunch', 'dinner', 'weekend', 'family', 'friend'];
        const notificationKeywords = ['notification', 'alert', 'reminder', 'update', 'status'];
        let category: EmailClassification['category'] = 'unknown';
        let confidence = 0;
        const keywords: string[] = [];
        // Calculate scores for each category
        const businessScore = this.calculateKeywordScore(content, businessKeywords);
        const personalScore = this.calculateKeywordScore(content, personalKeywords);
        const notificationScore = this.calculateKeywordScore(content, notificationKeywords);
        // Determine category
        if (this.isNewsletter(message)) {
            category = 'newsletter';
            confidence = 0.8;
        } else if (businessScore > personalScore && businessScore > notificationScore) {
            category = 'business';
            confidence = Math.min(businessScore / 10, 0.9);
            keywords.push(...businessKeywords.filter(kw => content.includes(kw)));
        } else if (personalScore > notificationScore) {
            category = 'personal';
            confidence = Math.min(personalScore / 5, 0.8);
            keywords.push(...personalKeywords.filter(kw => content.includes(kw)));
        } else if (notificationScore > 0) {
            category = 'notification';
            confidence = Math.min(notificationScore / 5, 0.7);
            keywords.push(...notificationKeywords.filter(kw => content.includes(kw)));
        }
        // Determine sender classification
        const domain = this.extractDomain(message.from.address);
        const senderClassification = this.classifySender(domain, message.from.address);
        return {
            category,
            confidence,
            keywords,
            sender_classification: senderClassification
        };
    }
    private static calculateKeywordScore(content: string, keywords: string[]): number {
        return keywords.reduce((score, keyword) => {
            const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
            return score + matches;
        }, 0);
    }
    private static classifySender(domain: string, email: string): 'internal' | 'external' | 'automated' {
        // This would be configured based on organization domains
        const internalDomains = ['company.com', 'organization.org']; // Would be configurable
        if (internalDomains.some(d => domain.includes(d))) {
            return 'internal';
        }
        if (email.includes('noreply') || email.includes('no-reply') || email.includes('auto')) {
            return 'automated';
        }
        return 'external';
    }
}