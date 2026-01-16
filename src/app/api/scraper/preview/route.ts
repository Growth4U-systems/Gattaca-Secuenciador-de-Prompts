import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserApiKey } from '@/lib/getUserApiKey';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds max for preview

interface FirecrawlMapResponse {
  success: boolean;
  links?: string[];
  error?: string;
}

interface PreviewResponse {
  success: boolean;
  urls?: {
    total: number;
    filtered: number;
    included: string[];
    excluded: string[];
    sections: Record<string, string[]>;
  };
  error?: string;
}

/**
 * Preview endpoint for Firecrawl crawl mode
 * Uses the /map endpoint to discover URLs and applies filters client-side
 * This allows users to see what will be scraped before starting the crawl
 */
export async function POST(request: NextRequest): Promise<NextResponse<PreviewResponse>> {
  try {
    const body = await request.json();
    const { url, includePaths, excludePaths, limit } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'Missing url parameter' }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get Firecrawl API key
    const firecrawlApiKey = await getUserApiKey({
      userId: session.user.id,
      serviceName: 'firecrawl',
      supabase,
    }) || process.env.FIRECRAWL_API_KEY;

    if (!firecrawlApiKey) {
      return NextResponse.json(
        { success: false, error: 'Firecrawl API key not configured. Please add your API key in Settings > API Keys.' },
        { status: 400 }
      );
    }

    // Call Firecrawl map endpoint to discover URLs
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url,
        limit: Math.min(Number(limit) || 200, 500), // Get more URLs for preview
      }),
    });

    const mapResult = (await mapResponse.json()) as FirecrawlMapResponse;

    if (!mapResult.success || !mapResult.links) {
      return NextResponse.json(
        { success: false, error: mapResult.error || 'Failed to fetch site map' },
        { status: 500 }
      );
    }

    const allUrls = mapResult.links;

    // Parse filters
    const includePatterns = includePaths
      ? (Array.isArray(includePaths) ? includePaths : [includePaths])
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
          .map(p => {
            try {
              return new RegExp(p, 'i');
            } catch {
              // If invalid regex, treat as simple string match
              return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }
          })
      : [];

    const excludePatterns = excludePaths
      ? (Array.isArray(excludePaths) ? excludePaths : [excludePaths])
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
          .map(p => {
            try {
              return new RegExp(p, 'i');
            } catch {
              // If invalid regex, treat as simple string match
              return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }
          })
      : [];

    // Apply filters
    const includedUrls: string[] = [];
    const excludedUrls: string[] = [];

    for (const link of allUrls) {
      try {
        const linkUrl = new URL(link);
        const path = linkUrl.pathname;

        // Check if excluded
        if (excludePatterns.length > 0 && excludePatterns.some(pattern => pattern.test(path))) {
          excludedUrls.push(link);
          continue;
        }

        // Check if included (if no include patterns, include all)
        if (includePatterns.length === 0 || includePatterns.some(pattern => pattern.test(path))) {
          includedUrls.push(link);
        } else {
          excludedUrls.push(link);
        }
      } catch {
        // Invalid URL, skip
        excludedUrls.push(link);
      }
    }

    // Group included URLs by section
    const sections: Record<string, string[]> = {};
    for (const link of includedUrls) {
      try {
        const linkUrl = new URL(link);
        const pathParts = linkUrl.pathname.split('/').filter(Boolean);
        const section = pathParts[0] || 'root';
        if (!sections[section]) sections[section] = [];
        sections[section].push(link);
      } catch {
        if (!sections['other']) sections['other'] = [];
        sections['other'].push(link);
      }
    }

    return NextResponse.json({
      success: true,
      urls: {
        total: allUrls.length,
        filtered: includedUrls.length,
        included: includedUrls,
        excluded: excludedUrls,
        sections,
      },
    });
  } catch (error) {
    console.error('[scraper/preview] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
