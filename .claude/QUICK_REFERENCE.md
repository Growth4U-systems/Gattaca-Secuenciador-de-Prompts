# Quick Reference Guide

## Essential Commands

### Development
```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build           # Build for production
npm run lint            # Run ESLint
```

### Supabase
```bash
npm run supabase:deploy              # Deploy all Edge Functions
npm run supabase:deploy:execute      # Deploy execute-flow-step function
npm run supabase:deploy:generate     # Deploy generate-ecp-step function
npm run supabase:logs                # View generate-ecp-step logs
npm run supabase:logs:execute        # View execute-flow-step logs
```

### Supabase CLI
```bash
supabase login                       # Authenticate with Supabase
supabase link --project-ref REF      # Link to your Supabase project
supabase db push                     # Push migrations to remote
supabase functions serve             # Run functions locally
supabase secrets set KEY=value       # Set Edge Function secrets
```

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `GEMINI_API_KEY` - Google Gemini API key

### Optional
- `VERCEL_BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

## Database Tables

### projects
- `id` (uuid, PK)
- `name` (text)
- `description` (text)
- `context_config` (jsonb) - Maps step_X → [doc_ids]
- `prompts` (jsonb) - 5 editable step prompts
- `user_id` (uuid) - Owner

### knowledge_base_docs
- `id` (uuid, PK)
- `project_id` (uuid, FK)
- `category` (text) - product, competitor, research, output
- `file_name` (text)
- `extracted_content` (text)
- `token_count` (integer)

### ecp_campaigns
- `id` (uuid, PK)
- `project_id` (uuid, FK)
- `ecp_name` (text)
- `problem_core` (text)
- `country` (text)
- `industry` (text)
- `status` (text)
- `research_result`, `step1_result`, etc. (text)

### execution_logs
- `id` (uuid, PK)
- `campaign_id` (uuid, FK)
- `step_name` (text)
- `model_used` (text)
- `input_tokens`, `output_tokens` (integer)
- `success` (boolean)
- `error_message` (text)

## AI Models

### Gemini 2.0 Flash
- **Use**: Deep Research, Steps 1-3
- **Cost**: ~$0.075 per 1M input tokens
- **Model ID**: `gemini-2.0-flash`

### Gemini 2.0 Pro
- **Use**: Step 4 (final outputs)
- **Cost**: ~$3.50 per 1M input tokens
- **Model ID**: `gemini-2.0-pro`

## Token Limits
- **Total Limit**: 2M tokens (2,097,152)
- **Warning**: 1.5M tokens (75%)
- **Estimation**: characters / 4

## Ports
- **3000** - Next.js dev server
- **54321** - Supabase local instance

## File Paths

### Frontend
- `src/app/page.tsx` - Projects list
- `src/app/projects/new/page.tsx` - Create project
- `src/app/projects/[projectId]/page.tsx` - Project dashboard
- `src/components/documents/` - Document upload/list components
- `src/components/TokenMonitor.tsx` - Token usage monitoring

### Backend
- `src/app/api/documents/upload/route.ts` - Document upload API
- `supabase/functions/generate-ecp-step/` - Main Edge Function
- `supabase/migrations/` - Database migrations

### Configuration
- `.env.local` - Local environment variables
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration

## Common Workflows

### Adding a New Document Category
1. Update database schema if needed
2. Add category to upload UI
3. Update extraction logic in upload route
4. Test with sample files

### Creating a New Edge Function
1. Create function directory in `supabase/functions/`
2. Write `index.ts` with Deno imports
3. Test locally: `supabase functions serve`
4. Deploy: `npm run supabase:deploy`
5. Set secrets: `supabase secrets set KEY=value`

### Debugging Token Issues
1. Check TokenMonitor component
2. Review token calculation in database triggers
3. Check document content lengths
4. Verify context_config mappings

### Testing Upload Flow
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@test.pdf" \
  -F "projectId=xxx-xxx-xxx" \
  -F "category=product"
```

## Troubleshooting

### Edge Function Errors
- Check logs: `npm run supabase:logs`
- Verify secrets are set
- Check CORS configuration
- Ensure Gemini API key is valid

### Upload Issues
- Check file size limits
- Verify MIME types
- Review extraction error logs
- Check storage permissions

### RLS Issues
- Verify user is authenticated
- Check policy definitions
- Review user_id matching
- Test with service role key

## Resources
- [Supabase Docs](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
