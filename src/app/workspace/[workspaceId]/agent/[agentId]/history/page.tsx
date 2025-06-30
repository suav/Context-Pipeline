/**
 * Agent History Page
 * Displays detailed history and logs for a specific agent
 */

'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AgentSession {
    id: string;
    started_at: string;
    ended_at?: string;
    status: 'active' | 'completed' | 'error';
    task_description?: string;
    interactions: any[];
}

interface AgentHistory {
    agent_id: string;
    name: string;
    created_at: string;
    total_interactions: number;
    sessions: AgentSession[];
    current_session?: string;
}

export default function AgentHistoryPage() {
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const agentId = params.agentId as string;
    
    const [history, setHistory] = useState<AgentHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        loadAgentHistory();
        
        // Auto-refresh every 10 seconds if agent is active
        const interval = setInterval(loadAgentHistory, 10000);
        return () => clearInterval(interval);
    }, [workspaceId, agentId]);

    const loadAgentHistory = async () => {
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/history`);
            
            if (response.ok) {
                const data = await response.json();
                setHistory(data);
                setError('');
            } else if (response.status === 404) {
                setError('Agent not found');
            } else {
                setError('Could not load agent history');
            }
        } catch (err) {
            console.error('Failed to load agent history:', err);
            setError('Failed to load agent history');
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-blue-600 bg-blue-100';
            case 'completed': return 'text-green-600 bg-green-100';
            case 'error': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading agent history...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">🤖</div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Agent History Unavailable</h1>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={loadAgentHistory}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors mr-2"
                    >
                        Retry
                    </button>
                    <button
                        onClick={() => window.close()}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    if (!history) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-gray-400 text-6xl mb-4">📭</div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">No History Available</h1>
                    <p className="text-gray-600">This agent has no recorded history yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto py-8 px-4">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                🤖 Agent: {history.name}
                            </h1>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>ID: {history.agent_id}</span>
                                <span>•</span>
                                <span>Created: {formatTimestamp(history.created_at)}</span>
                                <span>•</span>
                                <span>{history.total_interactions} total interactions</span>
                            </div>
                        </div>
                        <button
                            onClick={() => window.close()}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Current Session */}
                {history.current_session && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h2 className="font-semibold text-blue-900 mb-2">🔄 Current Session</h2>
                        <p className="text-blue-700">Agent is currently active in session: {history.current_session}</p>
                    </div>
                )}

                {/* Sessions */}
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">Session History</h2>
                    
                    {history.sessions.length > 0 ? (
                        <div className="space-y-4">
                            {history.sessions.map((session, index) => (
                                <div key={session.id} className="bg-white rounded-lg shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-gray-900">
                                                Session {history.sessions.length - index}
                                            </h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                                                {session.status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {formatTimestamp(session.started_at)}
                                            {session.ended_at && ` - ${formatTimestamp(session.ended_at)}`}
                                        </div>
                                    </div>
                                    
                                    {session.task_description && (
                                        <div className="mb-4">
                                            <h4 className="font-medium text-gray-700 mb-1">Task:</h4>
                                            <p className="text-gray-600">{session.task_description}</p>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <h4 className="font-medium text-gray-700 mb-2">
                                            Interactions ({session.interactions.length})
                                        </h4>
                                        {session.interactions.length > 0 ? (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {session.interactions.map((interaction, idx) => (
                                                    <div key={idx} className="bg-gray-50 p-3 rounded text-sm">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-medium text-gray-700">
                                                                {interaction.type || 'Interaction'}
                                                            </span>
                                                            <span className="text-gray-500 text-xs">
                                                                {interaction.timestamp ? formatTimestamp(interaction.timestamp) : ''}
                                                            </span>
                                                        </div>
                                                        {interaction.message && (
                                                            <p className="text-gray-600">{interaction.message}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic">No interactions recorded</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                            <div className="text-gray-400 text-4xl mb-2">📋</div>
                            <h3 className="font-medium text-gray-900 mb-1">No Sessions Yet</h3>
                            <p className="text-gray-600">This agent hasn't started any work sessions.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}