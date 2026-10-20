import { useCallback, useEffect, useRef, useState } from 'react'
import { DOMINIO_COR } from '../config'
import {
  corrigir,
  PROVA_DURACAO_MS,
  salvarResposta,
  salvarRespostas,
  type QuestaoDaProva,
  type Resposta,
} from '../lib/questoes'
import QuestaoVisao from './QuestaoVisao'

export type EstadoSalvo = { idx: number; marcadas: Record<number, string[]> }

export type InfoFinal = { emBranco: number; brancos: number[]; tempoUsadoS: number; porTempo: boolean }

type Props = {
  userId: string
  itens: QuestaoDaProva[]
  simuladoId: string
  /** Modo prova: timer de 1h30 a partir deste instante e questões em branco contam como erradas */
  prova?: { iniciadaEm: number }
  /** Estado para retomar (prova interrompida por recarregar a página) */
  inicial?: EstadoSalvo
  /** Chamado a cada mudança, para a prova poder ser retomada */
  onEstado?: (e: EstadoSalvo) => void
  onRespondida: (r: Resposta) => void
  onFinalizar: (respostas: Resposta[], info: InfoFinal) => void
  onSair: () => void
}

/** Marca usada nas simulações (sem alternativas) quando você diz que já resolveu */
const RESOLVIDA = 'resolvida'

function formatarTempo(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`
}

export default function Simulado({
  userId,
  itens,
  simuladoId,
  prova,
  inicial,
  onEstado,
  onRespondida,
  onFinalizar,
  onSair,
}: Props) {
  const [idx, setIdx] = useState(inicial?.idx ?? 0)
  const [marcadas, setMarcadas] = useState<Record<number, string[]>>(inicial?.marcadas ?? {})
  const [salvas, setSalvas] = useState<Record<number, Resposta>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoFim, setConfirmandoFim] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const encerrando = useRef(false)

  const { questao: q, ciclo } = itens[idx]
  const ultima = idx === itens.length - 1
  const atuais = marcadas[q.numero] ?? []
  const respondidas = itens.filter((x) => (marcadas[x.questao.numero] ?? []).length > 0).length
  const emBranco = itens.length - respondidas

  const restanteMs = prova ? prova.iniciadaEm + PROVA_DURACAO_MS - agora : null
  const acabouTempo = restanteMs !== null && restanteMs <= 0

  useEffect(() => {
    onEstado?.({ idx, marcadas })
  }, [idx, marcadas, onEstado])

  function alternar(letra: string) {
    if (acabouTempo) return
    setMarcadas((m) => {
      const atual = m[q.numero] ?? []
      let nova: string[]
      if (q.tipo !== 'multipla') nova = atual[0] === letra ? [] : [letra]
      else if (atual.includes(letra)) nova = atual.filter((l) => l !== letra)
      else nova = atual.length >= q.escolha ? [...atual.slice(1), letra] : [...atual, letra]
      return { ...m, [q.numero]: nova.sort() }
    })
  }

  /** Salva a questão atual se foi respondida e mudou. Devolve false se o salvamento falhou. */
  const salvarAtual = useCallback(async (): Promise<boolean> => {
    const m = marcadas[q.numero] ?? []
    if (m.length === 0) return true
    const letras = q.tipo === 'simulacao' ? [] : m
    const anterior = salvas[q.numero]
    if (anterior && anterior.marcadas.join() === letras.join()) return true
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
    return true
  }, [marcadas, q, ciclo, salvas, simuladoId, userId, onRespondida])

  async function irPara(novo: number) {
    if (salvando || acabouTempo) return
    if (!(await salvarAtual())) return
    setConfirmandoFim(false)
    setIdx(novo)
    window.scrollTo({ top: 0 })
  }

  /**
   * Corrige e grava tudo de uma vez. Questões em branco contam como erradas (e vão para os
   * flashcards), tanto no simulado normal quanto na prova, como na prova real.
   */
  const finalizar = useCallback(
    async (porTempo: boolean) => {
      if (encerrando.current) return
      encerrando.current = true
      const agoraIso = new Date().toISOString()
      const respostas: Resposta[] = []
      for (const { questao, ciclo: c } of itens) {
        const m = marcadas[questao.numero] ?? []
        if (m.length > 0) {
          const letras = questao.tipo === 'simulacao' ? [] : m
          respostas.push({
            questao: questao.numero,
            ciclo: c,
            simulado_id: simuladoId,
            marcadas: letras,
            resultado: corrigir(questao, letras),
            respondida_em: salvas[questao.numero]?.respondida_em ?? agoraIso,
          })
        } else {
          respostas.push({
            questao: questao.numero,
            ciclo: c,
            simulado_id: simuladoId,
            marcadas: [],
            resultado: 'errada',
            respondida_em: agoraIso,
          })
        }
      }
      setSalvando(true)
      setErro(null)
      try {
        await salvarRespostas(userId, respostas)
      } catch (e) {
        setErro((e as Error).message || 'Falha ao salvar')
        setSalvando(false)
        encerrando.current = false
        return
      }
      setSalvando(false)
      const tempoUsadoS = prova ? Math.round(Math.min(Date.now() - prova.iniciadaEm, PROVA_DURACAO_MS) / 1000) : 0
      const brancos = itens.filter((x) => (marcadas[x.questao.numero] ?? []).length === 0).map((x) => x.questao.numero)
      onFinalizar(respostas, { emBranco: brancos.length, brancos, tempoUsadoS, porTempo })
    },
    [itens, marcadas, salvas, simuladoId, prova, userId, onFinalizar],
  )

  async function pedirFinalizar(forcar = false) {
    if (salvando) return
    if (!(await salvarAtual())) return
    if (emBranco > 0 && !forcar) {
      setConfirmandoFim(true)
      return
    }
    await finalizar(false)
  }

  async function sair() {
    if (prova) {
      const msg =
        emBranco > 0
          ? `Encerrar a prova agora? ${emBranco} ${emBranco === 1 ? 'questão em branco conta' : 'questões em branco contam'} como erradas.`
          : 'Encerrar a prova agora e ver o resultado?'
      if (!window.confirm(msg)) return
      await finalizar(false)
      return
    }
    if (!window.confirm('Sair do simulado? As questões já respondidas ficam salvas e não voltam no sorteio deste ciclo.')) return
    if (!(await salvarAtual())) return
    onSair()
  }

  // Timer da prova
  useEffect(() => {
    if (!prova) return
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [prova])

  // Tempo esgotado: encerra sozinho, com as em branco como erradas
  useEffect(() => {
    if (acabouTempo) void finalizar(true)
  }, [acabouTempo, finalizar])

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

  // A barra acompanha a posição, como o "11/13" ao lado; as em branco são avisadas ao finalizar
  const pct = Math.round(((idx + 1) / itens.length) * 100)
  const multiplaIncompleta = q.tipo === 'multipla' && atuais.length > 0 && atuais.length < q.escolha
  const corTimer =
    restanteMs === null ? '' : restanteMs <= 60_000 ? 'var(--d2)' : restanteMs <= 10 * 60_000 ? 'var(--d4)' : 'var(--ink)'
  const faixaTimer =
    restanteMs === null ? null : restanteMs <= 60_000 ? 'Falta menos de 1 minuto.' : restanteMs <= 10 * 60_000 ? 'Faltam 10 minutos ou menos.' : null

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-36 sm:pb-10">
      <h1 className="sr-only">{prova ? 'Simulado de prova' : 'Simulado'}</h1>
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={sair}
          aria-label={prova ? 'Encerrar a prova' : 'Sair do simulado'}
          className="foco -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Posição no simulado"
          aria-valuemin={1}
          aria-valuemax={itens.length}
          aria-valuenow={idx + 1}
        >
          <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-muted tabular-nums">
          {idx + 1}/{itens.length}
        </span>
        {restanteMs !== null && (
          <span
            className="rounded-full border-2 px-3 py-1 text-sm font-extrabold tabular-nums"
            style={{ borderColor: corTimer, color: corTimer }}
            role="timer"
            aria-label={`Tempo restante ${formatarTempo(restanteMs)}`}
          >
            {formatarTempo(restanteMs)}
          </span>
        )}
      </header>
      <p className="sr-only" aria-live="assertive">
        {faixaTimer}
      </p>

      <article key={q.numero} className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="h-1.5" style={{ background: DOMINIO_COR[q.dominio] }} aria-hidden="true" />
        <div className="p-5 sm:p-7">
          <p className="mb-4 text-sm text-muted">
            Questão {idx + 1} de {itens.length} · domínio {q.dominio}
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
        {acabouTempo && (
          <div className="mt-4 rounded-2xl border-2 border-[var(--d2)] bg-surface p-4" role="alert">
            <p className="font-bold">Tempo esgotado</p>
            <p className="text-sm">
              {salvando ? 'Salvando suas respostas…' : 'As questões em branco contam como erradas.'}
            </p>
          </div>
        )}
        {erro && (
          <div className="mt-4 rounded-2xl border border-[var(--d2)] bg-surface p-4" role="alert">
            <p className="text-sm">Suas respostas não foram salvas ({erro}). Verifique a conexão e tente de novo.</p>
            {acabouTempo && (
              <button
                onClick={() => void finalizar(true)}
                className="foco mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary"
              >
                Tentar salvar de novo
              </button>
            )}
          </div>
        )}
        {confirmandoFim && !acabouTempo && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm">
              {emBranco} {emBranco === 1 ? 'questão ficou' : 'questões ficaram'} em branco.{' '}
              Questões em branco contam como erradas e vão para os flashcards.
            </p>
            <button
              onClick={() => void pedirFinalizar(true)}
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
            disabled={idx === 0 || salvando || acabouTempo}
            className="foco rounded-2xl border border-line px-5 py-4 font-bold transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Anterior
          </button>
          {ultima ? (
            <button
              onClick={() => void pedirFinalizar()}
              disabled={salvando || acabouTempo}
              className="foco flex-1 rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : prova ? 'Finalizar prova' : 'Finalizar simulado'}
            </button>
          ) : (
            <button
              onClick={() => void irPara(idx + 1)}
              disabled={salvando || acabouTempo}
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
