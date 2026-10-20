import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createEmptyCard, type Card, type Grade } from 'ts-fsrs'
import { DOMINIO_COR, DOMINIOS } from '../config'
import { diaSP, montarFila, passaFiltro, type Baralho, type Filtro, type ItemFila } from '../lib/fila'
import { BOTOES, emAprendizado, formatIntervalo, previa, somarStats, type Stats } from '../lib/fsrs'
import { registrarRevisao } from '../lib/historico'
import { salvarProgresso, type ProgressoMap } from '../lib/progresso'
import { guardarRevisao, lerRevisaoGuardada } from '../lib/sessaoRevisao'
import QuestaoVisao from './QuestaoVisao'

type Props = {
  baralho: Baralho
  dataProva: string | null
  userId: string
  progresso: ProgressoMap
  filtro: Filtro
  onSalvo: (cardId: string, card: Card, stats: Stats, nota: Grade) => void
  onFim: () => void
  onSair: () => void
}

type Salvamento = { item: ItemFila; card: Card; stats: Stats; nota: Grade }

type Aprendendo = { data: ItemFila['data']; card: Card }

type Sessao = {
  principal: ItemFila[] // revisões, novos simulado, novos backlog (nessa ordem)
  aprendendo: Aprendendo[] // aprendizado/reaprendizado, ordenado por due
  atual: ItemFila | null
  feitos: number
}

function inserirPorDue(lista: Aprendendo[], item: Aprendendo): Aprendendo[] {
  const i = lista.findIndex((x) => x.card.due > item.card.due)
  return i === -1 ? [...lista, item] : [...lista.slice(0, i), item, ...lista.slice(i)]
}

/** Escolhe o próximo card. Aprendizado vencido tem prioridade; `forcar` ignora a espera. */
function avancar(s: Sessao, now: Date, forcar = false): Sessao {
  const [primeiroAprendendo, ...restoAprendendo] = s.aprendendo
  if (primeiroAprendendo && (primeiroAprendendo.card.due <= now || (forcar && s.principal.length === 0))) {
    return { ...s, atual: primeiroAprendendo, aprendendo: restoAprendendo }
  }
  const [primeiro, ...resto] = s.principal
  if (primeiro) return { ...s, atual: primeiro, principal: resto }
  return { ...s, atual: null }
}

/**
 * Monta a sessão a partir da fila. Se a página foi recarregada no meio de uma revisão,
 * continua de onde parou: mesmo card na tela, mesma contagem e os cards em aprendizado que iam voltar.
 */
function sessaoInicial(baralho: Baralho, progresso: ProgressoMap, filtro: Filtro, userId: string, now: Date) {
  const fila = montarFila(baralho, progresso, filtro, now)
  const principal = [...fila.revisoes, ...fila.novosSimulado, ...fila.novosBacklog]
  let aprendendo: Aprendendo[] = fila.aprendizado.map((i) => ({ data: i.data, card: i.card! }))

  const g = lerRevisaoGuardada(userId)
  if (!g || g.filtro !== filtro) return { sessao: avancar({ principal, aprendendo, atual: null, feitos: 0 }, now), mostrando: false }

  const naSessao = new Set(aprendendo.map((a) => a.data.id))
  for (const id of g.aprendendo) {
    const data = baralho.porId.get(id)
    const card = progresso.get(id)?.card
    if (data && card && !naSessao.has(id) && emAprendizado(card) && passaFiltro(data, filtro)) {
      aprendendo = inserirPorDue(aprendendo, { data, card })
    }
  }

  // o card que estava na tela volta primeiro
  const i = principal.findIndex((x) => x.data.id === g.atual)
  if (i >= 0) {
    const sessao = { principal: principal.filter((_, k) => k !== i), aprendendo, atual: principal[i], feitos: g.feitos }
    return { sessao, mostrando: g.mostrando }
  }
  const j = aprendendo.findIndex((x) => x.data.id === g.atual)
  if (j >= 0) {
    const sessao = { principal, aprendendo: aprendendo.filter((_, k) => k !== j), atual: aprendendo[j], feitos: g.feitos }
    return { sessao, mostrando: g.mostrando }
  }
  return { sessao: avancar({ principal, aprendendo, atual: null, feitos: g.feitos }, now), mostrando: false }
}

export default function Revisao({ baralho, dataProva, userId, progresso, filtro, onSalvo, onFim, onSair }: Props) {
  const [inicio] = useState(() => {
    const now = new Date()
    const { sessao, mostrando } = sessaoInicial(baralho, progresso, filtro, userId, now)
    const atual = sessao.atual
    const preview = mostrando && atual ? { now, cards: previa(atual.card ?? createEmptyCard(now), now, dataProva) } : null
    return { sessao, preview }
  })
  const [sessao, setSessao] = useState<Sessao>(inicio.sessao)
  const [mostrando, setMostrando] = useState(inicio.preview !== null)
  const [preview, setPreview] = useState<{ now: Date; cards: Record<Grade, Card> } | null>(inicio.preview)
  const [salvando, setSalvando] = useState(false)
  const [pendente, setPendente] = useState<Salvamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => new Date())

  const { atual, aprendendo, principal, feitos } = sessao
  const esperando = !atual && aprendendo.length > 0
  const acabou = !atual && aprendendo.length === 0

  useEffect(() => {
    if (!acabou) return
    guardarRevisao(userId, null)
    onFim()
  }, [acabou, onFim, userId])

  // Guarda onde a revisão está, para continuar daqui se a página for recarregada
  useEffect(() => {
    if (acabou) return
    guardarRevisao(userId, {
      dia: diaSP(new Date()),
      filtro,
      feitos,
      atual: atual?.data.id ?? null,
      mostrando,
      aprendendo: aprendendo.map((a) => a.data.id),
    })
  }, [userId, filtro, feitos, atual, mostrando, aprendendo, acabou])

  const sair = useCallback(() => {
    guardarRevisao(userId, null)
    onSair()
  }, [userId, onSair])

  // Enquanto espera um card de aprendizado, atualiza o contador e puxa o card quando vencer
  useEffect(() => {
    if (!esperando) return
    const id = setInterval(() => {
      const now = new Date()
      setAgora(now)
      setSessao((s) => (s.atual ? s : avancar(s, now)))
    }, 5_000)
    return () => clearInterval(id)
  }, [esperando])

  const mostrarResposta = useCallback(() => {
    if (!atual || mostrando) return
    const now = new Date()
    setPreview({ now, cards: previa(atual.card ?? createEmptyCard(now), now, dataProva) })
    setMostrando(true)
  }, [atual, mostrando, dataProva])

  const salvar = useCallback(
    async (p: Salvamento) => {
      setSalvando(true)
      setErro(null)
      try {
        await salvarProgresso(userId, p.item.data.id, p.card, p.stats)
      } catch (e) {
        setErro((e as Error).message || 'Falha ao salvar')
        setPendente(p)
        setSalvando(false)
        return
      }
      onSalvo(p.item.data.id, p.card, p.stats, p.nota)
      // histórico por dia: se falhar, a revisão em si já está salva
      registrarRevisao(userId, p.item.data.id, p.nota).catch((e: Error) =>
        console.warn('Falha ao registrar no histórico:', e.message),
      )
      setPendente(null)
      setMostrando(false)
      setPreview(null)
      setSalvando(false)
      setSessao((s) => {
        const aprendendo = emAprendizado(p.card) ? inserirPorDue(s.aprendendo, { data: p.item.data, card: p.card }) : s.aprendendo
        return avancar({ ...s, aprendendo, atual: null, feitos: s.feitos + 1 }, new Date())
      })
      setAgora(new Date())
    },
    [userId, onSalvo],
  )

  const avaliar = useCallback(
    (grade: Grade) => {
      if (!atual || !preview || salvando || pendente) return
      const stats = somarStats(progresso.get(atual.data.id)?.stats, grade)
      void salvar({ item: atual, card: preview.cards[grade], stats, nota: grade })
    },
    [atual, preview, salvando, pendente, salvar, progresso],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        mostrarResposta()
        return
      }
      if (!mostrando) return
      const botao = BOTOES.find((b) => b.tecla === e.key)
      if (botao) avaliar(botao.grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mostrarResposta, avaliar, mostrando])

  const restantes = principal.length + aprendendo.length + (atual ? 1 : 0)
  const total = feitos + restantes
  const pct = total === 0 ? 100 : Math.round((feitos / total) * 100)

  const intervalos = useMemo(() => {
    if (!preview) return null
    return Object.fromEntries(BOTOES.map((b) => [b.grade, formatIntervalo(preview.cards[b.grade].due, preview.now)]))
  }, [preview])

  if (acabou) return null

  const [respostaDireta, ...explicacao] = atual ? atual.data.verso.split('\n') : []

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-44 sm:pb-10">
      <h1 className="sr-only">Revisão</h1>
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={sair}
          aria-label="Encerrar revisão e voltar ao início"
          className="foco -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Progresso da sessão"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={feitos}
        >
          <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-muted tabular-nums">
          {feitos}/{total}
        </span>
      </header>

      {esperando ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
          <p className="text-sm text-muted">Só restam cards em aprendizado</p>
          <p className="mt-1 mb-6 text-2xl font-bold">Próximo card em {formatIntervalo(aprendendo[0].card.due, agora)}</p>
          <button
            onClick={() => setSessao((s) => avancar(s, new Date(), true))}
            className="foco rounded-2xl bg-primary px-6 py-3 font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            Revisar agora
          </button>
        </div>
      ) : (
        atual && (
          <>
            <article
              key={atual.data.id}
              style={{ '--dc': DOMINIO_COR[atual.data.dominio] } as CSSProperties}
              className="overflow-hidden rounded-3xl border border-line bg-surface"
            >
              <div className="h-1.5 bg-[var(--dc)]" aria-hidden="true" />
              <div className="p-5 sm:p-7">
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-[var(--dc)] tabular-nums">{atual.data.dominio}</span>
                  <span className="min-w-0 truncate text-muted">{DOMINIOS[atual.data.dominio]}</span>
                  {!atual.card && (
                    <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">Novo</span>
                  )}
                </p>

                {atual.data.questao ? (
                  <div className="mt-4">
                    <p className="mb-3 text-xs text-muted">Questão {atual.data.questao.numero} do simulado, que você errou</p>
                    <QuestaoVisao q={atual.data.questao} revelar={mostrando} />
                  </div>
                ) : (
                  <>
                    <h2 className="mt-4 text-xl leading-snug font-bold text-pretty break-words sm:text-2xl">
                      {atual.data.frente}
                    </h2>

                    {mostrando && (
                      <div className="motion-safe:animate-revelar mt-6 border-t border-line pt-5">
                        <p className="text-lg leading-snug font-bold break-words">{respostaDireta}</p>
                        {explicacao.length > 0 && (
                          <p className="mt-2 leading-relaxed whitespace-pre-line text-ink/85 break-words">
                            {explicacao.join('\n')}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>

            {erro && pendente && (
              <div className="mt-4 rounded-2xl border border-[var(--d2)] bg-surface p-4" role="alert">
                <p className="text-sm">
                  Sua avaliação não foi salva ({erro}). Verifique a conexão e tente de novo.
                </p>
                <button
                  onClick={() => void salvar(pendente)}
                  disabled={salvando}
                  className="foco mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60"
                >
                  {salvando ? 'Salvando…' : 'Tentar de novo'}
                </button>
              </div>
            )}

            <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="mx-auto max-w-xl">
                {!mostrando ? (
                  <button
                    onClick={mostrarResposta}
                    className="foco flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
                  >
                    Mostrar resposta
                    <kbd className="hidden rounded-md border border-current/30 px-1.5 text-xs font-medium opacity-70 sm:inline">
                      Espaço
                    </kbd>
                  </button>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {BOTOES.map((b) => (
                      <button
                        key={b.grade}
                        onClick={() => avaliar(b.grade)}
                        disabled={salvando || !!pendente}
                        aria-label={`${b.label}, próxima revisão em ${intervalos?.[b.grade]} (tecla ${b.tecla})`}
                        style={{ '--bc': b.cor } as CSSProperties}
                        className="foco flex flex-col items-center gap-0.5 rounded-2xl border-2 border-[var(--bc)] bg-[color-mix(in_srgb,var(--bc)_12%,var(--surface))] py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--bc)_24%,var(--surface))] active:bg-[color-mix(in_srgb,var(--bc)_32%,var(--surface))] disabled:opacity-50"
                      >
                        <span className="font-bold">{b.label}</span>
                        <span className="text-xs text-muted tabular-nums">{intervalos?.[b.grade]}</span>
                        <kbd className="hidden text-[10px] text-muted sm:block">{b.tecla}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      )}
    </div>
  )
}
