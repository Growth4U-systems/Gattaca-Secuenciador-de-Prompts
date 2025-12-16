# Local Supabase Development Setup

This guide will help you set up and use Supabase locally for development, following the [official Supabase best practices](https://supabase.com/docs/guides/deployment/managing-environments).

## Prerequisites

- Docker installed and running (included in devcontainer)
- Node.js and npm installed
- Supabase CLI (already installed as dev dependency)

## Quick Start

### 1. Rebuild Devcontainer (First Time Only)

Since we've added Docker support to the devcontainer, you need to rebuild it:

1. Open Command Palette (Ctrl/Cmd + Shift + P)
2. Select "Dev Containers: Rebuild Container"
3. Wait for the container to rebuild

Alternatively, if you're not using a devcontainer, make sure Docker Desktop is installed and running.

### 2. Configure Your Environment

Your `.env` file has been created with the default local Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=your-gemini-api-key-here  # ⚠️ Set your actual API key
```

**Important:** Update the `GEMINI_API_KEY` with your actual API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Start Local Supabase

After rebuilding the devcontainer:

```bash
npx supabase start
```

This command will:
- Start PostgreSQL database
- Apply all migrations from `supabase/migrations/`
- Start Supabase Studio (UI)
- Start all Supabase services (Auth, Storage, etc.)

**First-time startup takes 2-5 minutes** as it downloads Docker images.

### 4. Access Supabase Services

Once started, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **API** | http://localhost:54321 | REST API endpoint |
| **Studio** | http://localhost:54323 | Database management UI |
| **Inbucket** | http://localhost:54324 | Email testing inbox |

### 5. Start Your Application

In a new terminal:

```bash
npm run dev
```

Your Next.js app will automatically connect to the local Supabase instance.

## Common Commands

### Start/Stop Supabase

```bash
# Start all services
npx supabase start

# Stop all services
npx supabase stop

# Stop and reset database (⚠️ deletes all data)
npx supabase stop --no-backup

# Check status
npx supabase status
```

### Database Management

```bash
# Create a new migration
npx supabase migration new migration_name

# Apply migrations
npx supabase db reset

# Pull schema changes from remote
npx supabase db pull

# Push migrations to remote
npx supabase db push
```

### Edge Functions

```bash
# Deploy all functions
npm run supabase:deploy

# Deploy specific function
npm run supabase:deploy:execute
npm run supabase:deploy:generate

# View logs
npm run supabase:logs
npm run supabase:logs:execute
```

## Environment Strategy

Following Supabase best practices, we use:

### Local Development (`.env`)
- Uses local Supabase instance
- Local PostgreSQL database
- No API rate limits
- Fast iteration

### Production (`.env` or Vercel Environment Variables)
- Uses Supabase Cloud
- Production database
- Managed by Vercel deployment

The Supabase client in `src/lib/supabase.ts` automatically detects which environment to use based on environment variables.

## Database Schema Workflow

### Making Schema Changes

**Option 1: SQL Migrations (Recommended)**

1. Create a new migration:
   ```bash
   npx supabase migration new add_new_table
   ```

2. Edit the migration file in `supabase/migrations/`

3. Apply changes locally:
   ```bash
   npx supabase db reset
   ```

**Option 2: Studio UI + Auto Diff**

1. Open Studio: http://localhost:54323
2. Make changes using the UI
3. Generate migration from changes:
   ```bash
   npx supabase db diff -f migration_name
   ```
4. Review and commit the migration file

### Deploying Schema Changes

**Important:** Never deploy from your local machine in production!

Instead, use CI/CD (GitHub Actions) to deploy migrations:

1. Commit your migration files to Git
2. Push to your repository
3. CI/CD pipeline automatically applies migrations to staging/production

## Troubleshooting

### Docker Not Running

If you see "Cannot connect to Docker daemon":
1. Rebuild the devcontainer (if using devcontainer)
2. Or ensure Docker Desktop is running
3. Run `docker ps` to verify Docker is accessible

### Port Already in Use

If port 54321 (or others) is already in use:
1. Stop the conflicting service
2. Or edit `supabase/config.toml` to use different ports

### Migrations Failing

If migrations fail to apply:
1. Check migration SQL syntax
2. Review dependencies between migrations
3. Use `npx supabase db reset` to reset and reapply all migrations

### Environment Variables Not Loading

Ensure you're using `.env` (not `.env`) for local development:
- Next.js automatically loads `.env` in development
- `.env` is gitignored and won't be committed

## Next Steps

1. ✅ Rebuild devcontainer to enable Docker
2. ✅ Set your `GEMINI_API_KEY` in `.env`
3. ✅ Run `npx supabase start`
4. ✅ Run `npm run dev`
5. ✅ Access Studio at http://localhost:54323

## Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
