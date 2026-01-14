---
description: Merge current PR and monitor Vercel deployment
---

# Merge PR and Monitor Deploy

Merge el PR actual y monitorea el deploy de Vercel.

## Steps

1. Obtener el PR actual de la rama
2. Hacer merge del PR
3. Esperar 1 minuto para que Vercel inicie el build
4. Verificar el estado del deploy en Vercel
5. Notificar al usuario cuando esté listo o si hay errores

## Commands

```bash
# Get current branch PR
gh pr view --json number,title,state

# Merge the PR
gh pr merge --squash --delete-branch

# Wait for Vercel build
sleep 60

# Check Vercel deployment status
gh api repos/{owner}/{repo}/deployments --jq '.[0] | {state: .state, environment: .environment, created_at: .created_at}'
```

## Output

Notificar:
- Si el merge fue exitoso
- El estado del deploy de Vercel
- La URL del deploy si está disponible
