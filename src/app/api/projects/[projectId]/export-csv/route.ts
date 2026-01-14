import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import JSZip from 'jszip'
import {
  transformFindPlaceToCSV,
  transformProveLegitToCSV,
  transformUspUvpToCSV
} from '@/lib/exporters/csv-transformer'

export async function GET(
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

    const supabase = await createClient()

    // Obtener nombre del proyecto para el archivo
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()

    const projectName = project?.name?.replace(/[^a-zA-Z0-9-_]/g, '_') || 'export'

    // Leer datos de las 3 tablas en paralelo
    const [findPlaceResult, proveLegitResult, uspUvpResult] = await Promise.all([
      supabase
        .from('export_find_place')
        .select('*')
        .eq('project_id', projectId)
        .order('ecp_name')
        .order('evaluation_criterion'),
      supabase
        .from('export_prove_legit')
        .select('*')
        .eq('project_id', projectId)
        .order('ecp_name')
        .order('asset_name'),
      supabase
        .from('export_usp_uvp')
        .select('*')
        .eq('project_id', projectId)
        .order('ecp_name')
        .order('message_category')
    ])

    // Transformar a CSV
    const csvFindPlace = transformFindPlaceToCSV(findPlaceResult.data || [])
    const csvProveLegit = transformProveLegitToCSV(proveLegitResult.data || [])
    const csvUspUvp = transformUspUvpToCSV(uspUvpResult.data || [])

    // Crear ZIP con 3 CSVs
    const zip = new JSZip()
    zip.file('1-find-your-place-to-win.csv', csvFindPlace)
    zip.file('2-prove-that-you-are-legit.csv', csvProveLegit)
    zip.file('3-usp-uvp.csv', csvUspUvp)

    const zipContent = await zip.generateAsync({ type: 'arraybuffer' })

    return new NextResponse(zipContent, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}-ecp-export.zip"`
      }
    })
  } catch (error) {
    console.error('Error generating CSV export:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate CSV export' },
      { status: 500 }
    )
  }
}
