import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from 'ts-fsrs'
import DataProva from './components/DataProva'
import Fim from './components/Fim'
import Home from './components/Home'
import Login from './components/Login'
import NovaSenha from './components/NovaSenha'
import Revisao from './components/Revisao'
import HistoricoProvas from './components/HistoricoProvas'
import Simulado, { type EstadoSalvo, type InfoFinal } from './components/Simulado'
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
  carregarProvas,
  carregarQuestoes,
  carregarRespostas,
  estadoCiclo,
  PROVA_DURACAO_MS,
  salvarProva,
  sortear,
  sortearProva,
  type Prova,
  type Questao,
  type QuestaoDaProva,
  type Resposta,
} from './lib/questoes'
import { supabase } from './lib/supabase'

type Tela = 'home' | 'revisao' | 'fim' | 'simulado' | 'resultado' | 'data-prova'

type SimuladoAtivo = {
  id: string
  itens: QuestaoDaProva[]
  /** Presente no simulado de prova (90 questões, 1h30) */
  prova?: { iniciadaEm: number }
  inicial?: EstadoSalvo
  respostas: Resposta[]
  info?: InfoFinal
}

/** Prova em andamento guardada no navegador para sobreviver a um recarregamento da página */
type ProvaGuardada = { id: string; iniciadaEm: number; itens: { numero: number; ciclo: number }[]; estado: EstadoSalvo }

const chaveProva = (userId: string) => `prova-em-andamento:${userId}`

function lerProvaGuardada(userId: string): ProvaGuardada | null {
  try {
    const bruto = localStorage.getItem(chaveProva(userId))
    return bruto ? (JSON.parse(bruto) as ProvaGuardada) : null
  } catch {
    return null
  }
}

function guardarProva(userId: string, p: ProvaGuardada | null) {
  try {
    if (p) localStorage.setItem(chaveProva(userId), JSON.stringify(p))
    else localStorage.removeItem(chaveProva(userId))
  } catch {
    // sem armazenamento local a prova só não é retomada após recarregar
  }
}

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
  const [provas, setProvas] = useState<Prova[] | null>(null)
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
    setProvas(null)
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

    // Histórico de provas é opcional (tabela provas)
    carregarProvas()
      .then((ps) => atual() && setProvas(ps))
      .catch((e: Error) => console.warn('Histórico de provas indisponível:', e.message))

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

  const mesclarRespostas = useCallback((novas: Resposta[]) => {
    const chave = (r: Resposta) => `${r.questao}:${r.ciclo}`
    const trocadas = new Set(novas.map(chave))
    setRespostas((rs) => [...rs.filter((x) => !trocadas.has(chave(x))), ...novas])
  }, [])
  const onRespondida = useCallback((r: Resposta) => mesclarRespostas([r]), [mesclarRespostas])

  function comecarSimulado(quantidade: number) {
    if (!questoes || !ciclo) return
    const porNumero = new Map(questoes.map((q) => [q.numero, q]))
    const itens = sortear(ciclo.restantes, quantidade).map((n) => ({ questao: porNumero.get(n)!, ciclo: ciclo.ciclo }))
    setSimulado({ id: crypto.randomUUID(), itens, respostas: [] })
    setTela('simulado')
    window.scrollTo({ top: 0 })
  }

  function comecarProva() {
    if (!questoes || !ciclo || !userId) return
    const itens = sortearProva(questoes, ciclo)
    const id = crypto.randomUUID()
    const iniciadaEm = Date.now()
    guardarProva(userId, {
      id,
      iniciadaEm,
      itens: itens.map((x) => ({ numero: x.questao.numero, ciclo: x.ciclo })),
      estado: { idx: 0, marcadas: {} },
    })
    setSimulado({ id, itens, prova: { iniciadaEm }, respostas: [] })
    setTela('simulado')
    window.scrollTo({ top: 0 })
  }

  // Prova interrompida (página recarregada): retoma de onde parou, com o tempo que sobrou
  const retomouProva = useRef(false)
  useEffect(() => {
    if (!questoes || !userId || retomouProva.current) return
    retomouProva.current = true
    const g = lerProvaGuardada(userId)
    if (!g) return
    const porNumero = new Map(questoes.map((q) => [q.numero, q]))
    const itens = g.itens.flatMap((x) => {
      const questao = porNumero.get(x.numero)
      return questao ? [{ questao, ciclo: x.ciclo }] : []
    })
    if (itens.length === 0) return guardarProva(userId, null)
    setSimulado({ id: g.id, itens, prova: { iniciadaEm: g.iniciadaEm }, inicial: g.estado, respostas: [] })
    setTela('simulado')
  }, [questoes, userId])

  const onEstadoProva = useCallback(
    (estado: EstadoSalvo) => {
      if (!userId || !simulado?.prova) return
      guardarProva(userId, {
        id: simulado.id,
        iniciadaEm: simulado.prova.iniciadaEm,
        itens: simulado.itens.map((x) => ({ numero: x.questao.numero, ciclo: x.ciclo })),
        estado,
      })
    },
    [userId, simulado],
  )

  function finalizarSimulado(rs: Resposta[], info: InfoFinal) {
    if (!simulado || !userId) return
    mesclarRespostas(rs)
    if (simulado.prova) {
      guardarProva(userId, null)
      const registro: Prova = {
        id: simulado.id,
        iniciada_em: new Date(simulado.prova.iniciadaEm).toISOString(),
        finalizada_em: new Date().toISOString(),
        tempo_usado_s: info.tempoUsadoS,
        total: simulado.itens.length,
        em_branco: info.emBranco,
      }
      setProvas((ps) => (ps ? [registro, ...ps.filter((p) => p.id !== registro.id)] : ps))
      salvarProva(userId, registro).catch((e: Error) => console.warn('Falha ao salvar histórico da prova:', e.message))
    }
    setSimulado({ ...simulado, respostas: rs, info })
    setTela('resultado')
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
        key={simulado.id}
        userId={userId}
        itens={simulado.itens}
        simuladoId={simulado.id}
        prova={simulado.prova}
        inicial={simulado.inicial}
        onEstado={simulado.prova ? onEstadoProva : undefined}
        onRespondida={onRespondida}
        onFinalizar={finalizarSimulado}
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
        questoes={simulado.itens.map((x) => x.questao)}
        respostas={simulado.respostas}
        prova={simulado.prova && simulado.info ? { ...simulado.info, duracaoS: PROVA_DURACAO_MS / 1000 } : undefined}
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
          onComecarProva={comecarProva}
        />
      }
      historico={provas && provas.length > 0 ? <HistoricoProvas provas={provas} respostas={respostas} /> : null}
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
