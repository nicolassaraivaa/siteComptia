import type { Prova, Resposta } from '../lib/questoes'
import { ZONA_SEGURA } from './SimuladoResultado'

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function minutos(s: number) {
  return `${Math.round(s / 60)} min`
}

/** Provas já feitas, da mais recente para a mais antiga, com a nota calculada das respostas */
export default function HistoricoProvas({ provas, respostas }: { provas: Prova[]; respostas: Resposta[] }) {
  return (
    <section aria-labelledby="historico-titulo" className="mt-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="historico-titulo" className="text-xl font-extrabold">
          Suas provas
        </h2>
        <p className="text-sm text-muted">Simulados de prova (90 questões, 1h30).</p>
      </div>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
        {provas.map((p) => {
          const rs = respostas.filter((r) => r.simulado_id === p.id && r.resultado !== 'pendente')
          const certas = rs.filter((r) => r.resultado === 'certa').length
          const pct = rs.length === 0 ? null : Math.round((certas / rs.length) * 100)
          const segura = pct !== null && pct >= ZONA_SEGURA
          return (
            <li
              key={p.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-line px-4 py-3 last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{fmtData.format(new Date(p.finalizada_em))}</span>
                <span className="block text-xs text-muted tabular-nums">
                  {certas} de {p.total} certas · {minutos(p.tempo_usado_s)}
                  {p.em_branco > 0 && ` · ${p.em_branco} em branco`}
                </span>
              </span>
              <span className="text-right">
                <span
                  className="block text-lg font-extrabold tabular-nums"
                  style={{ color: pct === null ? undefined : segura ? 'var(--good)' : 'var(--ink)' }}
                >
                  {pct === null ? '—' : `${pct}%`}
                </span>
                {segura && <span className="block text-xs text-[var(--good)]">zona segura</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
