import { ContextItem, ImportResult } from '@/features/context-import/types';
import { ContextProcessor } from '@/lib/context-processor';
export interface FileImportOptions {
    maxFileSize?: number; // in bytes
    allowedTypes?: string[];
    extractMetadata?: boolean;
}
export class FileImporter {
    private readonly defaultOptions: FileImportOptions = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
            'text/plain',
            'text/markdown',
            'text/csv',
            'application/json',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream', // Many text files get detected as this
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ],
        extractMetadata: true
    };
    constructor(private options: FileImportOptions = {}) {
        this.options = { ...this.defaultOptions, ...options };
    }
    async import(files: File[]): Promise<ImportResult> {
        try {
            const results: ContextItem[] = [];
            const errors: string[] = [];
            for (const file of files) {
                try {
                    const contextItem = await this.processFile(file);
                    results.push(contextItem);
                } catch (error) {
                    console.error(`Failed to process file ${file.name}:`, error);
                    errors.push(`${file.name}: ${(error as Error).message}`);
                }
            }
            return {
                success: true,
                source: 'file',
                items: results,
                total: results.length,
                metadata: {
                    processed: results.length,
                    errors: errors.length > 0 ? errors : undefined
                }
            };
        } catch (error) {
            return {
                success: false,
                source: 'file',
                error: `File import failed: ${(error as Error).message}`,
                items: [],
                total: 0
            };
        }
    }
    async processFile(file: File): Promise<ContextItem> {
        // Validate file
        this.validateFile(file);
        // Determine file type and process accordingly
        const fileType = this.getFileType(file);
        let content: any;
        let metadata: Record<string, any> = {};
        switch (fileType) {
            case 'text':
                content = await this.processTextFile(file);
                break;
            case 'document':
                content = await this.processDocumentFile(file);
                break;
            case 'image':
                content = await this.processImageFile(file);
                break;
            default:
                throw new Error(`Unsupported file type: ${file.type}`);
        }
        // Extract metadata
        if (this.options.extractMetadata) {
            metadata = await this.extractFileMetadata(file);
        }
        // Create context item using the processor
        const contextItem = await ContextProcessor.processContext(
            content,
            'file',
            {
                ...metadata,
                filename: file.name,
                file_type: fileType,
                mime_type: file.type,
                file_size: file.size,
                title: this.generateTitle(file)
            }
        );
        return contextItem;
    }
    async processTextFile(file: File): Promise<any> {
        const text = await file.text();
        // Parse JSON if it's a JSON file
        if (file.type === 'application/json') {
            try {
                return {
                    raw_text: text,
                    parsed_json: JSON.parse(text),
                    content_type: 'json'
                };
            } catch (error) {
                return {
                    raw_text: text,
                    content_type: 'text',
                    parse_error: 'Invalid JSON format'
                };
            }
        }
        // Handle markdown
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
            return {
                raw_text: text,
                content_type: 'markdown',
                // Extract markdown headers for structure
                headers: this.extractMarkdownHeaders(text)
            };
        }
        // Plain text
        return {
            raw_text: text,
            content_type: 'text'
        };
    }
    async processDocumentFile(file: File): Promise<any> {
        // For now, store the file info and indicate that text extraction is needed
        // In a full implementation, you'd use libraries like pdf-parse or mammoth
        return {
            filename: file.name,
            content_type: 'document',
            mime_type: file.type,
            size: file.size,
            extraction_needed: true,
            note: 'Document text extraction requires additional processing'
        };
    }
    async processImageFile(file: File): Promise<any> {
        // Convert image to base64 for storage
        const base64 = await this.fileToBase64(file);
        return {
            filename: file.name,
            content_type: 'image',
            mime_type: file.type,
            size: file.size,
            base64_data: base64,
            // Image dimensions would be extracted in a full implementation
            note: 'Image processing and OCR capabilities can be added'
        };
    }
    private async extractFileMetadata(file: File): Promise<Record<string, any>> {
        return {
            filename: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified).toISOString(),
            // Add more metadata extraction as needed
        };
    }
    private validateFile(file: File): void {
        if (file.size > this.options.maxFileSize!) {
            throw new Error(`File size exceeds limit: ${file.size} bytes`);
        }
        if (this.options.allowedTypes && !this.options.allowedTypes.includes(file.type)) {
            throw new Error(`File type not allowed: ${file.type}`);
        }
    }
    private getFileType(file: File): 'text' | 'document' | 'image' {
        // Check MIME type first
        if (file.type.startsWith('text/') || file.type === 'application/json') {
            return 'text';
        }
        if (file.type.startsWith('image/')) {
            return 'image';
        }
        if (file.type === 'application/pdf' ||
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return 'document';
        }
        
        // Fallback to file extension for application/octet-stream and unknown types
        if (file.type === 'application/octet-stream' || file.type === '') {
            const extension = file.name.toLowerCase().split('.').pop();
            
            // Text file extensions
            if (['md', 'markdown', 'txt', 'json', 'csv', 'xml', 'yaml', 'yml', 'js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'sass', 'html', 'htm', 'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'sql', 'go', 'rs', 'swift', 'kt', 'scala', 'clj', 'r', 'pl', 'vue', 'svelte', 'astro', 'config', 'conf', 'ini', 'cfg', 'env', 'log', 'gitignore', 'gitkeep', 'dockerfile', 'makefile', 'readme', 'license', 'changelog', 'todo', 'notes'].includes(extension || '')) {
                return 'text';
            }
            
            // Image file extensions
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'].includes(extension || '')) {
                return 'image';
            }
            
            // Document file extensions
            if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension || '')) {
                return 'document';
            }
        }
        
        throw new Error(`Unsupported file type: ${file.type}`);
    }
    private generateTitle(file: File): string {
        const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        return `File: ${name}`;
    }
    private extractMarkdownHeaders(text: string): Array<{level: number, text: string}> {
        const headers: Array<{level: number, text: string}> = [];
        const lines = text.split('\n');
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
    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // Remove data URL prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}