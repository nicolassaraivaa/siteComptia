import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'enviando' | 'enviado'>('idle')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setStatus('enviando')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setErro(error.message)
      setStatus('idle')
    } else {
      setStatus('enviado')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold">Sec+ Flashcards</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">SY0-701 · prova em 17/10/2026</p>
      {status === 'enviado' ? (
        <p className="rounded-lg bg-green-100 p-4 text-green-900 dark:bg-green-900/40 dark:text-green-100">
          Link enviado para <strong>{email}</strong>. Abra o email e toque no link.
        </p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={status === 'enviando'}
            className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {status === 'enviando' ? 'Enviando…' : 'Enviar link'}
          </button>
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        </form>
      )}
    </div>
  )
}
