import React from "react";

export const LoadingSkeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  className?: string;
}> = ({ width = "100%", height = 12, className = "" }) => {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  } as React.CSSProperties;
  return <div className={`ml-skeleton ${className}`} style={style} aria-hidden="true" />;
};

export default LoadingSkeleton;
