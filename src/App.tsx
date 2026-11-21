import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import AppCertificacao from './AppCertificacao'
import { certificacaoPorId, type Certificacao } from './certificacoes'
import BadgeCertificacao from './components/BadgeCertificacao'
import Castor from './components/Castor'
import Entrada from './components/Entrada'
import Login from './components/Login'
import MinhasCertificacoes from './components/MinhasCertificacoes'
import NovaSenha from './components/NovaSenha'
import { diaSP } from './lib/datas'
import { calcularOfensiva, carregarDias } from './lib/ofensiva'
import { carregarConta, carregarPerfis, CONTA_VAZIA, salvarUltimaCertificacao, type Perfil, type PerfilConta } from './lib/perfil'
import { supabase } from './lib/supabase'
import { carregarTrilha, type ItemTrilha } from './lib/trilha'

/**
 * Onde a pessoa está. Fica na URL (?cert=secplus, ?pagina=certificacoes) para dar para salvar nos
 * favoritos e usar o voltar do navegador. Parâmetros de busca, e não caminhos, para funcionar em
 * qualquer hospedagem sem configurar redirecionamento.
 */
type Rota = { tipo: 'entrada' } | { tipo: 'minhas' } | { tipo: 'cert'; id: string }

function lerRota(): Rota {
  const p = new URLSearchParams(window.location.search)
  const cert = p.get('cert')
  if (cert) return { tipo: 'cert', id: cert }
  if (p.get('pagina') === 'certificacoes') return { tipo: 'minhas' }
  return { tipo: 'entrada' }
}

function urlDa(rota: Rota): string {
  const base = window.location.pathname
  if (rota.tipo === 'cert') return `${base}?cert=${encodeURIComponent(rota.id)}`
  if (rota.tipo === 'minhas') return `${base}?pagina=certificacoes`
  return base
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)
  const [rota, setRota] = useState<Rota>(lerRota)
  const [conta, setConta] = useState<PerfilConta | null>(null)
  // Dados da tela de entrada e de "Minhas certificações" (null = carregando)
  const [perfis, setPerfis] = useState<Map<string, Perfil> | null>(null)
  const [trilha, setTrilha] = useState<ItemTrilha[] | null>(null)
  const [dias, setDias] = useState<Set<string> | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((evt, s) => {
      // chegou pelo link de "esqueci minha senha": pede a nova senha antes de abrir o app
      if (evt === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const voltar = () => setRota(lerRota())
    window.addEventListener('popstate', voltar)
    return () => window.removeEventListener('popstate', voltar)
  }, [])

  const ir = useCallback((nova: Rota) => {
    window.history.pushState(null, '', urlDa(nova))
    setRota(nova)
    window.scrollTo({ top: 0 })
  }, [])

  const userId = session?.user.id

  // Conta (dono, última certificação): uma vez por login
  useEffect(() => {
    setConta(null)
    if (!userId) return
    let vivo = true
    carregarConta()
      .then((c) => vivo && setConta(c))
      .catch((e: Error) => {
        console.warn('Perfil da conta indisponível:', e.message)
        if (vivo) setConta(CONTA_VAZIA)
      })
    return () => {
      vivo = false
    }
  }, [userId])

  // Entrada e "Minhas certificações" recarregam ao abrir: uma certificação pode ter mudado data,
  // resultado, ofensiva ou conquistas enquanto estava aberta
  const foraDaCert = rota.tipo !== 'cert'
  useEffect(() => {
    if (!userId || !foraDaCert) return
    let vivo = true
    setPerfis(null)
    setTrilha(null)
    setDias(null)
    carregarPerfis()
      .then((p) => vivo && setPerfis(p))
      .catch((e: Error) => {
        console.warn('Perfis indisponíveis:', e.message)
        if (vivo) setPerfis(new Map())
      })
    carregarTrilha()
      .then((t) => vivo && setTrilha(t))
      .catch((e: Error) => {
        console.warn('Trilha indisponível:', e.message)
        if (vivo) setTrilha([])
      })
    carregarDias()
      .then((d) => vivo && setDias(d))
      .catch((e: Error) => {
        console.warn('Ofensiva indisponível:', e.message)
        if (vivo) setDias(new Set())
      })
    return () => {
      vivo = false
    }
  }, [userId, foraDaCert])

  const escolher = useCallback(
    (cert: Certificacao) => {
      if (!userId) return
      setConta((c) => (c ? { ...c, ultima_certificacao: cert.id } : c))
      salvarUltimaCertificacao(userId, cert.id).catch((e: Error) =>
        console.warn('Falha ao lembrar a última certificação:', e.message),
      )
      ir({ tipo: 'cert', id: cert.id })
    },
    [userId, ir],
  )

  if (session === undefined) return <Centro>Carregando…</Centro>
  if (!session || !userId) return <Login />
  if (recuperandoSenha) return <NovaSenha onPronto={() => setRecuperandoSenha(false)} />
  if (!conta) return <Centro>Carregando…</Centro>

  const email = session.user.email ?? ''

  if (rota.tipo === 'cert') {
    const cert = certificacaoPorId(rota.id)
    if (!cert || !cert.disponivel) return <EmBreve cert={cert} onVoltar={() => ir({ tipo: 'entrada' })} />
    return (
      <AppCertificacao
        // remonta ao trocar de certificação ou de conta: nada de uma vaza para a outra
        key={`${userId}:${cert.id}`}
        email={email}
        userId={userId}
        cert={cert}
        conta={conta}
        onTrocar={() => ir({ tipo: 'entrada' })}
        onMinhas={() => ir({ tipo: 'minhas' })}
      />
    )
  }

  if (!perfis || !trilha || !dias) return <Centro>Carregando…</Centro>

  if (rota.tipo === 'minhas') {
    return (
      <MinhasCertificacoes
        userId={userId}
        trilha={trilha}
        onTrilha={setTrilha}
        onTreinar={escolher}
        onVoltar={() => ir({ tipo: 'entrada' })}
      />
    )
  }

  return (
    <Entrada
      email={email}
      perfis={perfis}
      ultima={conta.ultima_certificacao}
      trilha={trilha}
      ofensiva={calcularOfensiva(dias, diaSP(new Date()))}
      onEscolher={escolher}
      onMinhas={() => ir({ tipo: 'minhas' })}
    />
  )
}

/** Certificação ainda sem banco de questões (ou endereço que não existe) */
function EmBreve({ cert, onVoltar }: { cert: Certificacao | null; onVoltar: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 py-10 text-center">
      {cert ? <BadgeCertificacao cert={cert} tamanho={96} apagado /> : <Castor pose="pensando" tamanho={120} />}
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{cert ? `${cert.nomeCurto} em breve` : 'Página não encontrada'}</h1>
      <p className="mt-2 text-muted">
        {cert
          ? 'O banco de questões desta certificação ainda está sendo preparado.'
          : 'Essa certificação não existe no app.'}
      </p>
      <button
        onClick={onVoltar}
        className="foco mt-8 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
      >
        Escolher certificação
      </button>
    </main>
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center text-muted" aria-live="polite">
      {children}
    </div>
  )
}
