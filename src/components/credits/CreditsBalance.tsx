'use client';

import { useState, useEffect } from 'react';
import { Coins, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface PolarCreditsData {
  configured: boolean;
  balance: number;
  consumed: number;
  message?: string;
}

export default function CreditsBalance() {
  const { user } = useAuth();
  const [data, setData] = useState<PolarCreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchCredits = async (showRefresh = false) => {
    if (!user) return;

    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/credits/polar');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCredits();
    }
  }, [user]);

  if (!user) return null;

  const balance = data?.balance ?? 0;
  const consumed = data?.consumed ?? 0;
  const hasCredits = balance > 0;

  // Format as credits (integer or 1 decimal for small amounts)
  const formatCredits = (num: number) => {
    if (num >= 100) return `${num.toFixed(0)}`;
    if (num >= 10) return `${num.toFixed(1)}`;
    if (num >= 1) return `${num.toFixed(2)}`;
    return `${num.toFixed(3)}`; // Small amounts show 3 decimals
  };

  return (
    <div className="relative">
      {/* Credits Badge Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:shadow-sm ${
          hasCredits
            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border border-amber-200'
            : 'bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-150 border border-gray-200'
        }`}
      >
        <Coins className={`w-4 h-4 ${hasCredits ? 'text-amber-600' : 'text-gray-400'}`} />
        {loading ? (
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
        ) : (
          <span className={`text-sm font-semibold ${hasCredits ? 'text-amber-700' : 'text-gray-500'}`}>
            {data?.configured === false ? 'Sin config' : `${formatCredits(balance)} cr`}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                    Balance de Créditos
                  </p>
                  {data?.configured === false ? (
                    <p className="text-sm text-gray-500 mt-1">
                      Polar no configurado
                    </p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-amber-700 mt-1">
                        {formatCredits(balance)} <span className="text-lg">créditos</span>
                      </p>
                      {consumed > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          {formatCredits(consumed)} consumidos
                        </p>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={() => fetchCredits(true)}
                  disabled={refreshing}
                  className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Info */}
            {data?.configured !== false && (
              <div className="p-4 text-sm text-gray-600">
                <p className="font-medium">1 crédito = $1 USD</p>
                <p className="mt-1 text-xs text-gray-400">
                  Se descuentan automáticamente al usar IA, scraping, y búsquedas.
                </p>
              </div>
            )}

            {/* Buy Credits CTA */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <a
                href="https://buy.polar.sh/polar_cl_qh36dS6TvMyuciP4GkmbpRXGxkBgfVwHnVUTo0HWqjm"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-medium rounded-lg transition-all hover:shadow-md"
              >
                <Coins className="w-4 h-4" />
                Comprar créditos
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
