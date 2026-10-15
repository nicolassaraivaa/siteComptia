import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from 'ts-fsrs'
import DataProva from './components/DataProva'
import Fim from './components/Fim'
import Home from './components/Home'
import Login from './components/Login'
import NovaSenha from './components/NovaSenha'
import Revisao from './components/Revisao'
import Simulado from './components/Simulado'
import SimuladoCard from './components/SimuladoCard'
import SimuladoResultado from './components/SimuladoResultado'
import { CARDS } from './lib/cards'
import { diaSP, montarBaralho, type Filtro } from './lib/fila'
import type { Stats } from './lib/fsrs'
import { calcularOfensiva, carregarDias, diasDoProgresso, registrarDia } from './lib/ofensiva'
import { carregarPerfil, type Perfil } from './lib/perfil'
import { carregarProgresso, type ProgressoMap } from './lib/progresso'
import {
  cardsDeQuestoes,
  carregarQuestoes,
  carregarRespostas,
  estadoCiclo,
  sortear,
  type Questao,
  type Resposta,
} from './lib/questoes'
import { supabase } from './lib/supabase'

type Tela = 'home' | 'revisao' | 'fim' | 'simulado' | 'resultado' | 'data-prova'

type SimuladoAtivo = { id: string; ciclo: number; questoes: Questao[]; respostas: Resposta[] }

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)
  const [progresso, setProgresso] = useState<ProgressoMap | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [tela, setTela] = useState<Tela>('home')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [dias, setDias] = useState<Set<string>>(new Set())
  const diasSalvos = useRef<Set<string>>(new Set()) // dias já gravados na tabela atividade
  const [questoes, setQuestoes] = useState<Questao[] | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [erroQuestoes, setErroQuestoes] = useState<string | null>(null)
  const [simulado, setSimulado] = useState<SimuladoAtivo | null>(null)
  // undefined = carregando; null = primeiro acesso (sem perfil ainda)
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)

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

  // Cada carregamento ganha um número; respostas de um carregamento antigo (ex.: conta que saiu) são descartadas
  const geracao = useRef(0)

  /** Zera tudo que pertence a uma conta, para nada vazar de um usuário para outro no mesmo navegador */
  const limparConta = useCallback(() => {
    geracao.current++ // invalida carregamentos em andamento da conta anterior
    setProgresso(null)
    setPerfil(undefined)
    setQuestoes(null)
    setRespostas([])
    setErroQuestoes(null)
    setSimulado(null)
    setDias(new Set())
    diasSalvos.current = new Set()
    setTela('home')
    setFiltro('todos')
  }, [])

  const carregar = useCallback(() => {
    const minha = ++geracao.current
    const atual = () => minha === geracao.current
    setErroCarga(null)
    setProgresso(null)
    setPerfil(undefined)
    carregarPerfil()
      .then((p) => atual() && setPerfil(p))
      .catch((e: Error) => {
        if (!atual()) return
        // sem a tabela perfil o app segue funcionando, só sem cards pessoais e sem data da prova
        console.warn('Perfil indisponível:', e.message)
        setPerfil({ data_prova: null, cards_pessoais: false })
      })
    const diasP = carregarDias().catch((e: Error) => {
      console.warn('Ofensiva indisponível:', e.message)
      return new Set<string>()
    })
    Promise.all([carregarProgresso(), diasP])
      .then(([prog, salvos]) => {
        if (!atual()) return
        diasSalvos.current = salvos
        setDias(new Set([...salvos, ...diasDoProgresso(prog)]))
        setProgresso(prog)
      })
      .catch((e: Error) => atual() && setErroCarga(e.message))

    // Simulado é opcional: se as tabelas ainda não existem, os flashcards continuam funcionando
    setErroQuestoes(null)
    Promise.all([carregarQuestoes(), carregarRespostas()])
      .then(([qs, rs]) => {
        if (!atual()) return
        if (qs.length === 0) throw new Error('Nenhuma questão no banco. Rode os arquivos SQL do simulado.')
        setQuestoes(qs)
        setRespostas(rs)
      })
      .catch((e: Error) => {
        if (!atual()) return
        console.warn('Simulado indisponível:', e.message)
        setErroQuestoes(`Simulado indisponível: ${e.message}`)
      })
  }, [])

  useEffect(() => {
    limparConta()
    if (userId) carregar()
  }, [userId, carregar, limparConta])

  const onSalvo = useCallback(
    (cardId: string, card: Card, stats: Stats) => {
      const now = new Date()
      setProgresso((prev) => {
        const next = new Map(prev)
        next.set(cardId, { card, createdAt: prev?.get(cardId)?.createdAt ?? now, updatedAt: now, stats })
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

  // Baralho = cards escritos à mão + questões erradas no simulado
  const baralho = useMemo(
    () =>
      montarBaralho([
        // cards escritos à mão só aparecem na conta do dono (perfil.cards_pessoais)
        ...(perfil?.cards_pessoais ? CARDS : []),
        ...(questoes ? cardsDeQuestoes(questoes, respostas) : []),
      ]),
    [perfil, questoes, respostas],
  )
  const ciclo = useMemo(() => (questoes ? estadoCiclo(questoes, respostas) : null), [questoes, respostas])

  const onRespondida = useCallback((r: Resposta) => {
    setRespostas((rs) => [...rs.filter((x) => !(x.questao === r.questao && x.ciclo === r.ciclo)), r])
  }, [])

  function comecarSimulado(quantidade: number) {
    if (!questoes || !ciclo) return
    const porNumero = new Map(questoes.map((q) => [q.numero, q]))
    const escolhidas = sortear(ciclo.restantes, quantidade).map((n) => porNumero.get(n)!)
    setSimulado({ id: crypto.randomUUID(), ciclo: ciclo.ciclo, questoes: escolhidas, respostas: [] })
    setTela('simulado')
    window.scrollTo({ top: 0 })
  }

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
  if (!progresso || perfil === undefined) return <Centro>Carregando progresso…</Centro>

  const dataProva = perfil?.data_prova ?? null

  if (perfil === null || tela === 'data-prova') {
    const primeiroAcesso = perfil === null
    return (
      <DataProva
        userId={userId}
        atual={dataProva}
        primeiroAcesso={primeiroAcesso}
        onSalvo={(data) => {
          setPerfil({ data_prova: data, cards_pessoais: perfil?.cards_pessoais ?? false })
          setTela('home')
        }}
        onCancelar={primeiroAcesso ? undefined : () => setTela('home')}
      />
    )
  }

  if (tela === 'simulado' && simulado) {
    return (
      <Simulado
        userId={userId}
        questoes={simulado.questoes}
        ciclo={simulado.ciclo}
        simuladoId={simulado.id}
        onRespondida={onRespondida}
        onFinalizar={(rs) => {
          setSimulado({ ...simulado, respostas: rs })
          setTela('resultado')
          window.scrollTo({ top: 0 })
        }}
        onSair={() => {
          setSimulado(null)
          setTela('home')
        }}
      />
    )
  }
  if (tela === 'resultado' && simulado) {
    return (
      <SimuladoResultado
        userId={userId}
        questoes={simulado.questoes}
        respostas={simulado.respostas}
        onAtualizada={onRespondida}
        onVoltar={() => {
          setSimulado(null)
          setTela('home')
        }}
      />
    )
  }

  if (tela === 'revisao') {
    return (
      <Revisao
        baralho={baralho}
        dataProva={dataProva}
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
    return <Fim baralho={baralho} progresso={progresso} filtro={filtro} ofensiva={ofensiva} onVoltar={() => setTela('home')} />
  }

  return (
    <Home
      email={session.user.email ?? ''}
      baralho={baralho}
      dataProva={dataProva}
      onAlterarDataProva={() => setTela('data-prova')}
      simulado={
        <SimuladoCard
          total={questoes?.length ?? 0}
          estado={ciclo}
          indisponivel={erroQuestoes}
          onComecar={comecarSimulado}
        />
      }
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
