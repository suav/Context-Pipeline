/**
 * Simple lazy loading wrapper for testing
 */

'use client';

import React, { Suspense, lazy } from 'react';

// Lazy load our test component
const LazyTestComponent = lazy(() => import('./LazyTestComponent'));

interface LazyWrapperProps {
  show: boolean;
}

export function LazyWrapper({ show }: LazyWrapperProps) {
  if (!show) {
    return (
      <div className="p-4 border border-gray-300 rounded">
        <p className="text-gray-500">Click "Load Component" to test lazy loading</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="p-4 border border-blue-300 rounded animate-pulse">
        <p className="text-blue-600">Loading component...</p>
      </div>
    }>
      <LazyTestComponent />
    </Suspense>
  );
}