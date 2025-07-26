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
        const { searchParams } = new URL(request.url);
        const credentialId = searchParams.get('credentialId');
        // Validate source
        const validSources: ContextSource[] = ['jira', 'email', 'slack', 'git', 'file'];
        if (!validSources.includes(sourceType)) {
            return NextResponse.json({
                success: false,
                error: `Invalid source type: ${source}`
            }, { status: 400 });
        }
        // For git sources with credentials, customize templates with repository info
        let repoInfo = null;
        if (sourceType === 'git' && credentialId) {
            try {
                const credentialResponse = await fetch(`${request.nextUrl.origin}/api/credentials/${credentialId}`);
                if (credentialResponse.ok) {
                    const credentialData = await credentialResponse.json();
                    const repoUrl = credentialData.fields?.repoUrl;
                    if (repoUrl) {
                        // Extract repo info from URL
                        const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                        if (match) {
                            repoInfo = { owner: match[1], repo: match[2], repoUrl };
                            console.log('🔗 Git credential loaded for queries:', repoInfo);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load git credential for queries:', error);
            }
        }

        const templates = {
            popular: getPopularTemplates(sourceType, repoInfo),
            all: getTemplatesForSource(sourceType, repoInfo),
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