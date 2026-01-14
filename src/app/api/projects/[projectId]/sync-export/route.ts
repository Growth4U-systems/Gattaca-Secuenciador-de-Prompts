import { NextRequest, NextResponse } from 'next/server'
import { syncProjectExportData } from '@/lib/exporters/export-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const results = await syncProjectExportData(projectId)

    // Construir mensaje informativo
    let message = `Sincronizadas ${results.campaignsProcessed} campanas completadas`
    if (results.campaignsSkipped > 0) {
      message += ` (${results.campaignsSkipped} incompletas omitidas)`
    }

    return NextResponse.json({
      success: true,
      message,
      details: {
        campaignsProcessed: results.campaignsProcessed,
        campaignsSkipped: results.campaignsSkipped,
        findPlace: results.totalFindPlace,
        proveLegit: results.totalProveLegit,
        uspUvp: results.totalUspUvp
      }
    })
  } catch (error) {
    console.error('Error syncing export data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync export data' },
      { status: 500 }
    )
  }
}
