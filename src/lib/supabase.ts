import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Trade = {
  id: string
  user_id: string
  symbol: string
  side: 'BUY' | 'SELL'
  option_side: 'CALL' | 'PUT'
  asset: string
  quantity: number
  entry_price: number
  strike_price: number
  expiry_date: number
  status: 'OPEN' | 'CLOSED'
  exit_price?: number
  exit_time?: string
  created_at: string
}

export type PnlSnapshot = {
  id: string
  user_id: string
  total_pnl: number
  snapshot_at: string
}
