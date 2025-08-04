'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch, GitCommit, FileText, Plus, Minus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

interface GitDiffViewerProps {
  workspaceId: string;
  initialFile?: string;
  initialDiffType?: 'file' | 'branch' | 'staged';
  className?: string;
}

interface DiffData {
  success: boolean;
  diffType: string;
  diff: string;
  hasChanges: boolean;
  file?: string;
  status?: string;
  staged?: boolean;
  baseBranch?: string;
  targetBranch?: string;
  ahead?: number;
  behind?: number;
  changedFiles?: Array<{
    status: string;
    path: string;
    oldPath?: string;
  }>;
  stagedFiles?: Array<{
    status: string;
    path: string;
    oldPath?: string;
  }>;
  error?: string;
}

interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
}

const GitDiffViewer: React.FC<GitDiffViewerProps> = ({
  workspaceId,
  initialFile,
  initialDiffType = 'file',
  className = ''
}) => {
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [diffType, setDiffType] = useState<'file' | 'branch' | 'staged'>(initialDiffType);
  const [selectedFile, setSelectedFile] = useState(initialFile || '');
  const [baseBranch, setBaseBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [showStaged, setShowStaged] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Load branches on mount
  useEffect(() => {
    loadBranches();
  }, [workspaceId]);

  // Auto-load diff when type changes
  useEffect(() => {
    if (diffType === 'staged') {
      loadDiff();
    }
  }, [diffType]);

  const loadBranches = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/git/branch`);
      const data = await response.json();
      
      if (data.success) {
        setBranches(data.branches);
        
        // Set default branches for comparison
        const currentBranch = data.branches.find((b: BranchInfo) => b.current);
        const mainBranch = data.branches.find((b: BranchInfo) => ['main', 'master'].includes(b.name));
        
        if (currentBranch && mainBranch && currentBranch.name !== mainBranch.name) {
          setBaseBranch(mainBranch.name);
          setTargetBranch(currentBranch.name);
        }
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadDiff = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        type: diffType
      });
      
      switch (diffType) {
        case 'file':
          if (!selectedFile) {
            setError('Please select a file to view diff');
            setLoading(false);
            return;
          }
          params.append('file', selectedFile);
          if (showStaged) {
            params.append('staged', 'true');
          }
          break;
          
        case 'branch':
          if (!baseBranch || !targetBranch) {
            setError('Please select both base and target branches');
            setLoading(false);
            return;
          }
          params.append('base', baseBranch);
          params.append('target', targetBranch);
          break;
          
        case 'staged':
          // No additional params needed
          break;
      }
      
      const response = await fetch(`/api/workspaces/${workspaceId}/git/diff?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setDiffData(data);
      } else {
        setError(data.error || 'Failed to load diff');
      }
    } catch (err) {
      setError('Failed to load diff');
      console.error('Error loading diff:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderDiffContent = (diff: string) => {
    if (!diff) {
      return <div className="text-gray-500 text-center py-8">No changes to display</div>;
    }

    const lines = diff.split('\n');
    
    return (
      <div className="font-mono text-sm bg-gray-50 rounded-lg p-4">
        {lines.map((line, index) => {
          let className = 'block whitespace-pre';
          
          if (line.startsWith('+++') || line.startsWith('---')) {
            className += ' text-gray-600 font-semibold';
          } else if (line.startsWith('+')) {
            className += ' text-green-700 bg-green-50';
          } else if (line.startsWith('-')) {
            className += ' text-red-700 bg-red-50';
          } else if (line.startsWith('@@')) {
            className += ' text-blue-700 bg-blue-50 font-semibold';
          }
          
          return (
            <code key={index} className={className}>
              {line}
            </code>
          );
        })}
      </div>
    );
  };

  const renderFileStatus = (status: string) => {
    const statusConfig = {
      'M': { label: 'Modified', color: 'bg-yellow-100 text-yellow-800' },
      'A': { label: 'Added', color: 'bg-green-100 text-green-800' },
      'D': { label: 'Deleted', color: 'bg-red-100 text-red-800' },
      'R': { label: 'Renamed', color: 'bg-blue-100 text-blue-800' },
      'C': { label: 'Copied', color: 'bg-purple-100 text-purple-800' },
      '??': { label: 'Untracked', color: 'bg-gray-100 text-gray-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, color: 'bg-gray-100 text-gray-800' };
    
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const toggleFileExpansion = (filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  };

  const renderChangedFiles = (files: Array<{ status: string; path: string; oldPath?: string }>) => {
    return (
      <div className="space-y-2">
        {files.map((file, index) => (
          <div key={index} className="border rounded-lg p-3">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleFileExpansion(file.path)}
            >
              <div className="flex items-center gap-2">
                {expandedFiles.has(file.path) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FileText size={16} />
                <span className="font-medium">{file.path}</span>
                {file.oldPath && <span className="text-gray-500">← {file.oldPath}</span>}
              </div>
              {renderFileStatus(file.status)}
            </div>
            
            {expandedFiles.has(file.path) && (
              <div className="mt-3 border-t pt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDiffType('file');
                    setSelectedFile(file.path);
                    setShowStaged(false);
                  }}
                >
                  View File Diff
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit size={20} />
            Git Diff Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Diff Type Selection */}
            <div className="flex items-center gap-4">
              <Select value={diffType} onValueChange={(value) => setDiffType(value as 'file' | 'branch' | 'staged')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">File Diff</SelectItem>
                  <SelectItem value="branch">Branch Diff</SelectItem>
                  <SelectItem value="staged">Staged Changes</SelectItem>
                </SelectContent>
              </Select>
              
              <Button onClick={loadDiff} disabled={loading}>
                {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Load Diff'}
              </Button>
            </div>
            
            {/* Type-specific controls */}
            {diffType === 'file' && (
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="File path (e.g., src/components/Button.tsx)"
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showStaged}
                    onChange={(e) => setShowStaged(e.target.checked)}
                  />
                  Staged Changes
                </label>
              </div>
            )}
            
            {diffType === 'branch' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Base:</label>
                  <Select value={baseBranch} onValueChange={setBaseBranch}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select base" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(branch => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name} {branch.current && '(current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Target:</label>
                  <Select value={targetBranch} onValueChange={setTargetBranch}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(branch => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name} {branch.current && '(current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {error && (
              <div className="text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Diff Results */}
      {diffData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GitBranch size={20} />
                Diff Results
              </CardTitle>
              
              {diffData.hasChanges && (
                <Badge variant="outline" className="bg-blue-50 text-blue-800">
                  {diffData.diffType === 'branch' && diffData.ahead !== undefined && diffData.behind !== undefined
                    ? `${diffData.ahead} ahead, ${diffData.behind} behind`
                    : 'Has Changes'
                  }
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {diffData.diffType === 'branch' && (diffData.changedFiles || diffData.stagedFiles) ? (
              <Tabs defaultValue="files" className="w-full">
                <TabsList>
                  <TabsTrigger value="files">Changed Files</TabsTrigger>
                  <TabsTrigger value="diff">Full Diff</TabsTrigger>
                </TabsList>
                
                <TabsContent value="files" className="space-y-4">
                  {diffData.changedFiles && diffData.changedFiles.length > 0 ? (
                    renderChangedFiles(diffData.changedFiles)
                  ) : (
                    <div className="text-center py-8 text-gray-500">No changed files</div>
                  )}
                </TabsContent>
                
                <TabsContent value="diff">
                  <ScrollArea className="h-96 w-full">
                    {renderDiffContent(diffData.diff)}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : diffData.diffType === 'staged' && diffData.stagedFiles ? (
              <Tabs defaultValue="files" className="w-full">
                <TabsList>
                  <TabsTrigger value="files">Staged Files</TabsTrigger>
                  <TabsTrigger value="diff">Staged Diff</TabsTrigger>
                </TabsList>
                
                <TabsContent value="files" className="space-y-4">
                  {diffData.stagedFiles && diffData.stagedFiles.length > 0 ? (
                    renderChangedFiles(diffData.stagedFiles)
                  ) : (
                    <div className="text-center py-8 text-gray-500">No staged files</div>
                  )}
                </TabsContent>
                
                <TabsContent value="diff">
                  <ScrollArea className="h-96 w-full">
                    {renderDiffContent(diffData.diff)}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <ScrollArea className="h-96 w-full">
                {renderDiffContent(diffData.diff)}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GitDiffViewer;