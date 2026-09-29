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
      setErro(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos. Confira e tente de novo.'
          : error.message,
      )
      setEntrando(false)
    }
    // sucesso: onAuthStateChange no App troca de tela
  }

  const input =
    'foco w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-ink'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Sec+ Flashcards</h1>
      <p className="mt-1 mb-8 text-muted">Revisão para a SY0-701, prova em 17 de outubro.</p>

      <form onSubmit={entrar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            spellCheck={false}
            placeholder="nome@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha" className="text-sm font-medium">
            Senha
          </label>
          <input
            id="senha"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={input}
          />
        </div>
        {erro && (
          <p className="text-sm font-medium text-[var(--d2)]" role="alert">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={entrando}
          className="foco mt-2 rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
