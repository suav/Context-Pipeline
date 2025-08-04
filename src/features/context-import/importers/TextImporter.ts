import { ContextItem, ImportResult } from '@/features/context-import/types';
import { ContextProcessor } from '@/lib/context-processor';
export interface TextImportOptions {
    maxLength?: number;
    autoDetectFormat?: boolean;
    extractMetadata?: boolean;
    splitLongText?: boolean;
    chunkSize?: number;
}
export interface TextInput {
    content: string;
    title?: string;
    description?: string;
    tags?: string[];
    format?: 'plain' | 'markdown' | 'json' | 'code' | 'auto';
}
export class TextImporter {
    private readonly defaultOptions: TextImportOptions = {
        maxLength: 1000000, // 1MB of text
        autoDetectFormat: true,
        extractMetadata: true,
        splitLongText: true,
        chunkSize: 50000 // 50KB chunks
    };
    constructor(private options: TextImportOptions = {}) {
        this.options = { ...this.defaultOptions, ...options };
    }
    async import(input: TextInput): Promise<ImportResult> {
        try {
            const contextItems = await this.processText(input);
            return {
                success: true,
                source: 'file',
                items: contextItems,
                total: contextItems.length,
                metadata: {
                    input_length: input.content.length,
                    detected_format: this.detectFormat(input.content),
                    chunks: contextItems.length
                }
            };
        } catch (error) {
            return {
                success: false,
                source: 'file',
                error: `Text import failed: ${(error as Error).message}`,
                items: [],
                total: 0
            };
        }
    }
    private async processText(input: TextInput): Promise<ContextItem[]> {
        // Validate input
        this.validateInput(input);
        // Detect format if auto-detection is enabled
        let format = input.format || 'plain';
        if (this.options.autoDetectFormat && format === 'auto') {
            format = this.detectFormat(input.content);
        }
        // Process based on format
        let processedContent: any;
        switch (format) {
            case 'json':
                processedContent = this.processJsonText(input.content);
                break;
            case 'markdown':
                processedContent = this.processMarkdownText(input.content);
                break;
            case 'code':
                processedContent = this.processCodeText(input.content);
                break;
            default:
                processedContent = this.processPlainText(input.content);
        }
        // Split long text if needed
        if (this.options.splitLongText && input.content.length > this.options.chunkSize!) {
            return this.splitIntoChunks(input, processedContent, format);
        }
        // Create single context item
        const contextItem = await ContextProcessor.processContext(
            processedContent,
            'file',
            {
                title: input.title || this.generateTitle(input.content, format),
                description: input.description || this.generateDescription(format),
                tags: input.tags || [],
                format: format,
                input_type: 'direct_text',
                character_count: input.content.length,
                word_count: this.countWords(input.content),
                line_count: input.content.split('\n').length
            }
        );
        return [contextItem];
    }
    private async splitIntoChunks(
        input: TextInput,
        processedContent: any,
        format: string
    ): Promise<ContextItem[]> {
        const chunks = this.splitText(input.content, this.options.chunkSize!);
        const contextItems: ContextItem[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkContent = { ...processedContent, raw_text: chunk };
            const contextItem = await ContextProcessor.processContext(
                chunkContent,
                'file',
                {
                    title: `${input.title || 'Text Import'} (Part ${i + 1}/${chunks.length})`,
                    description: input.description || this.generateDescription(format),
                    tags: [...(input.tags || []), 'chunk', `part-${i + 1}`],
                    format: format,
                    input_type: 'direct_text_chunk',
                    chunk_index: i,
                    total_chunks: chunks.length,
                    character_count: chunk.length,
                    word_count: this.countWords(chunk),
                    line_count: chunk.split('\n').length
                }
            );
            contextItems.push(contextItem);
        }
        return contextItems;
    }
    private processJsonText(content: string): any {
        try {
            const parsed = JSON.parse(content);
            return {
                raw_text: content,
                parsed_json: parsed,
                content_type: 'json',
                structure: this.analyzeJsonStructure(parsed)
            };
        } catch (error) {
            return {
                raw_text: content,
                content_type: 'text',
                parse_error: 'Invalid JSON format',
                error_message: (error as Error).message
            };
        }
    }
    private processMarkdownText(content: string): any {
        const headers = this.extractMarkdownHeaders(content);
        const links = this.extractMarkdownLinks(content);
        const codeBlocks = this.extractCodeBlocks(content);
        return {
            raw_text: content,
            content_type: 'markdown',
            headers: headers,
            links: links,
            code_blocks: codeBlocks,
            structure: {
                header_count: headers.length,
                link_count: links.length,
                code_block_count: codeBlocks.length
            }
        };
    }
    private processCodeText(content: string): any {
        const language = this.detectCodeLanguage(content);
        const functions = this.extractFunctions(content);
        const imports = this.extractImports(content);
        return {
            raw_text: content,
            content_type: 'code',
            detected_language: language,
            functions: functions,
            imports: imports,
            structure: {
                function_count: functions.length,
                import_count: imports.length,
                line_count: content.split('\n').length
            }
        };
    }
    private processPlainText(content: string): any {
        return {
            raw_text: content,
            content_type: 'text',
            structure: {
                paragraph_count: content.split('\n\n').length,
                sentence_count: content.split(/[.!?]+/).length - 1,
                word_count: this.countWords(content)
            }
        };
    }
    private detectFormat(content: string): 'plain' | 'markdown' | 'json' | 'code' {
        // Try JSON first
        try {
            JSON.parse(content);
            return 'json';
        } catch {}
        // Check for markdown patterns
        if (content.includes('# ') || content.includes('## ') ||
            content.includes('**') || content.includes('```')) {
            return 'markdown';
        }
        // Check for code patterns
        if (content.includes('function ') || content.includes('import ') ||
            content.includes('class ') || content.includes('def ') ||
            content.includes('const ') || content.includes('var ')) {
            return 'code';
        }
        return 'plain';
    }
    private validateInput(input: TextInput): void {
        if (!input.content || input.content.trim().length === 0) {
            throw new Error('Text content cannot be empty');
        }
        if (input.content.length > this.options.maxLength!) {
            throw new Error(`Text exceeds maximum length: ${input.content.length} characters`);
        }
    }
    private generateTitle(content: string, format: string): string {
        const firstLine = content.split('\n')[0].trim();
        if (format === 'markdown') {
            const match = firstLine.match(/^#+\s+(.+)$/);
            if (match) return match[1];
        }
        if (firstLine.length > 50) {
            return firstLine.substring(0, 50) + '...';
        }
        return firstLine || `${format.charAt(0).toUpperCase() + format.slice(1)} Import`;
    }
    private generateDescription(format: string): string {
        const descriptions: Record<string, string> = {
            'plain': 'Plain text content imported directly',
            'markdown': 'Markdown document with formatting and structure',
            'json': 'JSON data structure with parsed content',
            'code': 'Code snippet with syntax analysis'
        };
        return descriptions[format] || 'Text content imported directly';
    }
    private splitText(content: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        let currentChunk = '';
        const lines = content.split('\n');
        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = line;
            } else {
                currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
            }
        }
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
    private extractMarkdownHeaders(content: string): Array<{level: number, text: string}> {
        const headers: Array<{level: number, text: string}> = [];
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                headers.push({
                    level: match[1].length,
                    text: match[2].trim()
                });
            }
        }
        return headers;
    }
    private extractMarkdownLinks(content: string): Array<{text: string, url: string}> {
        const links: Array<{text: string, url: string}> = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            links.push({
                text: match[1],
                url: match[2]
            });
        }
        return links;
    }
    private extractCodeBlocks(content: string): Array<{language: string, code: string}> {
        const blocks: Array<{language: string, code: string}> = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }
        return blocks;
    }
    private detectCodeLanguage(content: string): string {
        const patterns: Record<string, RegExp[]> = {
            'javascript': [/function\s+\w+/, /const\s+\w+\s*=/, /import\s+.*from/],
            'python': [/def\s+\w+/, /import\s+\w+/, /from\s+\w+\s+import/],
            'java': [/public\s+class/, /public\s+static\s+void/, /import\s+java\./],
            'typescript': [/interface\s+\w+/, /type\s+\w+\s*=/, /import\s+.*from.*\.ts/],
            'css': [/\.\w+\s*\{/, /@media/, /color:/],
            'html': [/<html/, /<div/, /<script/],
            'sql': [/SELECT\s+/, /FROM\s+/, /WHERE\s+/i]
        };
        for (const [language, regexes] of Object.entries(patterns)) {
            if (regexes.some(regex => regex.test(content))) {
                return language;
            }
        }
        return 'text';
    }
    private extractFunctions(content: string): string[] {
        const functions: string[] = [];
        const patterns = [
            /function\s+(\w+)/g,
            /def\s+(\w+)/g,
            /const\s+(\w+)\s*=\s*\(/g,
            /(\w+)\s*:\s*\(/g
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                functions.push(match[1]);
            }
        }
        return [...new Set(functions)];
    }
    private extractImports(content: string): string[] {
        const imports: string[] = [];
        const patterns = [
            /import\s+.*from\s+['"](.*)['"]/g,
            /import\s+['"](.*)['"];/g,
            /from\s+(\w+)\s+import/g,
            /#include\s+<(.*)>/g
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                imports.push(match[1]);
            }
        }
        return [...new Set(imports)];
    }
    private countWords(text: string): number {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    private analyzeJsonStructure(obj: any): any {
        if (Array.isArray(obj)) {
            return {
                type: 'array',
                length: obj.length,
                item_types: [...new Set(obj.map(item => typeof item))]
            };
        }
        if (typeof obj === 'object' && obj !== null) {
            const keys = Object.keys(obj);
            return {
                type: 'object',
                key_count: keys.length,
                keys: keys,
                value_types: [...new Set(keys.map(key => typeof obj[key]))]
            };
        }
        return {
            type: typeof obj,
            value: obj
        };
    }
}