import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-8 w-8 border-[3px]' : 'h-6 w-6 border-2'
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-teal-600 border-t-transparent',
        sizeClass,
        className
      )}
      {...props}
    />
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-slate-300 bg-white">
      {icon && <div className="text-slate-400 mb-3">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}