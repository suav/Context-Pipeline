import { NextRequest, NextResponse } from 'next/server';
import { JiraImporter } from '@/features/context-import/importers/JiraImporter';
import { GitImporter } from '@/features/context-import/importers/GitImporter';
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { source, searchParams, credentialId } = body;
        console.log('🚀 Import Request:', { source, searchParams, credentialId });
        let result;
        switch (source) {
            case 'jira':
                try {
                    const jiraImporter = new JiraImporter();
                    result = await jiraImporter.search(searchParams);
                } catch (error) {
                    console.error('❌ JIRA Import Error:', error);
                    result = {
                        success: false,
                        source: 'jira',
                        error: `JIRA configuration error: ${(error as Error).message}`,
                        items: [],
                        total: 0
                    };
                }
                break;
            case 'git':
                try {
                    // Load credential if provided
                    let credentials = {};
                    if (credentialId) {
                        const credentialResponse = await fetch(`${request.nextUrl.origin}/api/credentials/${credentialId}`);
                        if (credentialResponse.ok) {
                            const credentialData = await credentialResponse.json();
                            // Extract fields from the credential object
                            credentials = credentialData.credential?.fields || credentialData.fields || {};
                            console.log('🔑 Using credential for git import:', { 
                                credentialId, 
                                credentials,
                                repoUrl: credentials.repoUrl 
                            });
                        } else {
                            console.error('Failed to load credential:', credentialId);
                        }
                    }
                    const gitImporter = new GitImporter(credentials);
                    result = await gitImporter.search(searchParams);
                } catch (error) {
                    console.error('❌ Git Import Error:', error);
                    result = {
                        success: false,
                        source: 'git',
                        error: `Git configuration error: ${(error as Error).message}`,
                        items: [],
                        total: 0
                    };
                }
                break;
            case 'email':
                // Mock for now - would implement EmailImporter later
                result = {
                    success: false,
                    source: 'email',
                    error: 'Email import not yet implemented',
                    items: [],
                    total: 0
                };
                break;
            case 'slack':
                // Mock for now - would implement SlackImporter later
                result = {
                    success: false,
                    source: 'slack',
                    error: 'Slack import not yet implemented',
                    items: [],
                    total: 0
                };
                break;
            case 'file':
                // Redirect to file import endpoint
                return NextResponse.json(
                    { error: 'File imports should use /api/context-workflow/import/file endpoint' },
                    { status: 400 }
                );
            default:
                return NextResponse.json(
                    { error: `Unsupported source: ${source}` },
                    { status: 400 }
                );
        }
        console.log('✅ Import Result:', {
            source: result.source,
            success: result.success,
            total: result.total,
            itemCount: result.items.length
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('❌ Import API Error:', error);
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
export async function GET() {
    return NextResponse.json({
        message: 'Context Import API',
        endpoints: {
            'POST /api/context-workflow/import': 'Execute import query',
            'GET /api/context-workflow/queries/{source}': 'Get query templates for source'
        },
        supportedSources: ['jira', 'git', 'email', 'slack']
    });
}