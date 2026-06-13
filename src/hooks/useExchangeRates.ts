import { useQuery } from '@tanstack/react-query'

export const SUPPORTED_CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'BDT', label: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
]

// Fallback rates relative to USD (approximate, used if API unavailable)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, BDT: 110, CNY: 7.25, AED: 3.67,
  EUR: 0.92, GBP: 0.79, SGD: 1.35, THB: 35.5,
}

interface RatesResponse {
  rates: Record<string, number>
  base: string
  time_last_update_unix: number
}

export function useExchangeRates(baseCurrency = 'USD') {
  return useQuery<Record<string, number>>({
    queryKey: ['exchange-rates', baseCurrency],
    queryFn: async () => {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`)
        if (!res.ok) throw new Error('API unavailable')
        const json: RatesResponse = await res.json()
        return json.rates
      } catch {
        // Convert fallback rates to requested base
        const baseToUsd = FALLBACK_RATES[baseCurrency] ?? 1
        const result: Record<string, number> = {}
        for (const [code, rate] of Object.entries(FALLBACK_RATES)) {
          result[code] = rate / baseToUsd
        }
        return result
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60,
  })
}

export function convertAmount(amount: number, rates: Record<string, number> | undefined, toCurrency: string): number {
  if (!rates || !rates[toCurrency]) return 0
  return amount * rates[toCurrency]
}

export function formatWithSymbol(amount: number, currencyCode: string): string {
  const cur = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${cur?.symbol ?? currencyCode} ${formatted}`
}
