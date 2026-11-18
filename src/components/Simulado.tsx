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
import Cronometro from './Cronometro'
import QuestaoVisao from './QuestaoVisao'

/** Pausas da prova: o tempo pausado não conta. `desde` é o início da pausa atual (null = rodando) */
export type Pausa = { totalMs: number; desde: number | null }

export type EstadoSalvo = { idx: number; marcadas: Record<number, string[]>; pausa?: Pausa }

export type InfoFinal = { emBranco: number; brancos: number[]; tempoUsadoS: number; porTempo: boolean }

type Props = {
  userId: string
  itens: QuestaoDaProva[]
  simuladoId: string
  /** Quando o simulado começou: o cronômetro e o tempo salvo contam daqui */
  iniciadoEm: number
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

/** Nos últimos 20 minutos da prova o relógio fica vermelho */
const RETA_FINAL_MS = 20 * 60_000

/** Marca usada nas simulações (sem alternativas) quando você diz que já resolveu */
const RESOLVIDA = 'resolvida'

export default function Simulado({
  userId,
  itens,
  simuladoId,
  iniciadoEm,
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
  const [pausa, setPausa] = useState<Pausa>(inicial?.pausa ?? { totalMs: 0, desde: null })
  // Prova: o X abre a escolha entre encerrar e sair para continuar depois
  const [saindo, setSaindo] = useState(false)
  const encerrando = useRef(false)
  const botaoPausa = useRef<HTMLButtonElement>(null)

  const { questao: q, ciclo } = itens[idx]
  const ultima = idx === itens.length - 1
  const atuais = marcadas[q.numero] ?? []
  const respondidas = itens.filter((x) => (marcadas[x.questao.numero] ?? []).length > 0).length
  const emBranco = itens.length - respondidas

  // O relógio da prova anda só fora das pausas: o início "efetivo" é empurrado pelo tempo pausado
  const pausada = prova !== undefined && pausa.desde !== null
  const inicioProva = prova ? prova.iniciadaEm + pausa.totalMs : 0
  const restanteMs = prova ? inicioProva + PROVA_DURACAO_MS - (pausa.desde ?? agora) : null
  const acabouTempo = restanteMs !== null && restanteMs <= 0
  const mostrarSaida = saindo && !acabouTempo

  useEffect(() => {
    onEstado?.({ idx, marcadas, pausa })
  }, [idx, marcadas, pausa, onEstado])

  function pausar() {
    if (!prova || pausada || acabouTempo || salvando) return
    setConfirmandoFim(false)
    setPausa((p) => ({ ...p, desde: Date.now() }))
  }

  function continuar() {
    const t = Date.now()
    setPausa((p) => (p.desde === null ? p : { totalMs: p.totalMs + (t - p.desde), desde: null }))
    setAgora(t)
    requestAnimationFrame(() => botaoPausa.current?.focus())
  }

  function alternar(letra: string) {
    if (acabouTempo || pausada) return
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
    if (salvando || acabouTempo || pausada) return
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
      // na prova, as pausas não entram no tempo usado
      const tempoUsadoS = Math.round(
        prova
          ? Math.min((pausa.desde ?? Date.now()) - (prova.iniciadaEm + pausa.totalMs), PROVA_DURACAO_MS) / 1000
          : (Date.now() - iniciadoEm) / 1000,
      )
      const brancos = itens.filter((x) => (marcadas[x.questao.numero] ?? []).length === 0).map((x) => x.questao.numero)
      onFinalizar(respostas, { emBranco: brancos.length, brancos, tempoUsadoS, porTempo })
    },
    [itens, marcadas, salvas, simuladoId, iniciadoEm, prova, pausa, userId, onFinalizar],
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

  /** Sai da prova sem encerrar: pausa e guarda na hora (o componente desmonta antes do efeito salvar) */
  function sairDepois() {
    onEstado?.({ idx, marcadas, pausa: pausa.desde === null ? { ...pausa, desde: Date.now() } : pausa })
    onSair()
  }

  function encerrar() {
    setSaindo(false)
    void finalizar(false)
  }

  async function sair() {
    if (prova) {
      setConfirmandoFim(false)
      setSaindo(true)
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
      if (mostrarSaida && e.key === 'Escape') return setSaindo(false)
      if (pausada || mostrarSaida || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
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
  // O relógio da prova sobe até 1h30 e fica vermelho nos últimos 20 minutos
  const corTimer = restanteMs === null ? '' : restanteMs <= RETA_FINAL_MS ? 'var(--d2)' : 'var(--ink)'
  const faixaTimer =
    restanteMs === null ? null : restanteMs <= 60_000 ? 'Falta menos de 1 minuto.' : restanteMs <= RETA_FINAL_MS ? 'Faltam 20 minutos ou menos.' : null

  return (
    <>
    {/* pausada: a prova fica inacessível (sem clique, teclado ou leitor de tela) até continuar */}
    <div
      inert={pausada || mostrarSaida}
      className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-36 sm:pb-10"
    >
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
        {prova ? (
          <>
            <Cronometro inicio={inicioProva} limiteMs={PROVA_DURACAO_MS} cor={corTimer} parado={pausa.desde ?? undefined} />
            <button
              ref={botaoPausa}
              onClick={pausar}
              disabled={salvando || acabouTempo}
              aria-label="Pausar a prova"
              title="Pausar"
              className="foco -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            >
              <IconePausa />
            </button>
          </>
        ) : (
          <Cronometro inicio={iniciadoEm} />
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

    {pausada && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pausa-titulo"
        aria-describedby="pausa-texto"
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg/50 p-6 backdrop-blur-2xl"
      >
        <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-line bg-surface p-7 text-center shadow-xl">
          <h2 id="pausa-titulo" className="text-2xl font-extrabold tracking-tight">
            Prova pausada
          </h2>
          <p id="pausa-texto" className="mt-2 text-muted">
            O tempo parou. A questão volta quando você continuar.
          </p>
          <div className="mt-5">
            <Cronometro inicio={inicioProva} limiteMs={PROVA_DURACAO_MS} cor={corTimer} parado={pausa.desde ?? undefined} />
          </div>
          <button
            autoFocus
            onClick={continuar}
            className="foco mt-6 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            Continuar
          </button>
          <button
            onClick={sairDepois}
            className="foco mt-2 w-full rounded-2xl border border-line py-3 font-bold transition-colors hover:bg-surface-2"
          >
            Sair e continuar depois
          </button>
          <p className="mt-3 text-xs text-muted">
            A prova fica guardada neste navegador, pausada. Para voltar, toque em "Retomar simulado de prova" na tela inicial.
          </p>
        </div>
      </div>
    )}

    {mostrarSaida && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sair-titulo"
        aria-describedby="sair-texto"
        onClick={(e) => e.target === e.currentTarget && setSaindo(false)}
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg/50 p-6 backdrop-blur-2xl"
      >
        <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-line bg-surface p-7 text-center shadow-xl">
          <h2 id="sair-titulo" className="text-2xl font-extrabold tracking-tight">
            Sair da prova?
          </h2>
          <p id="sair-texto" className="mt-2 text-muted">
            {emBranco > 0
              ? `${emBranco} ${emBranco === 1 ? 'questão está' : 'questões estão'} em branco.`
              : 'Todas as questões estão respondidas.'}
          </p>
          <button
            onClick={encerrar}
            disabled={salvando}
            className="foco mt-6 w-full rounded-2xl py-4 text-lg font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--d2)' }}
          >
            Encerrar a prova
          </button>
          <p className="mt-1.5 text-xs text-muted">Mostra o resultado agora. Questões em branco contam como erradas.</p>
          <button
            onClick={sairDepois}
            disabled={salvando}
            className="foco mt-4 w-full rounded-2xl border border-line py-3 font-bold transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            Sair e continuar depois
          </button>
          <p className="mt-1.5 text-xs text-muted">A prova é pausada e fica guardada neste navegador.</p>
          <button
            autoFocus
            onClick={() => setSaindo(false)}
            className="foco mt-4 rounded-full px-3 py-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            Voltar à prova
          </button>
        </div>
      </div>
    )}
    </>
  )
}

function IconePausa() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  )
}
