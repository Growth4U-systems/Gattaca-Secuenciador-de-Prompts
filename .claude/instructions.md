# ECP Generator - Claude Code Instructions

## Project Overview
This is an automated marketing system that generates ECP (Extended Customer Problem) strategies using AI. Built with Next.js 14, Supabase Cloud, and Gemini 2.0 AI models.

## Key Architecture Principles

### Guided Setup Philosophy
- **Project**: Global client configuration (prompts, documents)
- **Campaign**: Specific execution per niche (country, industry, ECP)
- **Granular Control**: Users select which documents to use at each step

### Technology Stack
- **Frontend**: Next.js 14 (App Router), React, TailwindCSS
- **Backend**: Supabase Cloud (Postgres + Row Level Security)
- **AI**: Gemini 2.0 Flash (analysis) and Pro (final outputs)
- **Edge Functions**: Deno runtime on Supabase Cloud
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)

## Database Schema

### Core Tables
1. **projects**: Master configuration, editable prompts (5 steps), context_config JSONB mapping
2. **knowledge_base_docs**: Uploaded documents with extracted content (product, competitor, research, output categories)
3. **ecp_campaigns**: Campaign sessions with ECP name, problem core, country, industry
4. **execution_logs**: Detailed audit trail of AI calls

### Security
All tables have Row Level Security (RLS) enabled. Users only see their own data.

## AI System

### Token Limits
- **Warning**: > 1.5M tokens (75%)
- **Error**: > 2M tokens (100%)
- Estimation: chars/4

### Models
- **Gemini 2.0 Flash**: Deep Research, Steps 1-3 (~$0.075 per 1M tokens)
- **Gemini 2.0 Pro**: Step 4 final output (~$3.50 per 1M tokens)

### Grounding Strategy
Strict grounding - AI ONLY uses provided context, never internal training data.

## Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow Next.js 14 App Router patterns
- Implement RLS policies for all database operations
- Use Tailwind for styling (utility-first approach)

### Testing
- Test uploads locally: `curl -X POST http://localhost:3000/api/documents/upload`
- Test Edge Functions: Use Supabase local development

### Common Tasks
- Deploy Edge Functions: `npm run supabase:deploy`
- View logs: `npm run supabase:logs`
- Local dev: `npm run dev` (port 3000)

## File Structure
- `/src/app/`: Next.js pages and API routes
- `/src/components/`: React components (documents/, campaigns/)
- `/src/lib/`: Utilities (Supabase client, helpers)
- `/supabase/`: Migrations and Edge Functions

## Important Context
- This is a 100% cloud system - no Docker, no local installation
- Document extraction supports PDF, DOCX, TXT
- The system guides users step-by-step through the ECP generation process
- All AI calls are logged for audit and debugging

## Current Status
- ✅ Database with RLS, document upload UI, token monitoring, Edge Functions
- 🚧 Pending: Frontend-backend integration, auth system, output saving, logs dashboard

## When Working on This Project
1. Always check token limits when handling documents
2. Maintain RLS policies when adding database queries
3. Follow the guided setup philosophy - don't automate user choices
4. Test Edge Functions locally before deploying
5. Keep grounding strict - AI should only use provided context
