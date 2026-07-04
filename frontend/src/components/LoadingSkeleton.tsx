import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  cols?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full space-y-4">
      {/* Search/Filter Bar Skeleton */}
      <div className="flex gap-4 mb-6">
        <div className="h-10 w-48 skeleton"></div>
        <div className="h-10 w-32 skeleton"></div>
        <div className="h-10 w-32 skeleton"></div>
      </div>
      {/* Table Skeleton */}
      <div className="table-container bg-white border border-[#e2e8e6]">
        <table className="data-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <div className="h-4 w-20 skeleton"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <div className="h-5 w-28 skeleton"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
