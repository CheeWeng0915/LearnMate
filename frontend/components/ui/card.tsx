import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-canvas rounded-xl border border-hairline ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
