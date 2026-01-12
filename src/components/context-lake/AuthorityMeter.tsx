'use client'

interface AuthorityMeterProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function AuthorityMeter({
  score,
  size = 'md',
  showLabel = true,
}: AuthorityMeterProps) {
  const percentage = Math.round(score * 100)

  // Color based on score
  const getColor = () => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.5) return 'bg-blue-500'
    if (score >= 0.3) return 'bg-amber-500'
    return 'bg-slate-400'
  }

  const heightClasses = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  }

  const textClasses = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-gray-100 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`${getColor()} ${heightClasses[size]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={`${textClasses[size]} text-gray-500 font-medium tabular-nums`}>
          {percentage}%
        </span>
      )}
    </div>
  )
}
