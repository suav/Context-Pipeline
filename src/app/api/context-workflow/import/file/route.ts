import { NextRequest, NextResponse } from 'next/server';
import { FileImporter } from '@/features/context-import/importers/FileImporter';
import { TextImporter } from '@/features/context-import/importers/TextImporter';
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type');
        // Handle multipart/form-data (file uploads)
        if (contentType?.includes('multipart/form-data')) {
            return await handleFileUpload(request);
        }
        // Handle JSON (text imports)
        if (contentType?.includes('application/json')) {
            return await handleTextImport(request);
        }
        return NextResponse.json(
            { error: 'Unsupported content type' },
            { status: 400 }
        );
    } catch (error) {
        console.error('❌ File Import API Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: `Server error: ${(error as Error).message}`,
                items: [],
                total: 0
            },
            { status: 500 }
        );
    }
}
async function handleFileUpload(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files: File[] = [];
        // Extract files from form data
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                files.push(value);
            }
        }
        if (files.length === 0) {
            return NextResponse.json(
                { error: 'No files provided' },
                { status: 400 }
            );
        }
        console.log('🚀 File Upload Request:', {
            fileCount: files.length,
            files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
        });
        // Process files with FileImporter
        const fileImporter = new FileImporter();
        const result = await fileImporter.import(files);
        console.log('✅ File Import Result:', {
            success: result.success,
            total: result.total,
            itemCount: result.items.length
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('❌ File Upload Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: `File upload failed: ${(error as Error).message}`,
                items: [],
                total: 0
            },
            { status: 500 }
        );
    }
}
async function handleTextImport(request: NextRequest) {
    try {
        const body = await request.json();
        const { content, title, description, tags, format } = body;
        if (!content || content.trim().length === 0) {
            return NextResponse.json(
                { error: 'Text content is required' },
                { status: 400 }
            );
        }
        console.log('🚀 Text Import Request:', {
            contentLength: content.length,
            title: title || 'No title',
            format: format || 'auto'
        });
        // Process text with TextImporter
        const textImporter = new TextImporter();
        const result = await textImporter.import({
            content,
            title,
            description,
            tags,
            format: format || 'auto'
        });
        console.log('✅ Text Import Result:', {
            success: result.success,
            total: result.total,
            itemCount: result.items.length
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('❌ Text Import Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: `Text import failed: ${(error as Error).message}`,
                items: [],
                total: 0
            },
            { status: 500 }
        );
    }
}
export async function GET() {
    return NextResponse.json({
        message: 'File and Text Import API',
        endpoints: {
            'POST /api/context-workflow/import/file (multipart/form-data)': 'Upload files for import',
            'POST /api/context-workflow/import/file (application/json)': 'Import text content directly'
        },
        supportedFileTypes: [
            'text/plain',
            'text/markdown',
            'application/json',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ],
        supportedTextFormats: ['plain', 'markdown', 'json', 'code', 'auto'],
        limits: {
            maxFileSize: '10MB',
            maxTextLength: '1MB',
            maxFiles: 'unlimited'
        }
    });
}