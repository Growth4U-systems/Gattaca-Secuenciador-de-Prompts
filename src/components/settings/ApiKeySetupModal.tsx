'use client';

import { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, ExternalLink, Check, Loader2, ChevronRight } from 'lucide-react';

interface ServiceInfo {
  name: string;
  label: string;
  description: string;
  docsUrl: string;
  placeholder: string;
}

const SERVICE_INFO: Record<string, ServiceInfo> = {
  apify: {
    name: 'apify',
    label: 'Apify',
    description: 'Scraping de redes sociales (TikTok, Instagram, LinkedIn)',
    docsUrl: 'https://console.apify.com/account/integrations',
    placeholder: 'apify_api_xxxxxxxxxxxx',
  },
  firecrawl: {
    name: 'firecrawl',
    label: 'Firecrawl',
    description: 'Scraping de sitios web y foros',
    docsUrl: 'https://www.firecrawl.dev/app/api-keys',
    placeholder: 'fc-xxxxxxxxxxxx',
  },
  serper: {
    name: 'serper',
    label: 'Serper',
    description: 'Busquedas en Google (SERP) - $0.004/query',
    docsUrl: 'https://serper.dev/api-key',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  openrouter: {
    name: 'openrouter',
    label: 'OpenRouter',
    description: 'IA para generacion de contenido y analisis',
    docsUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-xxxxxxxxxxxx',
  },
  wavespeed: {
    name: 'wavespeed',
    label: 'WaveSpeed',
    description: 'Generacion de imagenes con IA',
    docsUrl: 'https://wavespeed.ai/dashboard/api',
    placeholder: 'ws_xxxxxxxxxxxx',
  },
  fal: {
    name: 'fal',
    label: 'Fal.ai',
    description: 'Generacion de video con IA',
    docsUrl: 'https://fal.ai/dashboard/keys',
    placeholder: 'fal_xxxxxxxxxxxx',
  },
  blotato: {
    name: 'blotato',
    label: 'Blotato',
    description: 'Publicación automática a redes sociales (TikTok, Instagram, YouTube, etc.)',
    docsUrl: 'https://my.blotato.com/settings',
    placeholder: 'blotato_xxxxxxxxxxxx',
  },
};

interface ApiKeySetupModalProps {
  missingServices: string[];
  onComplete: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export default function ApiKeySetupModal({
  missingServices,
  onComplete,
  onCancel,
  title = 'Configurar API Keys',
  description = 'Necesitas configurar las siguientes API keys para continuar:',
}: ApiKeySetupModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configuredServices, setConfiguredServices] = useState<string[]>([]);

  const currentService = missingServices[currentIndex];
  const serviceInfo = SERVICE_INFO[currentService];
  const isLastService = currentIndex === missingServices.length - 1;
  const progress = ((currentIndex + configuredServices.length) / missingServices.length) * 100;

  // Reset state when service changes
  useEffect(() => {
    setKeyValue('');
    setShowKey(false);
    setError(null);
  }, [currentIndex]);

  const handleSave = async () => {
    if (!keyValue.trim()) {
      setError('Ingresa una API key valida');
      return;
    }

    if (keyValue.trim().length < 10) {
      setError('La API key parece demasiado corta');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: currentService,
          api_key: keyValue.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error guardando la key');
      }

      // Mark as configured
      setConfiguredServices((prev) => [...prev, currentService]);

      // Move to next or complete
      if (isLastService) {
        onComplete();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando la key');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (isLastService) {
      // If skipping the last one, still call complete (partial config)
      onComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            {missingServices.map((service, index) => {
              const info = SERVICE_INFO[service];
              const isConfigured = configuredServices.includes(service);
              const isCurrent = index === currentIndex;

              return (
                <div key={service} className="flex items-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      isConfigured
                        ? 'bg-green-100 text-green-700'
                        : isCurrent
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isConfigured && <Check className="w-3 h-3 inline mr-1" />}
                    {info?.label || service}
                  </span>
                  {index < missingServices.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current service form */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {serviceInfo?.label || currentService}
            </h3>
            <p className="text-sm text-gray-600">{serviceInfo?.description}</p>
          </div>

          {/* Input */}
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder={serviceInfo?.placeholder || 'Tu API key...'}
                className={`w-full px-4 py-3 pr-10 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm ${
                  error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Get key link */}
            {serviceInfo?.docsUrl && (
              <a
                href={serviceInfo.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
              >
                <ExternalLink className="w-4 h-4" />
                Obtener API key de {serviceInfo.label}
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {isLastService ? 'Cancelar' : 'Omitir este'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !keyValue.trim()}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : isLastService ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Guardar y continuar
              </>
            ) : (
              <>
                Guardar y siguiente
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
