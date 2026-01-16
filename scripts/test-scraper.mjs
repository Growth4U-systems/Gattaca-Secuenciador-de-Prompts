#!/usr/bin/env node
/**
 * Script para testear scrapers de Apify directamente
 *
 * Uso:
 *   node scripts/test-scraper.mjs <scraper_type> [max_items]
 *
 * Ejemplos:
 *   node scripts/test-scraper.mjs appstore_reviews 5
 *   node scripts/test-scraper.mjs playstore_reviews 5
 *   node scripts/test-scraper.mjs trustpilot_reviews 5
 *   node scripts/test-scraper.mjs tiktok_posts 5
 *
 * Requiere:
 *   - Variable de entorno APIFY_TOKEN
 */

const APIFY_ACTORS = {
  instagram_posts_comments: 'dIKFJ95TN8YclK2no',
  tiktok_posts: 'GdWCkxBtKWOsKjdch',
  tiktok_comments: 'BDec00yAmCm1QbMEI',
  linkedin_company_posts: 'mrThmKLmkxJPehxCg',
  linkedin_comments: '2XnpwxfhSW1fAWElp',
  facebook_posts: 'KoJrdxJCTtpon81KY',
  facebook_comments: 'us5srxAYnsrkgUv2v',
  linkedin_company_insights: '6mSoKnECRInl7QUb8',
  youtube_channel_videos: '67Q6fmd8iedTVcCwY',
  youtube_comments: 'p7UMdpQnjKmmpR21D',
  youtube_transcripts: 'CTQcdDtqW5dvELvur',
  g2_reviews: 'kT2dx4xoOebKw6uQB',
  capterra_reviews: '50GSYJYYfRB0xCNRc',
  trustpilot_reviews: 'fLXimoyuhE1UQgDbM',
  appstore_reviews: '4qRgh5vXXsv0bKa1l',
  playstore_reviews: 'Bs72sDKr8fGe3d5Ti',
  google_maps_reviews: 'thEbk6nzmhRsChwBS',
  reddit_posts: 'trudax~reddit-scraper',
};

// Inputs de test predefinidos para cada scraper (usando Revolut como ejemplo)
const TEST_INPUTS = {
  appstore_reviews: {
    startUrls: ['https://apps.apple.com/es/app/revolut/id932493382'],
    maxItems: 10,
    country: 'es',
  },
  playstore_reviews: {
    // Note: hl and gl params must be in URL, not as separate fields
    startUrls: ['https://play.google.com/store/apps/details?id=com.revolut.revolut&hl=es&gl=ES'],
    maxItems: 10,
  },
  trustpilot_reviews: {
    companyDomain: 'revolut.com',
    count: 10,
    date: 'last30days',
  },
  instagram_posts_comments: {
    username: ['revolut'],
    resultsLimit: 10,
    resultsType: 'posts',
  },
  tiktok_posts: {
    profiles: ['@revolut'],
    resultsPerPage: 10,
    proxyCountryCode: 'ES',
    profileSorting: 'latest',
  },
  linkedin_company_posts: {
    company_name: 'revolut',
    limit: 10,
    sort: 'recent',
  },
  linkedin_comments: {
    postIds: ['7417222982525374464'],  // Example post from Revolut
    limit: 10,
    sortOrder: 'most recent',
  },
  linkedin_company_insights: {
    companyUrls: ['https://www.linkedin.com/company/revolut'],
  },
  youtube_channel_videos: {
    startUrls: ['https://www.youtube.com/@Revolut'],
    maxResults: 5,
    maxResultsShorts: 0,
    maxResultStreams: 0,
    sortVideosBy: 'NEWEST',
  },
  youtube_comments: {
    startUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],  // Rick Roll for testing
    maxComments: 10,
    commentsSortBy: '0',  // Top comments
  },
  youtube_transcripts: {
    startUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],  // Rick Roll for testing
    timestamps: true,
  },
  facebook_posts: {
    startUrls: ['https://www.facebook.com/Revolut'],
    resultsLimit: 10,
  },
  g2_reviews: {
    product: 'revolut-business',
    max_reviews: 200, // G2 tiene mínimo de 200
  },
  capterra_reviews: {
    company_name: 'revolut',
    maxReviews: 10,
  },
  google_maps_reviews: {
    placeUrls: ['https://www.google.com/maps/place/Revolut'],
    maxReviews: 10,
    reviewsSort: 'newest',
    language: 'es',
  },
  reddit_posts: {
    searches: ['r/personalfinance'],
    maxItems: 10,
    maxComments: 5,
    sort: 'new',
    time: 'all',
  },
};

async function testScraper(scraperType, maxItems) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error('❌ Error: APIFY_TOKEN environment variable not set');
    console.error('   Set it with: export APIFY_TOKEN=your_token_here');
    process.exit(1);
  }

  const actorId = APIFY_ACTORS[scraperType];
  if (!actorId) {
    console.error(`❌ Error: Unknown scraper type: ${scraperType}`);
    console.error('   Available types:', Object.keys(APIFY_ACTORS).join(', '));
    process.exit(1);
  }

  let input = TEST_INPUTS[scraperType];
  if (!input) {
    console.error(`❌ Error: No test input defined for: ${scraperType}`);
    process.exit(1);
  }

  // Override maxItems if provided
  if (maxItems) {
    const maxItemsNum = parseInt(maxItems, 10);
    if (input.maxItems !== undefined) input.maxItems = maxItemsNum;
    if (input.count !== undefined) input.count = maxItemsNum;
    if (input.resultsLimit !== undefined) input.resultsLimit = maxItemsNum;
    if (input.resultsPerPage !== undefined) input.resultsPerPage = maxItemsNum;
    if (input.limit !== undefined) input.limit = maxItemsNum;
    if (input.maxReviews !== undefined && scraperType !== 'g2_reviews') input.maxReviews = maxItemsNum;
  }

  console.log(`\n🚀 Testing scraper: ${scraperType}`);
  console.log(`📦 Actor ID: ${actorId}`);
  console.log(`📝 Input:`, JSON.stringify(input, null, 2));
  console.log('\n⏳ Starting Apify actor...\n');

  try {
    // Start the actor
    const startResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    );

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error(`❌ Failed to start actor: ${startResponse.status}`);
      console.error(errorText);
      process.exit(1);
    }

    const startResult = await startResponse.json();
    const runId = startResult.data.id;
    console.log(`✅ Actor started. Run ID: ${runId}`);
    console.log(`🔗 View run: https://console.apify.com/actors/runs/${runId}`);

    // Poll for completion
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000)); // Wait 5 seconds
      attempts++;

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
      );
      const statusResult = await statusResponse.json();
      status = statusResult.data.status;

      process.stdout.write(`\r⏳ Status: ${status} (${attempts * 5}s elapsed)`);
    }

    console.log('\n');

    if (status === 'SUCCEEDED') {
      console.log('✅ Actor completed successfully!');

      // Get results
      const datasetId = startResult.data.defaultDatasetId;
      const dataResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=5`
      );
      const data = await dataResponse.json();

      console.log(`\n📊 Results (first 5 items):\n`);
      console.log(JSON.stringify(data, null, 2));

      console.log(`\n✅ TEST PASSED: ${scraperType} works correctly`);
      console.log(`   Total items in dataset: Check Apify console for full count`);
      return true;
    } else {
      console.error(`❌ Actor failed with status: ${status}`);

      // Get logs
      const logsResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/log?token=${token}`
      );
      const logs = await logsResponse.text();
      console.log('\n📋 Last 2000 chars of logs:\n');
      console.log(logs.slice(-2000));

      console.log(`\n❌ TEST FAILED: ${scraperType}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log(`
🧪 Scraper Test Script

Usage:
  node scripts/test-scraper.mjs <scraper_type> [max_items]

Available scrapers:
  ${Object.keys(APIFY_ACTORS).join('\n  ')}

Examples:
  node scripts/test-scraper.mjs appstore_reviews 5
  node scripts/test-scraper.mjs playstore_reviews 5
  node scripts/test-scraper.mjs trustpilot_reviews 10

Note: Requires APIFY_TOKEN environment variable
  `);
  process.exit(0);
}

testScraper(args[0], args[1]);
