# ECP Generator Dev Container

This development container provides a complete environment for working on the ECP Generator project with Claude Code integration.

## What's Included

### Base Image
- **Image**: Microsoft's TypeScript-Node dev container (Node 20 on Debian Bookworm)
- **Runtime**: Node.js 20.x with npm

### Pre-installed Tools
- **Git**: Version control
- **GitHub CLI**: Command-line GitHub operations
- **Supabase CLI**: Database migrations and Edge Functions deployment
- **Claude Code**: AI-powered development assistant (CLI + VSCode extension)

### VSCode Extensions
- **Anthropic.claude-code**: Claude Code AI assistant
- **dbaeumer.vscode-eslint**: ESLint integration
- **esbenp.prettier-vscode**: Code formatting
- **bradlc.vscode-tailwindcss**: Tailwind CSS IntelliSense
- **ms-vscode.vscode-typescript-next**: Latest TypeScript features
- **supabase.supabase-vscode**: Supabase integration
- **unifiedjs.vscode-mdx**: MDX support
- **eamodio.gitlens**: Git visualization

## Ports

The following ports are automatically forwarded:

- **3000**: Next.js development server
- **54321**: Supabase local instance

## Setup

### First Time Setup

When you open this project in a dev container for the first time:

1. **Wait for installation** - The `postCreateCommand` will automatically:
   - Install npm dependencies
   - Install Supabase CLI globally
   - Install Claude Code CLI globally

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Link to Supabase** (if using Supabase Cloud):
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Start development**:
   ```bash
   npm run dev
   ```

### Using Claude Code

Claude Code is pre-configured with project-specific context and custom commands.

**VSCode Extension**: Access via the Claude icon in the sidebar

**CLI Usage**:
```bash
claude "Help me understand the database schema"
claude "Deploy the Edge Functions"
```

**Custom Slash Commands** (in VSCode):
- `/deploy` - Deploy Supabase Edge Functions
- `/test-upload` - Test document upload API
- `/check-db` - Review database schema and RLS
- `/analyze-tokens` - Check token usage
- `/review-docs` - Review project documentation
- `/setup-env` - Environment setup guide

## Development Workflow

### Standard Development
```bash
npm run dev              # Start Next.js (http://localhost:3000)
npm run build            # Build for production
npm run lint             # Run linter
```

### Supabase Development
```bash
npm run supabase:deploy         # Deploy all functions
npm run supabase:logs           # View function logs
supabase db push                # Push migrations
supabase functions serve        # Test functions locally
```

### With Claude Code
Use Claude Code for:
- Understanding complex code
- Writing new features
- Debugging issues
- Reviewing pull requests
- Generating tests
- Refactoring code

## Configuration Files

### `.claude/`
Contains Claude Code configuration:
- `instructions.md` - Project context and guidelines
- `commands/` - Custom slash commands
- `QUICK_REFERENCE.md` - Quick reference guide
- `settings.local.json` - Local permissions

### `.claudeignore`
Excludes unnecessary files from Claude Code context:
- node_modules
- Build outputs (.next, dist)
- Cache files
- Environment files
- Large lock files

## Optimizations

This dev container includes several optimizations:

1. **File Exclusions**: node_modules, .next, and .git are hidden from explorer
2. **Search Exclusions**: Lock files and build outputs excluded from search
3. **Watcher Exclusions**: Reduces CPU usage by not watching large directories
4. **Claude Ignore**: Improves Claude Code performance by skipping irrelevant files

## Troubleshooting

### Supabase CLI Not Found
```bash
npm install -g supabase
```

### Claude Code Not Working
1. Check the extension is installed: Look for "Claude Code" in extensions
2. Verify API key is configured
3. Check `.claude/settings.local.json` for permissions

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use a different port
PORT=3001 npm run dev
```

### Slow Performance
1. Rebuild container: **Dev Containers: Rebuild Container**
2. Check if file watchers are overwhelming the system
3. Verify `.claudeignore` is properly configured

## Resources

- [Dev Containers Documentation](https://containers.dev)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Next.js Documentation](https://nextjs.org/docs)

## Notes

- The container runs as the `node` user (non-root)
- All tools are installed globally during container creation
- Environment variables must be set in `.env` (not tracked in git)
- Claude Code settings are stored in `.claude/settings.local.json`
- You'll need to run `supabase login` inside the container the first time
