import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEntrando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message)
      setEntrando(false)
    }
    // sucesso: onAuthStateChange no App troca de tela
  }

  const input =
    'rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900'

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold">Sec+ Flashcards</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">SY0-701 · prova em 17/10/2026</p>
      <form onSubmit={entrar} className="flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={input}
        />
        <button
          type="submit"
          disabled={entrando}
          className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
      </form>
    </div>
  )
}
