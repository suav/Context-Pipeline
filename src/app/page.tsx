/**
 * Context Import Pipeline - Main Page
 * 
 * Universal context import system built on Next.js
 */

'use client';

import { useState, useEffect } from 'react';
import { STAGE_CONFIG, SOURCE_CONFIG } from '@/features/context-import/types';
import { LibraryStage as NewLibraryStage } from '@/features/context-library/components/LibraryStage';
import { WorkspaceStage as NewWorkspaceStage } from '@/features/workspaces/components/WorkspaceStage';
import { ThemeSelector } from '@/components/ThemeSelector';
import { CredentialsManager } from '@/components/CredentialsManager';

export default function ContextPipeline() {
    const [currentStage, setCurrentStage] = useState('library');
    const [apiHealth, setApiHealth] = useState<string>('checking...');
    const [showCredentials, setShowCredentials] = useState(false);

    // Test API connection
    useEffect(() => {
        const testAPI = async () => {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                setApiHealth(`✅ ${data.pipeline}`);
            } catch {
                setApiHealth('❌ API not available');
            }
        };
        
        testAPI();
    }, []);

    return (
        <div 
            className="min-h-screen p-4 transition-colors"
            style={{ backgroundColor: 'var(--color-background)' }}
        >
            <div className="max-w-6xl mx-auto">
                {/* Compact Header with Inline Stages */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 
                            className="text-2xl font-bold mb-1"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            🗃️ Context Import Pipeline v2
                        </h1>
                        <div className="flex items-center gap-4 text-sm">
                            <span style={{ color: 'var(--color-text-secondary)' }}>
                                Universal context import system - UPDATED
                            </span>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                                API: {apiHealth}
                            </span>
                        </div>
                    </div>
                    
                    {/* Theme Selector, Credentials, and Stage Navigation */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowCredentials(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm"
                            style={{
                                backgroundColor: 'var(--color-surface)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            <span>🔐</span>
                            <span>Credentials</span>
                        </button>
                        
                        <ThemeSelector compact />
                        
                        {/* Inline Stage Navigation */}
                        <div className="flex gap-2 overflow-x-auto">
                            {STAGE_CONFIG.map(stage => (
                                <button
                                    key={stage.key}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors text-sm ${
                                        currentStage === stage.key ? 'active-stage' : 'inactive-stage'
                                    }`}
                                    style={{
                                        backgroundColor: currentStage === stage.key 
                                            ? 'var(--color-primary)' 
                                            : 'var(--color-surface)',
                                        color: currentStage === stage.key 
                                            ? 'var(--color-text-inverse)' 
                                            : 'var(--color-text-primary)',
                                        borderColor: 'var(--color-border)',
                                        ...(currentStage !== stage.key && {
                                            border: '1px solid var(--color-border)'
                                        })
                                    }}
                                    onClick={() => setCurrentStage(stage.key)}
                                >
                                    <span>{stage.icon}</span>
                                    <span>{stage.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stage Content */}
                <div 
                    className="rounded-lg border p-6 min-h-96 transition-colors"
                    style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                    }}
                >
                    {currentStage === 'library' && <NewLibraryStage />}
                    {currentStage === 'workspace' && <NewWorkspaceStage />}
                </div>
            </div>
            
            {/* Credentials Manager Modal */}
            <CredentialsManager 
                isOpen={showCredentials}
                onClose={() => setShowCredentials(false)}
            />
        </div>
    );
}