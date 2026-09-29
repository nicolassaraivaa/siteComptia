import { useCallback, useEffect, useMemo, useState } from 'react'
import { createEmptyCard, type Card, type Grade } from 'ts-fsrs'
import { DOMINIOS } from '../config'
import { montarFila, type Filtro, type ItemFila } from '../lib/fila'
import { BOTOES, emAprendizado, formatIntervalo, previa } from '../lib/fsrs'
import { salvarProgresso, type ProgressoMap } from '../lib/progresso'

type Props = {
  userId: string
  progresso: ProgressoMap
  filtro: Filtro
  onSalvo: (cardId: string, card: Card) => void
  onFim: () => void
  onSair: () => void
}

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

export default function Revisao({ userId, progresso, filtro, onSalvo, onFim, onSair }: Props) {
  const [sessao, setSessao] = useState<Sessao>(() => {
    const now = new Date()
    const fila = montarFila(progresso, filtro, now)
    return avancar(
      {
        principal: [...fila.revisoes, ...fila.novosSimulado, ...fila.novosBacklog],
        aprendendo: fila.aprendizado.map((i) => ({ data: i.data, card: i.card! })),
        atual: null,
        feitos: 0,
      },
      now,
    )
  })
  const [mostrando, setMostrando] = useState(false)
  const [preview, setPreview] = useState<{ now: Date; cards: Record<Grade, Card> } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [pendente, setPendente] = useState<{ item: ItemFila; card: Card } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => new Date())

  const { atual, aprendendo, principal, feitos } = sessao
  const esperando = !atual && aprendendo.length > 0
  const acabou = !atual && aprendendo.length === 0

  useEffect(() => {
    if (acabou) onFim()
  }, [acabou, onFim])

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
    setPreview({ now, cards: previa(atual.card ?? createEmptyCard(now), now) })
    setMostrando(true)
  }, [atual, mostrando])

  const salvar = useCallback(
    async (p: { item: ItemFila; card: Card }) => {
      setSalvando(true)
      setErro(null)
      try {
        await salvarProgresso(userId, p.item.data.id, p.card)
      } catch (e) {
        setErro((e as Error).message || 'Falha ao salvar')
        setPendente(p)
        setSalvando(false)
        return
      }
      onSalvo(p.item.data.id, p.card)
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
      void salvar({ item: atual, card: preview.cards[grade] })
    },
    [atual, preview, salvando, pendente, salvar],
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4 pb-40 sm:pb-8">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={onSair}
          aria-label="Voltar"
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          ✕
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-slate-500 tabular-nums dark:text-slate-400">
          {feitos}/{total}
        </span>
      </header>

      {esperando ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="mb-6 text-lg">Próximo card em {formatIntervalo(aprendendo[0].card.due, agora)}</p>
          <button
            onClick={() => setSessao((s) => avancar(s, new Date(), true))}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Revisar agora
          </button>
        </div>
      ) : (
        atual && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200"
                title={DOMINIOS[atual.data.dominio]}
              >
                {atual.data.dominio} · {DOMINIOS[atual.data.dominio]}
              </span>
              {!atual.card && <span className="text-xs text-slate-500 dark:text-slate-400">novo</span>}
            </div>

            <article className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
              <p className="text-lg leading-relaxed font-medium">{atual.data.frente}</p>
              {mostrando && (
                <>
                  <hr className="my-5 border-slate-200 dark:border-slate-700" />
                  <p className="leading-relaxed whitespace-pre-line">{atual.data.verso}</p>
                </>
              )}
            </article>

            {erro && pendente && (
              <div className="mt-4 rounded-xl bg-red-100 p-4 text-red-900 dark:bg-red-900/40 dark:text-red-100">
                <p className="mb-3 text-sm">Erro ao salvar: {erro}</p>
                <button
                  onClick={() => void salvar(pendente)}
                  disabled={salvando}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {salvando ? 'Salvando…' : 'Tentar de novo'}
                </button>
              </div>
            )}

            <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-slate-50/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 dark:border-slate-800 dark:bg-slate-950/95 sm:dark:bg-transparent">
              {!mostrando ? (
                <button
                  onClick={mostrarResposta}
                  className="w-full rounded-xl bg-indigo-600 py-4 text-lg font-semibold text-white hover:bg-indigo-700"
                >
                  Mostrar resposta <span className="hidden text-sm opacity-70 sm:inline">(Espaço)</span>
                </button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {BOTOES.map((b) => (
                    <button
                      key={b.grade}
                      onClick={() => avaliar(b.grade)}
                      disabled={salvando || !!pendente}
                      className={`flex flex-col items-center rounded-xl py-3 text-white disabled:opacity-50 ${b.cor}`}
                    >
                      <span className="font-semibold">{b.label}</span>
                      <span className="text-xs opacity-90">{intervalos?.[b.grade]}</span>
                      <span className="hidden text-[10px] opacity-60 sm:block">{b.tecla}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  )
}
