#!/bin/bash
# Script to apply SQL migration to Supabase using psql

# Load env vars
source .env.local 2>/dev/null || true

# Supabase project details
PROJECT_REF="zgzhpnxtyidugrrmwqar"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ SUPABASE_DB_PASSWORD not set in .env.local"
  echo ""
  echo "To get your database password:"
  echo "1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
  echo "2. Copy the password from 'Database password'"
  echo "3. Add to .env.local: SUPABASE_DB_PASSWORD=your_password"
  echo ""
  echo "Or run this manually:"
  echo "psql 'postgresql://postgres:[YOUR-PASSWORD]@db.${PROJECT_REF}.supabase.co:5432/postgres' -f supabase/migrations/APPLY_NOW_combined_v2.sql"
  exit 1
fi

# Connection string
DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo "🚀 Applying migration to Supabase..."
echo "Project: ${PROJECT_REF}"
echo ""

# Run the migration
psql "$DB_URL" -f supabase/migrations/APPLY_NOW_combined_v2.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "Verifying tables..."
  psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('document_assignments', 'synthesis_jobs', 'completeness_scores', 'foundational_schemas', 'foundational_transformers') ORDER BY table_name;"
else
  echo ""
  echo "❌ Migration failed. Check the error above."
fi
