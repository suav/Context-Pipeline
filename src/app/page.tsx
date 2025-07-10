/**
 * Context Import Pipeline - Main Page
 *
 * Universal context import system built on Next.js
 * Now features the new Workspace Workshop interface
 */
'use client';
import { WorkspaceWorkshop } from '@/features/workspace-workshop/components/WorkspaceWorkshop';
export default function ContextPipeline() {
    return <WorkspaceWorkshop />;
}