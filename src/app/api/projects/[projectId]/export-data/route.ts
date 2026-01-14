import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

    // Verificar errores
    if (findPlaceResult.error) {
      console.error('Error fetching find_place:', findPlaceResult.error)
    }
    if (proveLegitResult.error) {
      console.error('Error fetching prove_legit:', proveLegitResult.error)
    }
    if (uspUvpResult.error) {
      console.error('Error fetching usp_uvp:', uspUvpResult.error)
    }

    return NextResponse.json({
      success: true,
      findPlace: findPlaceResult.data || [],
      proveLegit: proveLegitResult.data || [],
      uspUvp: uspUvpResult.data || []
    })
  } catch (error) {
    console.error('Error fetching export data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch export data' },
      { status: 500 }
    )
  }
}
