'use client';

import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Trash2, Save, ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui';

interface ApiKeyRecord {
  id: string;
  service_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  masked_key: string;
}

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
    description: 'Scraping de redes sociales (TikTok, Instagram, LinkedIn, Trustpilot)',
    docsUrl: 'https://console.apify.com/account/integrations',
    placeholder: 'apify_api_xxxxxxxxxxxx',
  },
  firecrawl: {
    name: 'firecrawl',
    label: 'Firecrawl',
    description: 'Scraping de sitios web',
    docsUrl: 'https://www.firecrawl.dev/app/api-keys',
    placeholder: 'fc-xxxxxxxxxxxx',
  },
  serper: {
    name: 'serper',
    label: 'Serper',
    description: 'Búsquedas en Google (SERP) para el Buscador de Nichos - $0.004/query',
    docsUrl: 'https://serper.dev/api-key',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  openrouter: {
    name: 'openrouter',
    label: 'OpenRouter',
    description: 'IA para sugerencias y Deep Search (usa Perplexity Sonar internamente)',
    docsUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-xxxxxxxxxxxx',
  },
};

export default function ApiKeysConfig() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch existing keys
  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/api-keys');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch keys');
      }

      setKeys(data.keys || []);
      setAvailableServices(data.available_services || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Error', 'No se pudieron cargar las API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Save a new key
  const handleSave = async (serviceName: string) => {
    if (!newKeyValue.trim()) {
      toast.warning('Campo vacío', 'Ingresa una API key válida');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: serviceName,
          api_key: newKeyValue.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save key');
      }

      toast.success('Guardado', `API key de ${SERVICE_INFO[serviceName]?.label || serviceName} guardada`);
      setEditingService(null);
      setNewKeyValue('');
      setShowKey(false);
      fetchKeys();
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Error', error instanceof Error ? error.message : 'No se pudo guardar la API key');
    } finally {
      setSaving(false);
    }
  };

  // Delete a key
  const handleDelete = async (serviceName: string) => {
    try {
      setDeleting(serviceName);
      const response = await fetch(`/api/user/api-keys?service_name=${serviceName}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete key');
      }

      toast.success('Eliminado', `API key de ${SERVICE_INFO[serviceName]?.label || serviceName} eliminada`);
      fetchKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Error', 'No se pudo eliminar la API key');
    } finally {
      setDeleting(null);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingService(null);
    setNewKeyValue('');
    setShowKey(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">API Keys</h3>
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Key className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">API Keys</h3>
          <p className="text-sm text-gray-500">Configura tus propias claves para los servicios de scraping</p>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">¿Por qué configurar mis propias API keys?</p>
            <p className="text-blue-700">
              Si no configuras tus keys, se usarán las del sistema (compartidas). Con tus propias keys
              tienes mayor control sobre el uso y los costos.
            </p>
          </div>
        </div>
      </div>

      {/* Configured keys */}
      <div className="space-y-4">
        {keys.map((key) => {
          const info = SERVICE_INFO[key.service_name];
          const isEditing = editingService === key.service_name;

          return (
            <div
              key={key.id}
              className={`border rounded-lg p-4 transition-colors ${
                isEditing ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{info?.label || key.service_name}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Configurado
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{info?.description}</p>

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder={info?.placeholder || 'Nueva API key...'}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(key.service_name)}
                          disabled={saving}
                          className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-1" />
                          )}
                          Guardar
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <code className="bg-gray-100 px-2 py-0.5 rounded">{key.masked_key}</code>
                      <span>·</span>
                      <span>Actualizado {new Date(key.updated_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingService(key.service_name);
                        setNewKeyValue('');
                      }}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Actualizar key"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(key.service_name)}
                      disabled={deleting === key.service_name}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Eliminar key"
                    >
                      {deleting === key.service_name ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Available services (not yet configured) */}
        {availableServices.map((serviceName) => {
          const info = SERVICE_INFO[serviceName];
          const isEditing = editingService === serviceName;

          return (
            <div
              key={serviceName}
              className={`border rounded-lg p-4 transition-colors ${
                isEditing ? 'border-purple-300 bg-purple-50' : 'border-dashed border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{info?.label || serviceName}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      No configurado
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{info?.description}</p>

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder={info?.placeholder || 'Tu API key...'}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(serviceName)}
                          disabled={saving}
                          className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-1" />
                          )}
                          Guardar
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                        {info?.docsUrl && (
                          <a
                            href={info.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-purple-600 text-sm font-medium hover:bg-purple-50 rounded-lg"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Obtener key
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingService(serviceName);
                        setNewKeyValue('');
                      }}
                      className="mt-2 inline-flex items-center px-3 py-1.5 text-purple-600 text-sm font-medium hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <Key className="w-4 h-4 mr-1" />
                      Configurar
                    </button>
                  )}
                </div>

                {!isEditing && info?.docsUrl && (
                  <a
                    href={info.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Ver documentación"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
