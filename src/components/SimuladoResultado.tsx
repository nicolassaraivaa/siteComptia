import { useMemo, useState } from 'react'
import { dominioDe } from '../certificacoes'
import { useCert } from '../lib/certContexto'
import { formatarSegundos } from '../lib/datas'
import {
  errou,
  reincidencia,
  resultadosAnteriores,
  salvarResposta,
  type Questao,
  type Reincidencia,
  type Resposta,
  type Resultado,
} from '../lib/questoes'
import { IconeCronometro } from './Cronometro'
import QuestaoVisao from './QuestaoVisao'

type Props = {
  userId: string
  questoes: Questao[]
  respostas: Resposta[]
  /** Todas as respostas da conta, para comparar cada questão com a volta anterior */
  todasRespostas: Resposta[]
  onAtualizada: (r: Resposta) => void
  onVoltar: () => void
  /** Questões que ficaram em branco (contaram como erradas) */
  brancos?: number[]
  /** Aberto pelo histórico: muda o título e o botão de voltar */
  doHistorico?: { titulo: string }
  /** Presente no simulado de prova */
  prova?: { tempoUsadoS: number; duracaoS: number; emBranco: number; porTempo: boolean }
  /** Tempo gasto no simulado normal, do início até finalizar (ausente nos antigos) */
  tempoS?: number
}


function formatarDuracao(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

const ROTULO: Record<Resultado, string> = {
  certa: 'Acertou',
  errada: 'Errou',
  parcial: 'Parcial',
  pendente: 'Corrija você',
}

const COR: Record<Resultado, string> = {
  certa: 'var(--good)',
  errada: 'var(--d2)',
  parcial: 'var(--d4)',
  pendente: 'var(--muted)',
}

const REINCIDENCIA: Record<Reincidencia, { titulo: string; texto: string; etiqueta: string; filtro: string; cor: string }> = {
  'de-novo': {
    titulo: 'Errou de novo',
    texto: 'já tinha errado na volta anterior',
    etiqueta: 'de novo',
    filtro: 'erros repetidos',
    cor: 'var(--d2)',
  },
  'primeira-vez': {
    titulo: 'Errou pela 1ª vez',
    texto: 'tinha acertado na volta anterior',
    etiqueta: '1ª vez',
    filtro: 'erros novos',
    cor: 'var(--d4)',
  },
}

export default function SimuladoResultado({
  userId,
  questoes,
  respostas: iniciais,
  todasRespostas,
  onAtualizada,
  onVoltar,
  doHistorico,
  brancos = [],
  prova,
  tempoS,
}: Props) {
  const cert = useCert()
  const ZONA = cert.zonaSegura
  const cor = (d: string) => dominioDe(cert, d).cor
  const nomeDominio = (d: string) => dominioDe(cert, d).nome
  const [respostas, setRespostas] = useState(iniciais)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Reincidencia | null>(null)
  const porQuestao = new Map(questoes.map((q) => [q.numero, q]))

  // Cada questão comparada com a volta anterior (vazio na 1ª volta)
  const anteriores = useMemo(() => resultadosAnteriores(todasRespostas, iniciais), [todasRespostas, iniciais])
  const reinc = (r: Resposta) => reincidencia(r.resultado, anteriores.get(r.questao))
  const recuperou = (r: Resposta) => {
    const a = anteriores.get(r.questao)
    return r.resultado === 'certa' && a !== undefined && errou(a)
  }
  const deNovo = respostas.filter((r) => reinc(r) === 'de-novo').length
  const primeiraVez = respostas.filter((r) => reinc(r) === 'primeira-vez').length
  const errosSemAnterior = respostas.filter((r) => errou(r.resultado) && reinc(r) === null).length
  const recuperadas = respostas.filter(recuperou).length
  const visiveis = respostas.map((r, i) => ({ r, i })).filter(({ r }) => filtro === null || reinc(r) === filtro)

  function filtrar(f: Reincidencia) {
    const novo = filtro === f ? null : f
    setFiltro(novo)
    if (novo) {
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById('res-questoes')?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' })
    }
  }

  const corrigidas = respostas.filter((r) => r.resultado !== 'pendente')
  const certas = corrigidas.filter((r) => r.resultado === 'certa').length
  const parciais = corrigidas.filter((r) => r.resultado === 'parcial').length
  const erradas = corrigidas.filter((r) => r.resultado === 'errada').length
  const pendentes = respostas.length - corrigidas.length
  const pct = corrigidas.length === 0 ? 0 : Math.round((certas / corrigidas.length) * 100)

  const porDominio = cert.dominios
    .map(({ id: d }) => {
      const rs = corrigidas.filter((r) => porQuestao.get(r.questao)?.dominio === d)
      return { d, total: rs.length, certas: rs.filter((r) => r.resultado === 'certa').length }
    })
    .filter((x) => x.total > 0)

  async function autocorrigir(r: Resposta, acertou: boolean) {
    const nova: Resposta = { ...r, resultado: acertou ? 'certa' : 'errada' }
    setErro(null)
    try {
      await salvarResposta(userId, cert.id, nova)
    } catch (e) {
      setErro((e as Error).message)
      return
    }
    setRespostas((rs) => rs.map((x) => (x.questao === r.questao ? nova : x)))
    onAtualizada(nova)
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      {doHistorico && (
        <button
          onClick={onVoltar}
          className="foco -ml-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span> Histórico
        </button>
      )}
      <h1 className="mt-4 text-sm text-muted">
        {prova ? 'Resultado do simulado de prova' : 'Resultado do simulado'}
        {doHistorico && ` · ${doHistorico.titulo}`}
      </h1>

      <section className="mt-2 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <p className="flex items-baseline gap-2 leading-none">
          <span className="text-6xl font-extrabold tracking-tight tabular-nums">{pct}%</span>
          <span className="text-lg font-bold">de acerto</span>
        </p>
        <p className="mt-2 text-muted tabular-nums">
          {certas} de {corrigidas.length} {corrigidas.length === 1 ? 'questão' : 'questões'}
        </p>
        {tempoS !== undefined && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted tabular-nums">
            <IconeCronometro />
            <span>
              <span className="sr-only">Tempo gasto: </span>
              <span className="font-bold text-ink">{formatarSegundos(tempoS)}</span>
              {respostas.length > 1 && ` · ${formatarSegundos(tempoS / respostas.length)} por questão, em média`}
            </span>
          </p>
        )}
        {prova && (
          <div className="mt-4 flex flex-col gap-2">
            <p
              className="rounded-xl p-3 text-sm font-medium"
              style={{
                background: `color-mix(in srgb, ${pct >= ZONA ? 'var(--good)' : 'var(--d4)'} 14%, var(--surface))`,
              }}
            >
              {pct >= ZONA
                ? `Zona segura: ${ZONA}% ou mais de acerto.`
                : `Abaixo da zona segura (${ZONA}%). Faltaram ${Math.ceil((ZONA / 100) * corrigidas.length) - certas} acertos.`}{' '}
              <span className="font-normal text-muted">Referência de estudo, não é a nota oficial.</span>
            </p>
            <p className="text-sm text-muted tabular-nums">
              {prova.porTempo ? 'Tempo esgotado' : `Tempo usado: ${formatarDuracao(prova.tempoUsadoS)} de ${formatarDuracao(prova.duracaoS)}`}
              {prova.emBranco > 0 &&
                `. ${prova.emBranco} ${prova.emBranco === 1 ? 'questão em branco contou' : 'questões em branco contaram'} como erro`}
              .
            </p>
          </div>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          {[
            { label: 'Acertos', valor: certas, cor: 'var(--good)' },
            { label: 'Erros', valor: erradas, cor: 'var(--d2)' },
            { label: 'Parciais', valor: parciais, cor: 'var(--d4)' },
          ].map((c) => (
            <div key={c.label} className="flex flex-col-reverse">
              <dt className="text-xs text-muted">{c.label}</dt>
              <dd className="text-2xl font-bold tabular-nums" style={{ color: c.cor }}>
                {c.valor}
              </dd>
            </div>
          ))}
        </dl>
        {!prova && brancos.length > 0 && (
          <p className="mt-4 text-sm text-muted tabular-nums">
            {brancos.length} {brancos.length === 1 ? 'questão em branco contou' : 'questões em branco contaram'} como erro.
          </p>
        )}
        {erradas + parciais > 0 && !doHistorico && (
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
            {erradas + parciais} {erradas + parciais === 1 ? 'questão foi' : 'questões foram'} para os flashcards e
            {erradas + parciais === 1 ? ' entra' : ' entram'} na sua revisão.
          </p>
        )}
        {pendentes > 0 && (
          <p className="mt-3 text-sm text-muted">
            {pendentes} {pendentes === 1 ? 'simulação aguarda' : 'simulações aguardam'} sua correção abaixo.
          </p>
        )}
      </section>

      {anteriores.size > 0 && (
        <section className="mt-6" aria-labelledby="res-volta">
          <h2 id="res-volta" className="px-1 font-bold">
            Comparado com a volta anterior
          </h2>
          <p className="mt-1 mb-3 px-1 text-sm text-muted">
            {deNovo + primeiraVez === 0
              ? 'Nenhum erro em questão que você já tinha feito.'
              : 'Toque num número para ver só essas questões na correção.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['de-novo', 'primeira-vez'] as const).map((id) => {
              const valor = id === 'de-novo' ? deNovo : primeiraVez
              const info = REINCIDENCIA[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => filtrar(id)}
                  disabled={valor === 0}
                  aria-pressed={filtro === id}
                  className={`foco rounded-2xl border-2 bg-surface p-4 text-left transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 ${
                    filtro === id ? 'border-ink' : 'border-line'
                  }`}
                >
                  <span className="block text-3xl font-extrabold tabular-nums" style={{ color: info.cor }}>
                    {valor}
                  </span>
                  <span className="mt-1 block text-sm font-bold">{info.titulo}</span>
                  <span className="block text-xs text-muted">{info.texto}</span>
                </button>
              )
            })}
          </div>
          {(recuperadas > 0 || errosSemAnterior > 0) && (
            <ul className="mt-3 flex flex-col gap-1 px-1 text-sm text-muted">
              {recuperadas > 0 && (
                <li>
                  <span className="font-bold" style={{ color: 'var(--good)' }}>
                    {recuperadas}
                  </span>{' '}
                  {recuperadas === 1 ? 'questão que você tinha errado agora está certa' : 'questões que você tinha errado agora estão certas'}.
                </li>
              )}
              {errosSemAnterior > 0 && (
                <li>
                  {errosSemAnterior} {errosSemAnterior === 1 ? 'erro foi em questão' : 'erros foram em questões'} que você ainda
                  não tinha feito.
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {porDominio.length > 0 && (
        <section className="mt-6" aria-labelledby="res-dominios">
          <h2 id="res-dominios" className="mb-3 px-1 font-bold">
            Por domínio
          </h2>
          <ul className="flex flex-col gap-2">
            {porDominio.map(({ d, total, certas: c }) => {
              const p = Math.round((c / total) * 100)
              return (
                <li key={d} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <span className="w-1.5 self-stretch rounded-full" style={{ background: cor(d) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      <span className="font-bold">{d}</span> {nomeDominio(d)}
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full" style={{ width: `${p}%`, background: cor(d) }} />
                    </span>
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums">
                    <span className="font-bold">{p}%</span>
                    <span className="block text-xs text-muted">
                      {c}/{total}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="res-questoes">
        <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
          <h2 id="res-questoes" className="scroll-mt-4 font-bold">
            Correção
            {filtro && <span className="font-normal text-muted"> · {REINCIDENCIA[filtro].filtro}</span>}
          </h2>
          {filtro && (
            <button
              type="button"
              onClick={() => setFiltro(null)}
              className="foco shrink-0 rounded-full px-2 py-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
            >
              Mostrar todas
            </button>
          )}
        </div>
        <div aria-live="polite">
          {erro && (
            <p className="mb-3 text-sm text-[var(--d2)]" role="alert">
              Não foi possível salvar ({erro}). Tente de novo.
            </p>
          )}
        </div>
        {filtro && visiveis.length === 0 && <p className="px-1 text-sm text-muted">Nenhuma questão neste filtro.</p>}
        <ul className="flex flex-col gap-2">
          {visiveis.map(({ r, i }) => {
            const q = porQuestao.get(r.questao)
            if (!q) return null
            const rq = reinc(r)
            const anterior = anteriores.get(r.questao)
            return (
              <li key={r.questao}>
                <details
                  open={r.resultado === 'pendente'}
                  className="group rounded-2xl border border-line bg-surface open:pb-4"
                >
                  <summary className="foco flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3">
                    <span className="w-6 text-sm text-muted tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{q.enunciado_pt}</span>
                    <span className="shrink-0 text-xs font-bold" style={{ color: COR[r.resultado] }}>
                      {brancos.includes(r.questao) ? 'Em branco' : ROTULO[r.resultado]}
                      {rq && <span className="font-medium"> · {REINCIDENCIA[rq].etiqueta}</span>}
                      {recuperou(r) && <span className="font-medium"> · antes errou</span>}
                    </span>
                  </summary>
                  <div className="px-4">
                    <p className="mb-3 text-xs text-muted">
                      Questão {q.numero} do PDF · domínio {q.dominio}
                      {anterior !== undefined && anterior !== 'pendente' && ` · na volta anterior: ${ROTULO[anterior].toLowerCase()}`}
                      {errou(r.resultado) && ' · foi para os flashcards'}
                    </p>
                    <QuestaoVisao q={q} marcadas={r.marcadas} revelar />
                    {q.tipo === 'simulacao' && !brancos.includes(q.numero) && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => void autocorrigir(r, true)}
                          aria-pressed={r.resultado === 'certa'}
                          className="foco flex-1 rounded-xl border-2 border-[var(--good)] py-3 font-bold"
                        >
                          Acertei
                        </button>
                        <button
                          onClick={() => void autocorrigir(r, false)}
                          aria-pressed={r.resultado === 'errada'}
                          className="foco flex-1 rounded-xl border-2 border-[var(--d2)] py-3 font-bold"
                        >
                          Errei
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <button
        onClick={onVoltar}
        className="foco mt-8 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
      >
        {doHistorico ? 'Voltar ao histórico' : 'Voltar ao início'}
      </button>
    </main>
  )
}
