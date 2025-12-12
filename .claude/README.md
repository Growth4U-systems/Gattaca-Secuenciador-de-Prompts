# Claude Code Configuration

This directory contains Claude Code configuration and custom commands for the ECP Generator project.

## Files

### `instructions.md`
Custom instructions that provide Claude with context about this project, including:
- Project architecture and technology stack
- Database schema and security model
- AI system configuration and token limits
- Development guidelines and common tasks

### `settings.local.json`
Local settings for Claude Code permissions and preferences.

### `.claudeignore`
Specifies files and directories that Claude Code should ignore for better performance.

## Custom Commands

Use these slash commands in Claude Code for common tasks:

- `/deploy` - Deploy Supabase Edge Functions and verify deployment
- `/test-upload` - Test the document upload API endpoint
- `/check-db` - Review database schema and RLS policies
- `/analyze-tokens` - Analyze token usage across documents and campaigns
- `/review-docs` - Review project documentation and suggest improvements
- `/setup-env` - Guide through environment setup and configuration

## Usage Tips

1. **Start new sessions** by referencing the instructions: "Review the project context"
2. **Use slash commands** for common workflows instead of explaining tasks
3. **Keep instructions updated** as the project evolves
4. **Add new commands** for repetitive tasks you do frequently

## Documentation Structure

Project documentation is organized in the [docs/](../docs/) directory:

### Setup & Configuration
- [installation.md](../docs/setup/installation.md) - Initial setup steps
- [api-keys.md](../docs/setup/api-keys.md) - API key configuration
- [environment.md](../docs/setup/environment.md) - Vercel environment setup
- [vercel-blob.md](../docs/setup/vercel-blob.md) - Vercel Blob storage setup

### Deployment
- [cloud-deployment.md](../docs/deployment/cloud-deployment.md) - Full cloud deployment guide

### Architecture & Development
- [flow-builder.md](../docs/architecture/flow-builder.md) - System architecture
- [mvp-plan.md](../docs/architecture/mvp-plan.md) - Implementation roadmap
- [ai-models.md](../docs/architecture/ai-models.md) - AI models configuration

### Troubleshooting
- [general.md](../docs/troubleshooting/general.md) - Common issues and solutions
- [upload-diagnostics.md](../docs/troubleshooting/upload-diagnostics.md) - Upload diagnostics
- [upload-size.md](../docs/troubleshooting/upload-size.md) - File size troubleshooting

### Testing
- [testing-guide.md](../docs/testing/testing-guide.md) - Testing strategies and test cases

## Best Practices

1. **Always read instructions.md first** when starting work on a new feature
2. **Update documentation** when you make significant architectural changes
3. **Test locally** before deploying to production
4. **Check token limits** when working with documents
5. **Maintain RLS policies** when modifying database schema
