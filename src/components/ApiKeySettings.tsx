import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Check, Trash2, Shield, AlertTriangle, Loader2, Server } from 'lucide-react'
import { saveCredentials, clearCredentials, hasCredentials, loadCredentials } from '../lib/binanceAuth'
import { fetchOptionAccount } from '../lib/binancePrivate'

const IS_PROD = import.meta.env.PROD

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

export function ApiKeySettings({ onChange }: { onChange?: () => void }) {
  const already    = hasCredentials()
  const existing   = loadCredentials()

  const [apiKey,    setApiKey]    = useState(existing?.apiKey    ?? '')
  const [apiSecret, setApiSecret] = useState(existing?.apiSecret ?? '')
  const [showKey,   setShowKey]   = useState(false)
  const [showSec,   setShowSec]   = useState(false)
  const [testStatus, setTest]     = useState<TestStatus>('idle')
  const [testMsg,    setTestMsg]  = useState('')
  const [saved,      setSaved]    = useState(already)

  async function handleTest() {
    if (!apiKey || !apiSecret) return
    setTest('testing')
    setTestMsg('')
    try {
      saveCredentials({ apiKey, apiSecret })
      const acct = await fetchOptionAccount()
      const usdt = acct.asset?.find(a => a.asset === 'USDT')
      setTest('ok')
      setTestMsg(usdt
        ? `Connected ✓  Equity: $${Number(usdt.equity).toFixed(2)} USDT`
        : 'Connected ✓  Account verified')
      setSaved(true)
      onChange?.()
    } catch (e) {
      clearCredentials()
      setSaved(false)
      setTest('fail')
      setTestMsg((e as Error).message)
    }
  }

  function handleClear() {
    clearCredentials()
    setApiKey('')
    setApiSecret('')
    setSaved(false)
    setTest('idle')
    setTestMsg('')
    onChange?.()
  }


  // Production: show Vercel env var instructions — no browser key entry needed
  if (IS_PROD) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" />
          <p className="text-sm font-semibold text-white">Binance API Key</p>
        </div>

        <div className="rounded-xl bg-indigo-950/40 border border-indigo-800/30 p-4 space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed">
            Your API key is stored securely as a <span className="text-white font-medium">Vercel environment variable</span> — never in the browser. The server signs all requests before they reach Binance.
          </p>
        </div>

        <div className="rounded-xl bg-[#0d0d20] border border-[#1e1e3f] p-4 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">How to connect</p>
          {[
            { n: '1', text: 'Go to vercel.com → your OChain project → Settings → Environment Variables' },
            { n: '2', text: 'Add BINANCE_API_KEY → paste your Binance API key' },
            { n: '3', text: 'Add BINANCE_API_SECRET → paste your secret' },
            { n: '4', text: 'Click Save, then Redeploy the project for changes to take effect' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3 text-xs text-slate-400">
              <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">{s.n}</span>
              {s.text}
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-amber-950/30 border border-amber-800/25 p-3">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Permissions</p>
          <p className="text-xs text-slate-400">Enable <span className="text-white">Read Info</span> only. No IP restriction needed — the server IP is fixed.</p>
        </div>

        <button onClick={async () => {
          setTest('testing')
          try {
            await fetchOptionAccount()
            setTest('ok')
            setTestMsg('Connected ✓  Environment variables are set correctly')
          } catch (e) {
            setTest('fail')
            setTestMsg((e as Error).message)
          }
        }} disabled={testStatus === 'testing'}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
          {testStatus === 'testing' ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</> : testStatus === 'ok' ? <><Check className="w-4 h-4" /> Verified</> : 'Test Connection'}
        </button>

        <AnimatePresence>
          {testMsg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`rounded-xl px-3 py-2.5 text-xs flex items-start gap-2 ${
                testStatus === 'ok' ? 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-300' : 'bg-red-950/50 border border-red-800/40 text-red-300'
              }`}>
              {testStatus === 'ok' ? <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
              <span className="font-mono leading-relaxed">{testMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Binance API Key</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Stored locally on this device only</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-800/30 px-2 py-1 rounded-full">
            <Check className="w-2.5 h-2.5" /> Connected
          </span>
        )}
      </div>

      {/* Security notice */}
      <div className="rounded-xl bg-indigo-950/40 border border-indigo-800/30 p-3 flex gap-2">
        <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-slate-400 leading-relaxed space-y-1.5">
          <p>Your keys are stored in <span className="text-white">localStorage</span> on this device and sent <span className="text-white">directly to Binance</span> over HTTPS — OChain never sees them.</p>
          <p className="text-amber-300/90">Use a <span className="text-white">Read Info only</span> key. Do not enable withdrawals or trading permissions — this keeps your funds safe even if the key is ever exposed.</p>
        </div>
      </div>

      {/* IP restriction explanation */}
      <div className="rounded-xl bg-amber-950/30 border border-amber-800/25 p-3 flex gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-slate-400 leading-relaxed space-y-1">
          <p className="font-semibold text-amber-400">Don't set IP restrictions for this app</p>
          <p>IP restriction only works when calls come from a fixed server. OChain calls Binance directly from your device — your IP changes between mobile data, home WiFi, and other networks. Whitelisting one IP would lock you out on all others. <span className="text-white">Limiting key permissions to Read Info is sufficient protection.</span></p>
        </div>
      </div>

      {/* API Key field */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setSaved(false); setTest('idle') }}
            placeholder="Enter your Binance API key…"
            className="w-full bg-[#0d0d20] border border-[#1e1e3f] focus:border-indigo-500 rounded-xl px-3 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none pr-10"
          />
          <button onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Secret field */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">API Secret</label>
        <div className="relative">
          <input
            type={showSec ? 'text' : 'password'}
            value={apiSecret}
            onChange={e => { setApiSecret(e.target.value); setSaved(false); setTest('idle') }}
            placeholder="Enter your API secret…"
            className="w-full bg-[#0d0d20] border border-[#1e1e3f] focus:border-indigo-500 rounded-xl px-3 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none pr-10"
          />
          <button onClick={() => setShowSec(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showSec ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Test result */}
      <AnimatePresence>
        {testMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-xl px-3 py-2.5 text-xs flex items-start gap-2 ${
              testStatus === 'ok'
                ? 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-300'
                : 'bg-red-950/50 border border-red-800/40 text-red-300'
            }`}>
            {testStatus === 'ok'
              ? <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
            <span className="font-mono leading-relaxed">{testMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={!apiKey || !apiSecret || testStatus === 'testing'}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
          {testStatus === 'testing'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
            : testStatus === 'ok' ? <><Check className="w-4 h-4" /> Verified</>
            : 'Save & Test'}
        </button>
        {saved && (
          <button onClick={handleClear}
            className="w-11 h-11 rounded-xl bg-red-900/30 border border-red-800/30 flex items-center justify-center text-red-400 hover:bg-red-900/50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Binance key creation guide */}
      <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-3 space-y-1.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">How to create a key</p>
        {[
          { text: 'Binance app or web → Profile → API Management', warn: false },
          { text: 'Create API → "System generated"', warn: false },
          { text: 'Enable Read Info only — do NOT enable trading or withdrawals', warn: true },
          { text: 'Leave IP restriction OFF — your device IP changes constantly', warn: true },
          { text: 'Copy API key + secret and paste above', warn: false },
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2 text-[10px]">
            <span className="text-indigo-500 flex-shrink-0 font-bold">{i + 1}.</span>
            <span className={step.warn ? 'text-amber-400' : 'text-slate-400'}>{step.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
