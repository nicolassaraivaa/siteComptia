import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from 'ts-fsrs'
import Fim from './components/Fim'
import Home from './components/Home'
import Login from './components/Login'
import NovaSenha from './components/NovaSenha'
import Revisao from './components/Revisao'
import { diaSP, type Filtro } from './lib/fila'
import { calcularOfensiva, carregarDias, diasDoProgresso, registrarDia } from './lib/ofensiva'
import { carregarProgresso, type ProgressoMap } from './lib/progresso'
import { supabase } from './lib/supabase'

type Tela = 'home' | 'revisao' | 'fim'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)
  const [progresso, setProgresso] = useState<ProgressoMap | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [tela, setTela] = useState<Tela>('home')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [dias, setDias] = useState<Set<string>>(new Set())
  const diasSalvos = useRef<Set<string>>(new Set()) // dias já gravados na tabela atividade

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((evt, s) => {
      // chegou pelo link de "esqueci minha senha": pede a nova senha antes de abrir o app
      if (evt === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const carregar = useCallback(() => {
    setErroCarga(null)
    setProgresso(null)
    const diasP = carregarDias().catch((e: Error) => {
      console.warn('Ofensiva indisponível:', e.message)
      return new Set<string>()
    })
    Promise.all([carregarProgresso(), diasP])
      .then(([prog, salvos]) => {
        diasSalvos.current = salvos
        setDias(new Set([...salvos, ...diasDoProgresso(prog)]))
        setProgresso(prog)
      })
      .catch((e: Error) => setErroCarga(e.message))
  }, [])

  useEffect(() => {
    if (userId) carregar()
    else setProgresso(null)
  }, [userId, carregar])

  const onSalvo = useCallback(
    (cardId: string, card: Card) => {
      const now = new Date()
      setProgresso((prev) => {
        const next = new Map(prev)
        next.set(cardId, { card, createdAt: prev?.get(cardId)?.createdAt ?? now, updatedAt: now })
        return next
      })
      const hoje = diaSP(now)
      setDias((prev) => (prev.has(hoje) ? prev : new Set(prev).add(hoje)))
      if (userId && !diasSalvos.current.has(hoje)) {
        diasSalvos.current.add(hoje)
        registrarDia(userId, hoje).catch((e: Error) => {
          diasSalvos.current.delete(hoje) // tenta de novo na próxima revisão
          console.warn('Falha ao registrar ofensiva:', e.message)
        })
      }
    },
    [userId],
  )

  const ofensiva = useMemo(() => calcularOfensiva(dias, diaSP(new Date())), [dias])

  if (session === undefined) return <Centro>Carregando…</Centro>
  if (!session || !userId) return <Login />
  if (recuperandoSenha) return <NovaSenha onPronto={() => setRecuperandoSenha(false)} />

  if (erroCarga) {
    return (
      <Centro>
        <p className="mb-1 font-bold">Não foi possível carregar seu progresso</p>
        <p className="mb-6 max-w-sm text-sm text-muted">{erroCarga}. Verifique a conexão e tente de novo.</p>
        <button
          onClick={carregar}
          className="foco rounded-2xl bg-primary px-6 py-3 font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          Tentar de novo
        </button>
      </Centro>
    )
  }
  if (!progresso) return <Centro>Carregando progresso…</Centro>

  if (tela === 'revisao') {
    return (
      <Revisao
        userId={userId}
        progresso={progresso}
        filtro={filtro}
        onSalvo={onSalvo}
        onFim={() => setTela('fim')}
        onSair={() => setTela('home')}
      />
    )
  }
  if (tela === 'fim') {
    return <Fim progresso={progresso} filtro={filtro} ofensiva={ofensiva} onVoltar={() => setTela('home')} />
  }

  return (
    <Home
      email={session.user.email ?? ''}
      progresso={progresso}
      ofensiva={ofensiva}
      filtro={filtro}
      onFiltro={setFiltro}
      onComecar={() => setTela('revisao')}
    />
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center text-muted" aria-live="polite">
      {children}
    </div>
  )
}
