import { useState } from 'react'
import { DOMINIO_COR, DOMINIOS } from '../config'
import type { Dominio } from '../lib/cards'
import { errou, salvarResposta, type Questao, type Resposta, type Resultado } from '../lib/questoes'
import QuestaoVisao from './QuestaoVisao'

type Props = {
  userId: string
  questoes: Questao[]
  respostas: Resposta[]
  onAtualizada: (r: Resposta) => void
  onVoltar: () => void
  /** Presente no simulado de prova */
  prova?: { tempoUsadoS: number; duracaoS: number; emBranco: number; brancos: number[]; porTempo: boolean }
}

/** Acerto a partir do qual consideramos "zona segura" (não é a nota oficial de 100 a 900) */
export const ZONA_SEGURA = 85

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

export default function SimuladoResultado({ userId, questoes, respostas: iniciais, onAtualizada, onVoltar, prova }: Props) {
  const [respostas, setRespostas] = useState(iniciais)
  const [erro, setErro] = useState<string | null>(null)
  const porQuestao = new Map(questoes.map((q) => [q.numero, q]))

  const corrigidas = respostas.filter((r) => r.resultado !== 'pendente')
  const certas = corrigidas.filter((r) => r.resultado === 'certa').length
  const parciais = corrigidas.filter((r) => r.resultado === 'parcial').length
  const erradas = corrigidas.filter((r) => r.resultado === 'errada').length
  const pendentes = respostas.length - corrigidas.length
  const pct = corrigidas.length === 0 ? 0 : Math.round((certas / corrigidas.length) * 100)

  const porDominio = (Object.keys(DOMINIOS) as Dominio[])
    .map((d) => {
      const rs = corrigidas.filter((r) => porQuestao.get(r.questao)?.dominio === d)
      return { d, total: rs.length, certas: rs.filter((r) => r.resultado === 'certa').length }
    })
    .filter((x) => x.total > 0)

  async function autocorrigir(r: Resposta, acertou: boolean) {
    const nova: Resposta = { ...r, resultado: acertou ? 'certa' : 'errada' }
    setErro(null)
    try {
      await salvarResposta(userId, nova)
    } catch (e) {
      setErro((e as Error).message)
      return
    }
    setRespostas((rs) => rs.map((x) => (x.questao === r.questao ? nova : x)))
    onAtualizada(nova)
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <h1 className="mt-4 text-sm text-muted">{prova ? 'Resultado do simulado de prova' : 'Resultado do simulado'}</h1>

      <section className="mt-2 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <p className="flex items-baseline gap-2 leading-none">
          <span className="text-6xl font-extrabold tracking-tight tabular-nums">{pct}%</span>
          <span className="text-lg font-bold">de acerto</span>
        </p>
        <p className="mt-2 text-muted tabular-nums">
          {certas} de {corrigidas.length} {corrigidas.length === 1 ? 'questão' : 'questões'}
        </p>
        {prova && (
          <div className="mt-4 flex flex-col gap-2">
            <p
              className="rounded-xl p-3 text-sm font-medium"
              style={{
                background: `color-mix(in srgb, ${pct >= ZONA_SEGURA ? 'var(--good)' : 'var(--d4)'} 14%, var(--surface))`,
              }}
            >
              {pct >= ZONA_SEGURA
                ? `Zona segura: ${ZONA_SEGURA}% ou mais de acerto.`
                : `Abaixo da zona segura (${ZONA_SEGURA}%). Faltaram ${Math.ceil((ZONA_SEGURA / 100) * corrigidas.length) - certas} acertos.`}{' '}
              <span className="font-normal text-muted">Referência de estudo, não é a nota oficial (100 a 900).</span>
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
        {erradas + parciais > 0 && (
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
                  <span className="w-1.5 self-stretch rounded-full" style={{ background: DOMINIO_COR[d] }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      <span className="font-bold">{d}</span> {DOMINIOS[d]}
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full" style={{ width: `${p}%`, background: DOMINIO_COR[d] }} />
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
        <h2 id="res-questoes" className="mb-3 px-1 font-bold">
          Correção
        </h2>
        <div aria-live="polite">
          {erro && (
            <p className="mb-3 text-sm text-[var(--d2)]" role="alert">
              Não foi possível salvar ({erro}). Tente de novo.
            </p>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {respostas.map((r, i) => {
            const q = porQuestao.get(r.questao)
            if (!q) return null
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
                      {prova?.brancos.includes(r.questao) ? 'Em branco' : ROTULO[r.resultado]}
                    </span>
                  </summary>
                  <div className="px-4">
                    <p className="mb-3 text-xs text-muted">
                      Questão {q.numero} do PDF · domínio {q.dominio}
                      {errou(r.resultado) && ' · foi para os flashcards'}
                    </p>
                    <QuestaoVisao q={q} marcadas={r.marcadas} revelar />
                    {q.tipo === 'simulacao' && !prova?.brancos.includes(q.numero) && (
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
        Voltar ao início
      </button>
    </main>
  )
}
