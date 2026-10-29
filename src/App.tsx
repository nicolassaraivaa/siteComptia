import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Grade } from 'ts-fsrs'
import Comemoracao from './components/Comemoracao'
import DataProva from './components/DataProva'
import Fim from './components/Fim'
import Historico from './components/Historico'
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
import { carregarCardsPorDia, type CardsPorDia } from './lib/historico'
import { calcularOfensiva, carregarDias, diasDasRespostas, diasDoProgresso, registrarDia } from './lib/ofensiva'
import { carregarPerfil, type Perfil } from './lib/perfil'
import { carregarProgresso, type ProgressoMap } from './lib/progresso'
import { lerRevisaoGuardada } from './lib/sessaoRevisao'
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

type Tela = 'home' | 'revisao' | 'fim' | 'simulado' | 'resultado' | 'data-prova' | 'historico' | 'historico-simulado'

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
  const diasRef = useRef(dias) // para saber, ao salvar, se é a primeira revisão do dia
  useEffect(() => {
    diasRef.current = dias
  }, [dias])
  // O castor comemora na primeira revisão de cada dia (a ofensiva do dia está garantida)
  const [comemoracao, setComemoracao] = useState<{ dias: number; recorde: boolean } | null>(null)
  const fecharComemoracao = useCallback(() => setComemoracao(null), [])
  const [questoes, setQuestoes] = useState<Questao[] | null>(null)
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [erroQuestoes, setErroQuestoes] = useState<string | null>(null)
  const [simulado, setSimulado] = useState<SimuladoAtivo | null>(null)
  const [provas, setProvas] = useState<Prova[] | null>(null)
  // null = indisponível (tabela revisoes ainda não criada)
  const [cardsPorDia, setCardsPorDia] = useState<CardsPorDia | null>(null)
  const [fimHistorico, setFimHistorico] = useState(() => diaSP(new Date()))
  const [simuladoAberto, setSimuladoAberto] = useState<string | null>(null)
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
  // Retomada após recarregar a página: só acontece uma vez por login
  const retomouProva = useRef(false)
  const [revisaoDecidida, setRevisaoDecidida] = useState(false)

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
    setCardsPorDia(null)
    setComemoracao(null)
    retomouProva.current = false
    setRevisaoDecidida(false)
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
        // soma aos dias do simulado, que podem ter chegado antes
        setDias((prev) => new Set([...prev, ...salvos, ...diasDoProgresso(prog)]))
        setProgresso(prog)
      })
      .catch((e: Error) => atual() && setErroCarga(e.message))

    // Histórico por dia é opcional (tabela revisoes)
    carregarCardsPorDia()
      .then((m) => atual() && setCardsPorDia(m))
      .catch((e: Error) => console.warn('Histórico de cards indisponível:', e.message))

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
        // dias com questões respondidas também contam para a ofensiva
        setDias((prev) => new Set([...prev, ...diasDasRespostas(rs)]))
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

  /** Conta o dia na ofensiva (card revisado ou questão do simulado) e grava na tabela atividade */
  const marcarDia = useCallback(
    (dia: string) => {
      setDias((prev) => (prev.has(dia) ? prev : new Set(prev).add(dia)))
      if (userId && !diasSalvos.current.has(dia)) {
        diasSalvos.current.add(dia)
        registrarDia(userId, dia).catch((e: Error) => {
          diasSalvos.current.delete(dia) // tenta de novo na próxima atividade
          console.warn('Falha ao registrar ofensiva:', e.message)
        })
      }
    },
    [userId],
  )

  const onSalvo = useCallback(
    (cardId: string, card: Card, stats: Stats, nota: Grade) => {
      const now = new Date()
      const dia = diaSP(now)
      setCardsPorDia((m) => {
        if (!m) return m
        const d = m.get(dia) ?? { cards: 0, erros: 0 }
        return new Map(m).set(dia, { cards: d.cards + 1, erros: d.erros + (nota === 1 ? 1 : 0) })
      })
      setProgresso((prev) => {
        const next = new Map(prev)
        next.set(cardId, { card, createdAt: prev?.get(cardId)?.createdAt ?? now, updatedAt: now, stats })
        return next
      })
      const hoje = diaSP(now)
      if (!diasRef.current.has(hoje)) {
        const antes = calcularOfensiva(diasRef.current, hoje)
        const novos = new Set(diasRef.current).add(hoje)
        const depois = calcularOfensiva(novos, hoje)
        diasRef.current = novos
        setComemoracao({ dias: depois.atual, recorde: depois.atual > antes.recorde })
      }
      marcarDia(hoje)
    },
    [marcarDia],
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

  const mesclarRespostas = useCallback(
    (novas: Resposta[]) => {
      const chave = (r: Resposta) => `${r.questao}:${r.ciclo}`
      const trocadas = new Set(novas.map(chave))
      setRespostas((rs) => [...rs.filter((x) => !trocadas.has(chave(x))), ...novas])
      for (const dia of new Set(diasDasRespostas(novas))) marcarDia(dia)
    },
    [marcarDia],
  )
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

  // Revisão de flashcards interrompida: volta para ela, no mesmo card.
  // Espera as questões (ou o erro delas) porque as questões erradas também são cards.
  useEffect(() => {
    if (!userId || revisaoDecidida || !progresso || perfil === undefined) return
    if (!questoes && !erroQuestoes) return
    setRevisaoDecidida(true)
    if (lerProvaGuardada(userId)) return // a prova em andamento tem prioridade
    const g = lerRevisaoGuardada(userId)
    if (!g) return
    setFiltro(g.filtro)
    setTela('revisao')
  }, [userId, revisaoDecidida, progresso, perfil, questoes, erroQuestoes])

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

  // enquanto decide se volta para uma revisão interrompida, não mostra a home por um instante
  if (tela === 'home' && !revisaoDecidida && lerRevisaoGuardada(userId)) return <Centro>Carregando…</Centro>

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
        brancos={simulado.info?.brancos}
        prova={simulado.prova && simulado.info ? { ...simulado.info, duracaoS: PROVA_DURACAO_MS / 1000 } : undefined}
        onAtualizada={onRespondida}
        onVoltar={() => {
          setSimulado(null)
          setTela('home')
        }}
      />
    )
  }

  const telaComemoracao = comemoracao && (
    <Comemoracao dias={comemoracao.dias} recorde={comemoracao.recorde} onFechar={fecharComemoracao} />
  )

  if (tela === 'revisao') {
    return (
      <>
      <Revisao
        baralho={baralho}
        dataProva={dataProva}
        userId={userId}
        progresso={progresso}
        filtro={filtro}
        onSalvo={onSalvo}
        onFim={() => {
          // a tela de fim já mostra a ofensiva; não sobrepõe as duas comemorações
          setComemoracao(null)
          setTela('fim')
        }}
        onSair={() => setTela('home')}
      />
      {telaComemoracao}
      </>
    )
  }
  if (tela === 'historico-simulado' && simuladoAberto) {
    const doSimulado = respostas
      .filter((r) => r.simulado_id === simuladoAberto)
      .sort((a, b) => a.respondida_em.localeCompare(b.respondida_em))
    const porNumero = new Map((questoes ?? []).map((q) => [q.numero, q]))
    const registro = provas?.find((p) => p.id === simuladoAberto)
    const duracaoS = PROVA_DURACAO_MS / 1000
    const inicio = doSimulado[0] ? new Date(doSimulado[0].respondida_em) : new Date()
    return (
      <SimuladoResultado
        key={simuladoAberto}
        userId={userId}
        questoes={doSimulado.flatMap((r) => porNumero.get(r.questao) ?? [])}
        respostas={doSimulado}
        doHistorico={{
          titulo: inicio.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        }}
        // em branco = contou como erro sem nenhuma alternativa marcada
        // (simulações não guardam alternativas, então não dá para saber se ficaram em branco)
        brancos={doSimulado
          .filter((r) => r.resultado === 'errada' && r.marcadas.length === 0 && porNumero.get(r.questao)?.tipo !== 'simulacao')
          .map((r) => r.questao)}
        prova={
          registro && {
            tempoUsadoS: registro.tempo_usado_s,
            duracaoS,
            emBranco: registro.em_branco,
            porTempo: registro.tempo_usado_s >= duracaoS,
          }
        }
        onAtualizada={onRespondida}
        onVoltar={() => {
          setSimuladoAberto(null)
          setTela('historico')
        }}
      />
    )
  }
  if (tela === 'historico') {
    return (
      <Historico
        respostas={respostas}
        cardsPorDia={cardsPorDia}
        provas={new Set(provas?.map((p) => p.id))}
        fim={fimHistorico}
        onFim={setFimHistorico}
        onAbrirSimulado={(id) => {
          setSimuladoAberto(id)
          setTela('historico-simulado')
          window.scrollTo({ top: 0 })
        }}
        onVoltar={() => setTela('home')}
      />
    )
  }
  if (tela === 'fim') {
    return (
      <>
        <Fim baralho={baralho} progresso={progresso} filtro={filtro} ofensiva={ofensiva} onVoltar={() => setTela('home')} />
        {telaComemoracao}
      </>
    )
  }

  return (
    <Home
      email={session.user.email ?? ''}
      baralho={baralho}
      dataProva={dataProva}
      onAlterarDataProva={() => setTela('data-prova')}
      onHistorico={() => {
        setTela('historico')
        window.scrollTo({ top: 0 })
      }}
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
