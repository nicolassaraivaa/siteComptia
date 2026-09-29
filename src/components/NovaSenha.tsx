import { useState } from 'react'
import { supabase } from '../lib/supabase'

const MIN_SENHA = 6

/** Aberta quando o usuário chega pelo link de recuperação de senha */
export default function NovaSenha({ onPronto }: { onPronto: () => void }) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < MIN_SENHA) return setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`)
    if (senha !== confirmacao) return setErro('As senhas não conferem. Digite a mesma senha nos dois campos.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) setErro(error.message)
    else onPronto()
  }

  const input =
    'foco w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-ink'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Nova senha</h1>
      <p className="mt-1 mb-8 text-muted">Escolha a senha que você vai usar para entrar.</p>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nova-senha" className="text-sm font-medium">
            Nova senha
          </label>
          <input
            id="nova-senha"
            name="new-password"
            type="password"
            required
            minLength={MIN_SENHA}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={input}
          />
          <p className="text-xs text-muted">Pelo menos {MIN_SENHA} caracteres.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nova-confirmacao" className="text-sm font-medium">
            Confirme a nova senha
          </label>
          <input
            id="nova-confirmacao"
            name="new-password-confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className={input}
          />
        </div>

        <div aria-live="polite">{erro && <p className="text-sm font-medium text-[var(--d2)]">{erro}</p>}</div>

        <button
          type="submit"
          disabled={salvando}
          className="foco rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </main>
  )
}
