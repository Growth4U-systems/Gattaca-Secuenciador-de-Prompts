/**
 * Script para probar la ingesta de eventos a Polar
 *
 * Uso: npx tsx scripts/test-polar-ingestion.ts
 */

import { Polar } from '@polar-sh/sdk';

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;

if (!POLAR_ACCESS_TOKEN) {
  console.error('❌ POLAR_ACCESS_TOKEN not found in environment');
  console.log('   Run: source .env.local');
  process.exit(1);
}

const polar = new Polar({
  accessToken: POLAR_ACCESS_TOKEN,
});

async function testIngestion() {
  console.log('🚀 Testing Polar event ingestion...\n');

  const testUserId = 'test-user-' + Date.now();
  const testTokens = 150;

  try {
    // Test 1: Ingest an event
    console.log('📤 Sending llm_usage event...');
    console.log(`   - external_customer_id: ${testUserId}`);
    console.log(`   - tokens: ${testTokens}`);
    console.log(`   - model: gpt-4o-mini-test`);

    await polar.events.ingest({
      events: [
        {
          name: 'llm_usage',
          externalCustomerId: testUserId,
          metadata: {
            tokens: testTokens.toString(),
            model: 'gpt-4o-mini-test',
          },
        },
      ],
    });

    console.log('\n✅ Event ingested successfully!');
    console.log('\n📊 Check your Polar Dashboard to see the event:');
    console.log('   https://polar.sh/dashboard/events\n');

    // Test 2: List organization info
    console.log('📋 Fetching organization info...');
    const orgs = await polar.organizations.list({});

    if (orgs.result.items.length > 0) {
      const org = orgs.result.items[0];
      console.log(`   - Organization: ${org.name}`);
      console.log(`   - Slug: ${org.slug}`);
    }

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

testIngestion();
