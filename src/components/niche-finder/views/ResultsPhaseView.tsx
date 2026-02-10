'use client'

import NicheResultsDashboard from '../NicheResultsDashboard'

interface ResultsPhaseViewProps {
  jobId: string
}

export default function ResultsPhaseView({ jobId }: ResultsPhaseViewProps) {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Nichos Encontrados</h2>
      </div>
      <NicheResultsDashboard jobId={jobId} />
    </div>
  )
}
