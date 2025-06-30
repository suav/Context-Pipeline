/**
 * Multi-stage loading utilities and components
 * Provides progressive loading patterns for better performance
 */

import React, { Suspense, lazy, ComponentType } from 'react';

// Loading states
export const LoadingStates = {
  skeleton: (height = 'h-32', text = 'Loading...') => (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${height} flex items-center justify-center`}>
      <span className="text-gray-500 text-sm">{text}</span>
    </div>
  ),
  
  spinner: (text = 'Loading...') => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
      <span className="text-gray-600">{text}</span>
    </div>
  ),
  
  stageShell: (stageName: string) => (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
      <div className="text-center text-gray-500 mt-4">
        Loading {stageName} stage...
      </div>
    </div>
  )
};

// Lazy loading wrapper with error boundary
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || LoadingStates.spinner()}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Progressive data loader hook
export function useProgressiveData<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
) {
  const [state, setState] = React.useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
    stage: 'initial' | 'loading' | 'loaded' | 'error';
  }>({
    data: null,
    loading: false,
    error: null,
    stage: 'initial'
  });

  React.useEffect(() => {
    let cancelled = false;
    
    setState(prev => ({ ...prev, loading: true, stage: 'loading' }));
    
    fetchFn()
      .then(data => {
        if (!cancelled) {
          setState({
            data,
            loading: false,
            error: null,
            stage: 'loaded'
          });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error,
            stage: 'error'
          }));
        }
      });
    
    return () => { cancelled = true; };
  }, deps);

  return state;
}

// Intersection observer for viewport-based loading
export function useInViewport(threshold = 0.1) {
  const [isInView, setIsInView] = React.useState(false);
  const [hasBeenInView, setHasBeenInView] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;
        setIsInView(inView);
        if (inView && !hasBeenInView) {
          setHasBeenInView(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, hasBeenInView]);

  return { ref, isInView, hasBeenInView };
}

// Stage-based loading manager
export class StageLoader {
  private loadedStages = new Set<string>();
  private loadingStages = new Set<string>();
  private prefetchQueue: string[] = [];

  async loadStage(stageKey: string, loader: () => Promise<any>) {
    if (this.loadedStages.has(stageKey)) {
      return; // Already loaded
    }

    if (this.loadingStages.has(stageKey)) {
      return; // Already loading
    }

    this.loadingStages.add(stageKey);
    
    try {
      await loader();
      this.loadedStages.add(stageKey);
    } finally {
      this.loadingStages.delete(stageKey);
    }
  }

  queuePrefetch(stageKey: string) {
    if (!this.loadedStages.has(stageKey) && !this.prefetchQueue.includes(stageKey)) {
      this.prefetchQueue.push(stageKey);
    }
  }

  async processPrefetchQueue(loaders: Record<string, () => Promise<any>>) {
    // Process prefetch queue when browser is idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.prefetchQueue.forEach(async (stageKey) => {
          if (loaders[stageKey]) {
            await this.loadStage(stageKey, loaders[stageKey]);
          }
        });
        this.prefetchQueue = [];
      });
    }
  }
}

export const stageLoader = new StageLoader();