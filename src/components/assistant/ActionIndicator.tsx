'use client'

interface ActionIndicatorProps {
  actionName: string
  onCancel?: () => void
}

export default function ActionIndicator({ actionName, onCancel }: ActionIndicatorProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-amber-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-amber-800">Ejecutando acción</p>
          <p className="text-xs text-amber-600">{actionName}</p>
        </div>
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="text-amber-600 hover:text-amber-800 text-sm font-medium"
        >
          Cancelar
        </button>
      )}
    </div>
  )
}
