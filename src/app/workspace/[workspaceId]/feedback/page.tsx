/**
 * Workspace Feedback Page
 * Displays interactive feedback content for a workspace
 */

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function WorkspaceFeedbackPage() {
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const [feedbackContent, setFeedbackContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        loadFeedback();
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(loadFeedback, 30000);
        return () => clearInterval(interval);
    }, [workspaceId]);

    const loadFeedback = async () => {
        try {
            // Try to load the interactive HTML feedback
            const response = await fetch(`/api/workspaces/${workspaceId}/feedback`);
            
            if (response.ok) {
                const htmlContent = await response.text();
                setFeedbackContent(htmlContent);
                setError('');
            } else {
                setError('Could not load feedback content');
            }
        } catch (err) {
            console.error('Failed to load feedback:', err);
            setError('Failed to load feedback content');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading workspace feedback...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Feedback Unavailable</h1>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={loadFeedback}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div 
                dangerouslySetInnerHTML={{ __html: feedbackContent }}
                className="feedback-content"
            />
            
            {/* Add some custom styling for better integration */}
            <style jsx global>{`
                .feedback-content {
                    min-height: 100vh;
                }
                
                .feedback-content body {
                    margin: 0 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                }
                
                .feedback-content h1 {
                    margin-top: 0;
                }
            `}</style>
        </div>
    );
}