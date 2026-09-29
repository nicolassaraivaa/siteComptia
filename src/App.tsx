import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import type { Card } from 'ts-fsrs'
import Fim from './components/Fim'
import Home from './components/Home'
import Login from './components/Login'
import Revisao from './components/Revisao'
import type { Filtro } from './lib/fila'
import { carregarProgresso, type ProgressoMap } from './lib/progresso'
import { supabase } from './lib/supabase'

type Tela = 'home' | 'revisao' | 'fim'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [progresso, setProgresso] = useState<ProgressoMap | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [tela, setTela] = useState<Tela>('home')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const carregar = useCallback(() => {
    setErroCarga(null)
    setProgresso(null)
    carregarProgresso()
      .then(setProgresso)
      .catch((e: Error) => setErroCarga(e.message))
  }, [])

  useEffect(() => {
    if (userId) carregar()
    else setProgresso(null)
  }, [userId, carregar])

  const onSalvo = useCallback((cardId: string, card: Card) => {
    setProgresso((prev) => {
      const next = new Map(prev)
      next.set(cardId, { card, createdAt: prev?.get(cardId)?.createdAt ?? new Date() })
      return next
    })
  }, [])

  if (session === undefined) return <Centro>Carregando…</Centro>
  if (!session || !userId) return <Login />

  if (erroCarga) {
    return (
      <Centro>
        <p className="mb-4 text-red-600 dark:text-red-400">Erro ao carregar progresso: {erroCarga}</p>
        <button onClick={carregar} className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white">
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
  if (tela === 'fim') return <Fim progresso={progresso} filtro={filtro} onVoltar={() => setTela('home')} />

  return (
    <Home
      email={session.user.email ?? ''}
      progresso={progresso}
      filtro={filtro}
      onFiltro={setFiltro}
      onComecar={() => setTela('revisao')}
    />
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center">{children}</div>
}
