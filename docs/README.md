# ECP Generator Documentation

Welcome to the ECP Generator documentation. This directory contains all project documentation organized by category.

## 📚 Documentation Index

### 🚀 Setup & Configuration
Get started with the ECP Generator:
- **[installation.md](setup/installation.md)** - Initial setup requirements and steps
- **[api-keys.md](setup/api-keys.md)** - How to configure API keys (Gemini, Supabase)
- **[environment.md](setup/environment.md)** - Environment variable configuration for Vercel
- **[vercel-blob.md](setup/vercel-blob.md)** - Vercel Blob storage setup guide

### ☁️ Deployment
Deploy the application to production:
- **[cloud-deployment.md](deployment/cloud-deployment.md)** - Complete cloud deployment guide (Vercel + Supabase)

### 🏗️ Architecture & Development
Understand the system architecture and development plan:
- **[flow-builder.md](architecture/flow-builder.md)** - System architecture and flow builder design
- **[mvp-plan.md](architecture/mvp-plan.md)** - MVP implementation roadmap and milestones
- **[ai-models.md](architecture/ai-models.md)** - AI models configuration (Gemini 2.0 Flash/Pro)

### 🔧 Troubleshooting
Solutions to common issues:
- **[general.md](troubleshooting/general.md)** - General troubleshooting guide
- **[upload-diagnostics.md](troubleshooting/upload-diagnostics.md)** - Document upload diagnostics
- **[upload-size.md](troubleshooting/upload-size.md)** - File size limit troubleshooting

### 🧪 Testing
Testing strategies and guides:
- **[testing-guide.md](testing/testing-guide.md)** - Testing strategies, test cases, and examples

### 📋 Other Resources
- **[flow_config_example.json](flow_config_example.json)** - Example flow configuration

## Quick Links

### New to the Project?
1. Start with [installation.md](setup/installation.md)
2. Configure your [api-keys.md](setup/api-keys.md)
3. Follow the [cloud-deployment.md](deployment/cloud-deployment.md) guide

### Having Issues?
Check the [troubleshooting](troubleshooting/) directory for solutions.

### Want to Understand the Architecture?
Read [flow-builder.md](architecture/flow-builder.md) and [mvp-plan.md](architecture/mvp-plan.md).

## Contributing to Documentation

When adding or updating documentation:
1. Place files in the appropriate category directory
2. Use descriptive filenames (kebab-case)
3. Update this README.md with new entries
4. Update [.claude/README.md](../.claude/README.md) if adding major sections
5. Keep the main [README.md](../README.md) as the primary entry point

## Documentation Standards

- Use clear, concise headings
- Include code examples where appropriate
- Add step-by-step instructions for complex procedures
- Keep documentation up to date with code changes
- Use relative links for cross-references
