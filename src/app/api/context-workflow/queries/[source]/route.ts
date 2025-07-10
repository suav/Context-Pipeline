import { NextRequest, NextResponse } from 'next/server';
import { getTemplatesForSource, getPopularTemplates, getCategoriesForSource } from '@/features/context-import/queries/query-templates';
import { ContextSource } from '@/features/context-import/types';
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ source: string }> }
) {
    try {
        const { source } = await params;
        const sourceType = source as ContextSource;
        // Validate source
        const validSources: ContextSource[] = ['jira', 'email', 'slack', 'git', 'file'];
        if (!validSources.includes(sourceType)) {
            return NextResponse.json({
                success: false,
                error: `Invalid source type: ${source}`
            }, { status: 400 });
        }
        const templates = {
            popular: getPopularTemplates(sourceType),
            all: getTemplatesForSource(sourceType),
            categories: getCategoriesForSource(sourceType)
        };
        const custom: any[] = [];
        return NextResponse.json({
            success: true,
            source: sourceType,
            queries: {
                templates,
                custom,
                total: templates.all.length + custom.length
            }
        });
    } catch (error) {
        console.error('Get queries error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get queries'
        }, { status: 500 });
    }
}