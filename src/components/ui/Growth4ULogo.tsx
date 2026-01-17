'use client'

interface Growth4ULogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Growth4ULogo({ className = '', size = 'md' }: Growth4ULogoProps) {
  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  return (
    <div className={`flex items-center ${className}`}>
      <span className={`font-bold text-gray-900 ${sizeClasses[size]}`}>
        Growth
      </span>
      <span
        className={`font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent ${sizeClasses[size]}`}
      >
        4U
      </span>
    </div>
  )
}
