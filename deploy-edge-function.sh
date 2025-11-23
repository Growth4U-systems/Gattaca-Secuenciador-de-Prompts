#!/bin/bash

# Script para redesplegar la Edge Function con Gemini 2.5 Pro
# Este script asegura que el modelo correcto se despliegue

echo "🚀 Redesplegando execute-flow-step con Gemini 2.5 Pro..."
echo ""

# Verificar que el archivo tenga el modelo correcto
echo "📋 Verificando el código..."
if grep -q "gemini-2.5-pro-002" supabase/functions/execute-flow-step/index.ts; then
    echo "✅ Código verificado: Gemini 2.5 Pro encontrado"
else
    echo "❌ ERROR: El código no tiene Gemini 2.5 Pro"
    echo "   El archivo debe contener: gemini-2.5-pro-002"
    exit 1
fi

echo ""
echo "🔄 Iniciando deploy..."
echo ""

# Deploy de la función
npx supabase functions deploy execute-flow-step --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy completado exitosamente!"
    echo ""
    echo "📊 Verificando el modelo deployado..."
    echo ""
    echo "Ejecuta una campaña de prueba y verifica que el error ya no aparezca."
    echo ""
    echo "Si funciona correctamente, deberías ver:"
    echo "  ✅ model_used: gemini-2.5-pro-002"
    echo ""
else
    echo ""
    echo "❌ Deploy falló. Errores posibles:"
    echo "  1. No estás loggeado: npx supabase login"
    echo "  2. Proyecto no vinculado: npx supabase link --project-ref TU_PROJECT_REF"
    echo "  3. Sin permisos para deployar"
    echo ""
    exit 1
fi
