import { useState } from 'react'
import { DATA_PROVA_TEXTO } from '../config'
import { supabase } from '../lib/supabase'

type Modo = 'entrar' | 'criar' | 'recuperar'

const MIN_SENHA = 6

function traduzirErro(msg: string): string {
  if (msg === 'Invalid login credentials') return 'Email ou senha incorretos. Confira e tente de novo.'
  if (msg === 'Email not confirmed') return 'Confirme seu email pelo link que enviamos antes de entrar.'
  if (msg === 'User already registered') return 'Já existe uma conta com esse email. Use "Entrar".'
  if (/signups not allowed/i.test(msg)) return 'Novos cadastros estão desativados neste projeto.'
  return msg
}

export default function Login() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const criando = modo === 'criar'
  const recuperando = modo === 'recuperar'

  function irPara(m: Modo) {
    setModo(m)
    setErro(null)
    setAviso(null)
    setConfirmacao('')
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)

    if (criando) {
      if (senha.length < MIN_SENHA) return setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`)
      if (senha !== confirmacao) return setErro('As senhas não conferem. Digite a mesma senha nos dois campos.')
    }

    setEnviando(true)
    if (recuperando) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) setErro(traduzirErro(error.message))
      else {
        setAviso(`Se existir uma conta com ${email.trim()}, enviamos um link para criar uma nova senha. Abra o email e toque no link.`)
        setModo('entrar')
      }
    } else if (criando) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setErro(traduzirErro(error.message))
      else if (!data.session) {
        // projeto exige confirmação de email: a sessão só existe depois do clique no link
        setAviso(`Conta criada. Abra o email enviado para ${email.trim()} e confirme para poder entrar.`)
        setModo('entrar')
        setConfirmacao('')
      }
      // com sessão: onAuthStateChange no App troca de tela
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) setErro(traduzirErro(error.message))
      // sucesso: onAuthStateChange no App troca de tela
    }
    setEnviando(false)
  }

  const input =
    'foco w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-ink'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Sec+ Flashcards</h1>
      <p className="mt-1 mb-8 text-muted">
        {criando
          ? 'Crie sua conta para salvar o progresso.'
          : recuperando
            ? 'Informe seu email e enviaremos um link para criar uma nova senha.'
            : `Revisão para a SY0-701, prova em ${DATA_PROVA_TEXTO}.`}
      </p>

      <form onSubmit={enviar} className="flex flex-col gap-4">
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
        {!recuperando && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="senha" className="text-sm font-medium">
                Senha
              </label>
              {modo === 'entrar' && (
                <button
                  type="button"
                  onClick={() => irPara('recuperar')}
                  className="foco rounded text-sm text-muted underline underline-offset-2 hover:text-ink"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <input
              id="senha"
              name="password"
              type="password"
              required
              minLength={criando ? MIN_SENHA : undefined}
              autoComplete={criando ? 'new-password' : 'current-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={input}
            />
            {criando && <p className="text-xs text-muted">Pelo menos {MIN_SENHA} caracteres.</p>}
          </div>
        )}
        {criando && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmacao" className="text-sm font-medium">
              Confirme a senha
            </label>
            <input
              id="confirmacao"
              name="password-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className={input}
            />
          </div>
        )}

        <div aria-live="polite">
          {erro && <p className="text-sm font-medium text-[var(--d2)]">{erro}</p>}
          {aviso && <p className="text-sm font-medium text-[var(--good)]">{aviso}</p>}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="foco rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {enviando
            ? criando
              ? 'Criando conta…'
              : recuperando
                ? 'Enviando link…'
                : 'Entrando…'
            : criando
              ? 'Criar conta'
              : recuperando
                ? 'Enviar link'
                : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {modo === 'entrar' ? 'Ainda não tem conta?' : recuperando ? 'Lembrou a senha?' : 'Já tem conta?'}{' '}
        <button
          onClick={() => irPara(modo === 'entrar' ? 'criar' : 'entrar')}
          className="foco rounded font-medium text-ink underline underline-offset-2"
        >
          {modo === 'entrar' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
    </main>
  )
}
