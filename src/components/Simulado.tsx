import { useCallback, useEffect, useState } from 'react'
import { DOMINIO_COR } from '../config'
import { corrigir, salvarResposta, type Questao, type Resposta } from '../lib/questoes'
import QuestaoVisao from './QuestaoVisao'

type Props = {
  userId: string
  questoes: Questao[]
  ciclo: number
  simuladoId: string
  onRespondida: (r: Resposta) => void
  onFinalizar: (respostas: Resposta[]) => void
  onSair: () => void
}

/** Marca usada nas simulações (sem alternativas) quando você diz que já resolveu */
const RESOLVIDA = 'resolvida'

export default function Simulado({ userId, questoes, ciclo, simuladoId, onRespondida, onFinalizar, onSair }: Props) {
  const [idx, setIdx] = useState(0)
  const [marcadas, setMarcadas] = useState<Record<number, string[]>>({})
  const [salvas, setSalvas] = useState<Record<number, Resposta>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoFim, setConfirmandoFim] = useState(false)

  const q = questoes[idx]
  const ultima = idx === questoes.length - 1
  const atuais = marcadas[q.numero] ?? []
  const respondidas = questoes.filter((x) => (marcadas[x.numero] ?? []).length > 0).length

  function alternar(letra: string) {
    setMarcadas((m) => {
      const atual = m[q.numero] ?? []
      let nova: string[]
      if (q.tipo !== 'multipla') nova = atual[0] === letra ? [] : [letra]
      else if (atual.includes(letra)) nova = atual.filter((l) => l !== letra)
      else nova = atual.length >= q.escolha ? [...atual.slice(1), letra] : [...atual, letra]
      return { ...m, [q.numero]: nova.sort() }
    })
  }

  /**
   * Salva a questão atual se ela foi respondida e mudou desde o último salvamento.
   * Devolve a resposta salva (null se não respondida) ou false se o salvamento falhou.
   */
  const salvarAtual = useCallback(async (): Promise<Resposta | null | false> => {
    const m = marcadas[q.numero] ?? []
    if (m.length === 0) return null
    const letras = q.tipo === 'simulacao' ? [] : m
    const anterior = salvas[q.numero]
    if (anterior && anterior.marcadas.join() === letras.join()) return anterior
    const r: Resposta = {
      questao: q.numero,
      ciclo,
      simulado_id: simuladoId,
      marcadas: letras,
      resultado: corrigir(q, letras),
      respondida_em: new Date().toISOString(),
    }
    setSalvando(true)
    setErro(null)
    try {
      await salvarResposta(userId, r)
    } catch (e) {
      setErro((e as Error).message || 'Falha ao salvar')
      setSalvando(false)
      return false
    }
    setSalvas((s) => ({ ...s, [q.numero]: r }))
    onRespondida(r)
    setSalvando(false)
    return r
  }, [marcadas, q, salvas, ciclo, simuladoId, userId, onRespondida])

  async function irPara(novo: number) {
    if (salvando) return
    if ((await salvarAtual()) === false) return
    setConfirmandoFim(false)
    setIdx(novo)
    window.scrollTo({ top: 0 })
  }

  async function finalizar(forcar = false) {
    if (salvando) return
    const atual = await salvarAtual()
    if (atual === false) return
    const faltam = questoes.length - respondidas
    if (faltam > 0 && !forcar) {
      setConfirmandoFim(true)
      return
    }
    // o state "salvas" ainda não reflete a questão atual neste render
    const todas: Record<number, Resposta> = atual ? { ...salvas, [q.numero]: atual } : salvas
    onFinalizar(questoes.map((x) => todas[x.numero]).filter(Boolean))
  }

  async function sair() {
    if (!window.confirm('Sair do simulado? As questões já respondidas ficam salvas e não voltam no sorteio deste ciclo.')) return
    if ((await salvarAtual()) === false) return
    onSair()
  }

  // Atalhos: letras marcam alternativas, setas navegam
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const alvo = e.target as HTMLElement
      if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA') return
      const letra = e.key.toUpperCase()
      if (q.alternativas.some((a) => a.letra === letra)) alternar(letra)
      else if (e.key === 'ArrowRight' && !ultima) void irPara(idx + 1)
      else if (e.key === 'ArrowLeft' && idx > 0) void irPara(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pct = Math.round((respondidas / questoes.length) * 100)
  const multiplaIncompleta = q.tipo === 'multipla' && atuais.length > 0 && atuais.length < q.escolha

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-36 sm:pb-10">
      <h1 className="sr-only">Simulado</h1>
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={sair}
          aria-label="Sair do simulado"
          className="foco -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Questões respondidas"
          aria-valuemin={0}
          aria-valuemax={questoes.length}
          aria-valuenow={respondidas}
        >
          <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-muted tabular-nums">
          {idx + 1}/{questoes.length}
        </span>
      </header>

      <article key={q.numero} className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="h-1.5" style={{ background: DOMINIO_COR[q.dominio] }} aria-hidden="true" />
        <div className="p-5 sm:p-7">
          <p className="mb-4 text-sm text-muted">
            Questão {q.numero} do PDF · domínio {q.dominio}
          </p>
          <QuestaoVisao q={q} marcadas={atuais} onAlternar={q.tipo === 'simulacao' ? undefined : alternar} />
          {q.tipo === 'simulacao' && (
            <button
              type="button"
              aria-pressed={atuais.length > 0}
              onClick={() => setMarcadas((m) => ({ ...m, [q.numero]: atuais.length > 0 ? [] : [RESOLVIDA] }))}
              className={`foco mt-4 w-full rounded-2xl border-2 py-3 font-bold transition-colors ${
                atuais.length > 0 ? 'border-ink bg-surface-2' : 'border-line hover:bg-surface-2'
              }`}
            >
              {atuais.length > 0 ? '✓ Já resolvi' : 'Marcar como resolvida'}
            </button>
          )}
          {multiplaIncompleta && (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              Marque {q.escolha - atuais.length} alternativa a mais.
            </p>
          )}
        </div>
      </article>

      <div aria-live="polite">
        {erro && (
          <div className="mt-4 rounded-2xl border border-[var(--d2)] bg-surface p-4" role="alert">
            <p className="text-sm">Sua resposta não foi salva ({erro}). Verifique a conexão e toque em avançar de novo.</p>
          </div>
        )}
        {confirmandoFim && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm">
              {questoes.length - respondidas} {questoes.length - respondidas === 1 ? 'questão ficou' : 'questões ficaram'} sem
              resposta. Elas não contam na nota e continuam no sorteio deste ciclo.
            </p>
            <button
              onClick={() => void finalizar(true)}
              className="foco mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary"
            >
              Finalizar mesmo assim
            </button>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-xl gap-2">
          <button
            onClick={() => void irPara(idx - 1)}
            disabled={idx === 0 || salvando}
            className="foco rounded-2xl border border-line px-5 py-4 font-bold transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Anterior
          </button>
          {ultima ? (
            <button
              onClick={() => void finalizar()}
              disabled={salvando}
              className="foco flex-1 rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Finalizar simulado'}
            </button>
          ) : (
            <button
              onClick={() => void irPara(idx + 1)}
              disabled={salvando}
              className="foco flex-1 rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : atuais.length > 0 ? 'Próxima' : 'Pular'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
