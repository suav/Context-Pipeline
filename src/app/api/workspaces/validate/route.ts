/**
 * Workspace Validation API Route
 * Validates workspace integrity and handles check engine warnings
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { validateWorkspace, validateAllWorkspaces, moveWorkspaceToDrafts } from '../../../../features/workspaces/utils/workspaceValidator';

const WORKSPACE_BASE_DIR = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspaceId');
        
        if (workspaceId) {
            // Validate specific workspace
            const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
            const validation = await validateWorkspace(workspacePath);
            
            return NextResponse.json({
                success: true,
                workspace_id: workspaceId,
                validation
            });
        } else {
            // Validate all workspaces
            const results = await validateAllWorkspaces(WORKSPACE_BASE_DIR);
            
            return NextResponse.json({
                success: true,
                summary: {
                    total: results.total,
                    valid: results.valid.length,
                    invalid: results.invalid.length
                },
                valid_workspaces: results.valid,
                invalid_workspaces: results.invalid
            });
        }
        
    } catch (error) {
        console.error('Workspace validation failed:', error);
        return NextResponse.json(
            { 
                success: false,
                error: `Validation failed: ${(error as Error).message}` 
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, workspaceId } = body;
        
        switch (action) {
            case 'move_to_drafts':
                if (!workspaceId) {
                    return NextResponse.json(
                        { error: 'Workspace ID is required' },
                        { status: 400 }
                    );
                }
                
                const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
                const validation = await validateWorkspace(workspacePath);
                
                if (validation.isValid) {
                    return NextResponse.json(
                        { error: 'Workspace is valid, no need to move to drafts' },
                        { status: 400 }
                    );
                }
                
                const result = await moveWorkspaceToDrafts(workspacePath, workspaceId, validation);
                
                if (result.success) {
                    return NextResponse.json({
                        success: true,
                        message: `Workspace moved to drafts with rebuild warning`,
                        draft_id: result.draftId,
                        validation_issues: validation.issues
                    });
                } else {
                    return NextResponse.json(
                        { error: result.error },
                        { status: 500 }
                    );
                }
                
            case 'validate_and_fix':
                // Future: Implement auto-fix for common issues
                return NextResponse.json(
                    { error: 'Auto-fix not yet implemented' },
                    { status: 501 }
                );
                
            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }
        
    } catch (error) {
        console.error('Workspace validation action failed:', error);
        return NextResponse.json(
            { 
                success: false,
                error: `Action failed: ${(error as Error).message}` 
            },
            { status: 500 }
        );
    }
}