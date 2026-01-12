'use client'

import { Crown, Target, Clock } from 'lucide-react'
import { DocumentTier, TIER_CONFIG } from '@/types/v2.types'

interface TierBadgeProps {
  tier: DocumentTier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showIcon?: boolean
}

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-xs gap-1',
  md: 'px-2 py-1 text-xs gap-1.5',
  lg: 'px-2.5 py-1.5 text-sm gap-2',
}

export default function TierBadge({
  tier,
  size = 'md',
  showLabel = true,
  showIcon = true,
}: TierBadgeProps) {
  const config = TIER_CONFIG[tier]
  const iconSize = iconSizes[size]

  const Icon = tier === 1 ? Crown : tier === 2 ? Target : Clock

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${config.badgeClass}`}
    >
      {showIcon && <Icon size={iconSize} />}
      {showLabel && <span>{config.name}</span>}
    </span>
  )
}
