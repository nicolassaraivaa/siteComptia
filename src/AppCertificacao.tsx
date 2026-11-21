import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Grade } from 'ts-fsrs'
import type { Certificacao } from './certificacoes'
import Aprovado from './components/Aprovado'
import Comemoracao from './components/Comemoracao'
import DataProva from './components/DataProva'
import Fim from './components/Fim'
import Historico from './components/Historico'
import Home from './components/Home'
import ObjetivoSimulado from './components/ObjetivoSimulado'
import Revisao from './components/Revisao'
import HistoricoProvas from './components/HistoricoProvas'
import ProntidaoCard from './components/ProntidaoCard'
import Simulado, { type EstadoSalvo, type InfoFinal } from './components/Simulado'
import SimuladoCard, { type ProvaEmAndamento } from './components/SimuladoCard'
import SimuladoResultado from './components/SimuladoResultado'
import { CertContexto } from './lib/certContexto'
import { diaSP, montarBaralho, type Filtro } from './lib/fila'
import type { Stats } from './lib/fsrs'
import { carregarCardsPorDia, type CardsPorDia } from './lib/historico'
import { calcularOfensiva, carregarDias, diasDasRespostas, diasDoProgresso, registrarDia } from './lib/ofensiva'
import {
  aguardandoResultado,
  aprovadoSemObjetivo,
  carregarPerfil,
  PERFIL_VAZIO,
  salvarResultado,
  type Perfil,
  type PerfilConta,
} from './lib/perfil'
import { calcularProntidao } from './lib/prontidao'
import { carregarProgresso, type ProgressoMap } from './lib/progresso'
import { guardarRevisao, lerRevisaoGuardada } from './lib/sessaoRevisao'
import {
  cardsDeQuestoes,
  carregarProvas,
  carregarTempos,
  carregarQuestoes,
  carregarRespostas,
  duracaoProvaMs,
  estadoCiclo,
  salvarProva,
  salvarTempo,
  sortear,
  sortearProva,
  type Prova,
  type Questao,
  type QuestaoDaProva,
  type Resposta,
} from './lib/questoes'
import { registrarConquista } from './lib/trilha'

type Tela =
  | 'home'
  | 'revisao'
  | 'fim'
  | 'simulado'
  | 'resultado'
  | 'data-prova'
  | 'historico'
  | 'historico-simulado'
  | 'aprovado'
  | 'reprovado'

type SimuladoAtivo = {
  id: string
  itens: QuestaoDaProva[]
  /** Quando começou: o cronômetro conta daqui */
  iniciadoEm: number
  /** Presente no simulado de prova (formato da certificação) */
  prova?: { iniciadaEm: number }
  inicial?: EstadoSalvo
  respostas: Resposta[]
  info?: InfoFinal
}

/** Prova em andamento guardada no navegador para sobreviver a um recarregamento da página */
type ProvaGuardada = { id: string; iniciadaEm: number; itens: { numero: number; ciclo: number }[]; estado: EstadoSalvo }

// A Security+ mantém a chave antiga: uma prova em andamento sobrevive à atualização do app
const chaveProva = (userId: string, cert: string) =>
  cert === 'secplus' ? `prova-em-andamento:${userId}` : `prova-em-andamento:${userId}:${cert}`

function lerProvaGuardada(userId: string, cert: string): ProvaGuardada | null {
  try {
    const bruto = localStorage.getItem(chaveProva(userId, cert))
    return bruto ? (JSON.parse(bruto) as ProvaGuardada) : null
  } catch {
    return null
  }
}

function provaPausada(p: ProvaGuardada): boolean {
  return p.estado.pausa?.desde != null
}

/** O que a tela inicial mostra de uma prova guardada: onde parou e, se pausada, quanto tempo sobra */
function resumoProva(p: ProvaGuardada, duracaoMs: number): ProvaEmAndamento {
  const pausa = p.estado.pausa
  return {
    questao: p.estado.idx + 1,
    total: p.itens.length,
    restanteMs:
      pausa?.desde != null ? Math.max(0, p.iniciadaEm + pausa.totalMs + duracaoMs - pausa.desde) : undefined,
  }
}

function guardarProva(userId: string, cert: string, p: ProvaGuardada | null) {
  try {
    if (p) localStorage.setItem(chaveProva(userId, cert), JSON.stringify(p))
    else localStorage.removeItem(chaveProva(userId, cert))
  } catch {
    // sem armazenamento local a prova só não é retomada após recarregar
  }
}

type Props = {
  email: string
  userId: string
  cert: Certificacao
  conta: PerfilConta
  /** Volta para a escolha da certificação */
  onTrocar: () => void
  onMinhas: () => void
}

/**
 * Tudo de uma certificação: flashcards, simulado, prova, histórico. É remontado (key) ao trocar
 * de certificação ou de conta, então nada de uma vaza para a outra.
 */
export default function AppCertificacao({ email, userId, cert, conta, onTrocar, onMinhas }: Props) {
  const duracaoMs = duracaoProvaMs(cert)
  const [progresso, setProgresso] = useState<ProgressoMap | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [tela, setTela] = useState<Tela>('home')
  // Começa nos erros das últimas 2 semanas; dá para trocar na tela inicial
  const [filtro, setFiltro] = useState<Filtro>('recentes')
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
  // Segundos gastos em cada simulado normal; null = indisponível (tabela simulado_tempos ainda não criada)
  const [tempos, setTempos] = useState<Map<string, number> | null>(null)
  // null = indisponível (tabela revisoes ainda não criada)
  const [cardsPorDia, setCardsPorDia] = useState<CardsPorDia | null>(null)
  const [fimHistorico, setFimHistorico] = useState(() => diaSP(new Date()))
  const [simuladoAberto, setSimuladoAberto] = useState<string | null>(null)
  // undefined = carregando; null = primeira vez nesta certificação
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)

  // Cada carregamento ganha um número; respostas de um carregamento antigo (ex.: conta que saiu) são descartadas
  const geracao = useRef(0)
  // Retomada após recarregar a página: só acontece uma vez por abertura da certificação
  const retomouProva = useRef(false)
  const [revisaoDecidida, setRevisaoDecidida] = useState(false)

  const carregar = useCallback(() => {
    const minha = ++geracao.current
    const atual = () => minha === geracao.current
    setErroCarga(null)
    setProgresso(null)
    setPerfil(undefined)
    carregarPerfil(cert.id)
      .then((p) => atual() && setPerfil(p))
      .catch((e: Error) => {
        if (!atual()) return
        // sem a tabela perfil_certificacao o app segue funcionando, só sem data da prova
        console.warn('Perfil indisponível:', e.message)
        setPerfil(PERFIL_VAZIO)
      })
    const diasP = carregarDias().catch((e: Error) => {
      console.warn('Ofensiva indisponível:', e.message)
      return new Set<string>()
    })
    Promise.all([carregarProgresso(cert.id), diasP])
      .then(([prog, salvos]) => {
        if (!atual()) return
        diasSalvos.current = salvos
        // soma aos dias do simulado, que podem ter chegado antes
        setDias((prev) => new Set([...prev, ...salvos, ...diasDoProgresso(prog)]))
        setProgresso(prog)
      })
      .catch((e: Error) => atual() && setErroCarga(e.message))

    // Histórico por dia é opcional (tabela revisoes)
    carregarCardsPorDia(cert.id)
      .then((m) => atual() && setCardsPorDia(m))
      .catch((e: Error) => console.warn('Histórico de cards indisponível:', e.message))

    // Histórico de provas é opcional (tabela provas)
    carregarProvas(cert.id)
      .then((ps) => atual() && setProvas(ps))
      .catch((e: Error) => console.warn('Histórico de provas indisponível:', e.message))

    // Tempo dos simulados é opcional (tabela simulado_tempos)
    carregarTempos(cert.id)
      .then((ts) => atual() && setTempos(ts))
      .catch((e: Error) => console.warn('Tempo dos simulados indisponível:', e.message))

    // Simulado é opcional: se as tabelas ainda não existem, os flashcards continuam funcionando
    setErroQuestoes(null)
    Promise.all([carregarQuestoes(cert.id), carregarRespostas(cert.id)])
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
  }, [cert.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Conta o dia na ofensiva (card revisado ou questão do simulado) e grava na tabela atividade */
  const marcarDia = useCallback(
    (dia: string) => {
      setDias((prev) => (prev.has(dia) ? prev : new Set(prev).add(dia)))
      if (!diasSalvos.current.has(dia)) {
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

  const zeradosDia = perfil?.flashcards_zerados_em ? diaSP(new Date(perfil.flashcards_zerados_em)) : null
  // Baralho = cards escritos à mão + questões erradas no simulado
  const baralho = useMemo(
    () =>
      montarBaralho([
        // anotações escritas à mão só aparecem na conta do dono (perfil.cards_pessoais);
        // depois de zerar os flashcards, só as criadas a partir daquele dia
        ...(conta.cards_pessoais ? cert.cards.filter((c) => !zeradosDia || c.adicionado_em > zeradosDia) : []),
        ...(questoes ? cardsDeQuestoes(questoes, respostas, perfil?.flashcards_zerados_em ?? null) : []),
      ]),
    [conta.cards_pessoais, cert.cards, perfil, zeradosDia, questoes, respostas],
  )
  const ciclo = useMemo(
    () => (questoes ? estadoCiclo(questoes, respostas, perfil?.ciclo_inicio ?? 1) : null),
    [questoes, respostas, perfil],
  )

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

  // Aprovada e começando um simulado novo: antes pergunta se vai refazer a prova ou só treinar
  const [objetivo, setObjetivo] = useState<(() => void) | null>(null)

  async function informarResultado(aprovado: boolean) {
    if (!perfil?.data_prova) return
    const resultado = aprovado ? 'aprovado' : 'reprovado'
    try {
      await salvarResultado(userId, cert.id, resultado, perfil.data_prova)
    } catch (e) {
      window.alert(`Não foi possível salvar o resultado (${(e as Error).message}). Tente de novo.`)
      return
    }
    // aprovada: entra em "Minhas certificações", com a validade da certificação
    if (aprovado) {
      registrarConquista(userId, cert, perfil.data_prova).catch((e: Error) =>
        console.warn('Falha ao registrar a conquista:', e.message),
      )
    }
    setPerfil({ ...perfil, resultado, resultado_data: perfil.data_prova })
    setTela(aprovado ? 'aprovado' : 'reprovado')
    window.scrollTo({ top: 0 })
  }

  /** jaPerguntou: a pessoa acabou de escolher o objetivo, não pergunta de novo */
  function comecarSimulado(quantidade: number, jaPerguntou = false) {
    if (!questoes || !ciclo) return
    if (!jaPerguntou && aprovadoSemObjetivo(perfil)) return setObjetivo(() => () => comecarSimulado(quantidade, true))
    const porNumero = new Map(questoes.map((q) => [q.numero, q]))
    const itens = sortear(ciclo.restantes, quantidade).map((n) => ({ questao: porNumero.get(n)!, ciclo: ciclo.ciclo }))
    setSimulado({ id: crypto.randomUUID(), itens, iniciadoEm: Date.now(), respostas: [] })
    setTela('simulado')
    window.scrollTo({ top: 0 })
  }

  /** Abre a prova guardada no navegador de onde parou (pausada, se estava pausada) */
  const retomarProva = useCallback(
    (g: ProvaGuardada): boolean => {
      if (!questoes) return false
      const porNumero = new Map(questoes.map((q) => [q.numero, q]))
      const itens = g.itens.flatMap((x) => {
        const questao = porNumero.get(x.numero)
        return questao ? [{ questao, ciclo: x.ciclo }] : []
      })
      if (itens.length === 0) {
        guardarProva(userId, cert.id, null)
        return false
      }
      setSimulado({ id: g.id, itens, iniciadoEm: g.iniciadaEm, prova: { iniciadaEm: g.iniciadaEm }, inicial: g.estado, respostas: [] })
      setTela('simulado')
      window.scrollTo({ top: 0 })
      return true
    },
    [questoes, userId, cert.id],
  )

  function comecarProva(jaPerguntou = false) {
    if (!questoes || !ciclo) return
    // Nunca sobrescreve uma prova em andamento: o botão retoma a que está guardada
    const guardada = lerProvaGuardada(userId, cert.id)
    if (guardada && retomarProva(guardada)) return
    if (!jaPerguntou && aprovadoSemObjetivo(perfil)) return setObjetivo(() => () => comecarProva(true))
    const itens = sortearProva(questoes, ciclo, cert)
    const id = crypto.randomUUID()
    const iniciadaEm = Date.now()
    guardarProva(userId, cert.id, {
      id,
      iniciadaEm,
      itens: itens.map((x) => ({ numero: x.questao.numero, ciclo: x.ciclo })),
      estado: { idx: 0, marcadas: {} },
    })
    setSimulado({ id, itens, iniciadoEm: iniciadaEm, prova: { iniciadaEm }, respostas: [] })
    setTela('simulado')
    window.scrollTo({ top: 0 })
  }

  // Prova interrompida com o tempo correndo (aba fechada, página recarregada): volta direto para ela.
  // Pausada, ela espera: o botão do simulado de prova na tela inicial vira "Retomar".
  useEffect(() => {
    if (!questoes || retomouProva.current) return
    retomouProva.current = true
    const g = lerProvaGuardada(userId, cert.id)
    if (g && !provaPausada(g)) retomarProva(g)
  }, [questoes, userId, cert.id, retomarProva])

  // Revisão de flashcards interrompida: volta para ela, no mesmo card.
  // Espera as questões (ou o erro delas) porque as questões erradas também são cards.
  useEffect(() => {
    if (revisaoDecidida || !progresso || perfil === undefined) return
    if (!questoes && !erroQuestoes) return
    setRevisaoDecidida(true)
    const prova = lerProvaGuardada(userId, cert.id)
    if (prova && !provaPausada(prova)) return // a prova com o tempo correndo tem prioridade
    const g = lerRevisaoGuardada(userId, cert.id)
    if (!g) return
    setFiltro(g.filtro)
    setTela('revisao')
  }, [userId, cert.id, revisaoDecidida, progresso, perfil, questoes, erroQuestoes])

  const onEstadoProva = useCallback(
    (estado: EstadoSalvo) => {
      if (!simulado?.prova) return
      guardarProva(userId, cert.id, {
        id: simulado.id,
        iniciadaEm: simulado.prova.iniciadaEm,
        itens: simulado.itens.map((x) => ({ numero: x.questao.numero, ciclo: x.ciclo })),
        estado,
      })
    },
    [userId, cert.id, simulado],
  )

  function finalizarSimulado(rs: Resposta[], info: InfoFinal) {
    if (!simulado) return
    mesclarRespostas(rs)
    if (simulado.prova) {
      guardarProva(userId, cert.id, null)
      const registro: Prova = {
        id: simulado.id,
        iniciada_em: new Date(simulado.prova.iniciadaEm).toISOString(),
        finalizada_em: new Date().toISOString(),
        tempo_usado_s: info.tempoUsadoS,
        total: simulado.itens.length,
        em_branco: info.emBranco,
      }
      setProvas((ps) => (ps ? [registro, ...ps.filter((p) => p.id !== registro.id)] : ps))
      salvarProva(userId, cert.id, registro).catch((e: Error) => console.warn('Falha ao salvar histórico da prova:', e.message))
    } else {
      const tempo = {
        id: simulado.id,
        iniciado_em: new Date(simulado.iniciadoEm).toISOString(),
        finalizado_em: new Date().toISOString(),
        tempo_s: info.tempoUsadoS,
      }
      setTempos((ts) => (ts ? new Map(ts).set(tempo.id, tempo.tempo_s) : ts))
      salvarTempo(userId, cert.id, tempo).catch((e: Error) => console.warn('Falha ao salvar o tempo do simulado:', e.message))
    }
    setSimulado({ ...simulado, respostas: rs, info })
    setTela('resultado')
    window.scrollTo({ top: 0 })
  }

  // Toda tela desta certificação lê domínios e formato da prova pelo contexto
  return <CertContexto.Provider value={cert}>{tela_()}</CertContexto.Provider>

  function tela_() {
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
  if (tela === 'home' && !revisaoDecidida && lerRevisaoGuardada(userId, cert.id)) return <Centro>Carregando…</Centro>

  const dataProva = perfil?.data_prova ?? null

  if (perfil === null || tela === 'data-prova' || tela === 'reprovado') {
    const primeiroAcesso = perfil === null
    return (
      <DataProva
        userId={userId}
        atual={dataProva}
        treino={perfil?.treino}
        primeiroAcesso={primeiroAcesso}
        intro={
          tela === 'reprovado'
            ? {
                pose: 'neutro',
                titulo: 'Faz parte. Bora para a próxima!',
                texto: 'Seus flashcards e o histórico do simulado continuam aqui. Quando é a nova prova?',
              }
            : undefined
        }
        onSalvo={(data, treino) => {
          setPerfil({ ...(perfil ?? PERFIL_VAZIO), data_prova: data, treino })
          setTela('home')
        }}
        onCancelar={primeiroAcesso ? undefined : () => setTela('home')}
      />
    )
  }

  if (tela === 'aprovado') {
    return (
      <Aprovado
        totalFlashcards={progresso.size}
        onContinuar={() => setTela('home')}
        onZerado={() => {
          // a revisão guardada aponta para cards que não existem mais
          guardarRevisao(userId, cert.id, null)
          setTela('home')
          carregar()
        }}
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
        iniciadoEm={simulado.iniciadoEm}
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
        todasRespostas={respostas}
        brancos={simulado.info?.brancos}
        prova={simulado.prova && simulado.info ? { ...simulado.info, duracaoS: duracaoMs / 1000 } : undefined}
        tempoS={!simulado.prova ? simulado.info?.tempoUsadoS : undefined}
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
    const duracaoS = duracaoMs / 1000
    const inicio = doSimulado[0] ? new Date(doSimulado[0].respondida_em) : new Date()
    return (
      <SimuladoResultado
        key={simuladoAberto}
        userId={userId}
        questoes={doSimulado.flatMap((r) => porNumero.get(r.questao) ?? [])}
        respostas={doSimulado}
        todasRespostas={respostas}
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
        tempoS={registro ? undefined : tempos?.get(simuladoAberto)}
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
        tempos={new Map([...(tempos ?? []), ...(provas ?? []).map((p) => [p.id, p.tempo_usado_s] as const)])}
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

  // Prova pausada e deixada para depois: o card do simulado oferece retomar em vez de começar outra
  const provaSalva = lerProvaGuardada(userId, cert.id)
  const prontidao = questoes ? calcularProntidao(cert, provas ?? [], respostas, questoes.length) : null

  return (
    <>
    <Home
      email={email}
      baralho={baralho}
      dataProva={dataProva}
      treino={perfil.treino}
      aprovado={perfil.resultado === 'aprovado' && perfil.resultado_data === dataProva}
      perguntarResultado={aguardandoResultado(perfil, diaSP(new Date()))}
      onResultado={(aprovado) => void informarResultado(aprovado)}
      onAlterarDataProva={() => setTela('data-prova')}
      onHistorico={() => {
        setTela('historico')
        window.scrollTo({ top: 0 })
      }}
      onTrocar={onTrocar}
      onMinhas={onMinhas}
      prontidao={prontidao && <ProntidaoCard prontidao={prontidao} />}
      simulado={
        <SimuladoCard
          total={questoes?.length ?? 0}
          estado={ciclo}
          indisponivel={erroQuestoes}
          onComecar={(n) => comecarSimulado(n)}
          onComecarProva={() => comecarProva()}
          provaEmAndamento={provaSalva && resumoProva(provaSalva, duracaoMs)}
        />
      }
      historico={provas && provas.length > 0 ? <HistoricoProvas provas={provas} respostas={respostas} /> : null}
      progresso={progresso}
      ofensiva={ofensiva}
      filtro={filtro}
      onFiltro={setFiltro}
      onComecar={() => setTela('revisao')}
    />
    {objetivo && (
      <ObjetivoSimulado
        userId={userId}
        onRefazer={() => {
          setObjetivo(null)
          setTela('data-prova')
        }}
        onTreino={() => {
          const seguir = objetivo
          setObjetivo(null)
          setPerfil({ ...perfil, data_prova: null, treino: true })
          seguir()
        }}
        onCancelar={() => setObjetivo(null)}
      />
    )}
    </>
  )
  }
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center text-muted" aria-live="polite">
      {children}
    </div>
  )
}
