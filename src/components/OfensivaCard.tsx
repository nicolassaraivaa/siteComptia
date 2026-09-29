import type { Ofensiva } from '../lib/ofensiva'

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow', timeZone: 'UTC' })
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

export default function OfensivaCard({ ofensiva }: { ofensiva: Ofensiva }) {
  const { atual, hojeFeito, recorde, semana } = ofensiva
  const msg = hojeFeito
    ? 'Ofensiva de hoje garantida.'
    : atual > 0
      ? 'Revise 1 card hoje para manter.'
      : 'Revise 1 card para começar.'

  return (
    <section className="mt-4 rounded-3xl border border-line bg-surface p-5" aria-label="Ofensiva">
      <div className="flex items-center gap-3">
        <span className={`text-4xl leading-none ${hojeFeito ? '' : 'opacity-40 grayscale'}`} aria-hidden="true">
          🔥
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold tabular-nums">
            {atual} {atual === 1 ? 'dia seguido' : 'dias seguidos'}
          </p>
          <p className="text-sm text-muted">{msg}</p>
        </div>
        {recorde > 0 && (
          <p className="shrink-0 text-right text-xs text-muted">
            Recorde
            <span className="block text-lg font-bold text-ink tabular-nums">{recorde}</span>
          </p>
        )}
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1">
        {semana.map(({ dia, feito }, i) => {
          const data = new Date(`${dia}T12:00:00Z`)
          const eHoje = i === semana.length - 1
          return (
            <li key={dia} className="flex flex-col items-center gap-1.5">
              <span className={`text-xs ${eHoje ? 'font-bold text-ink' : 'text-muted'}`} aria-hidden="true">
                {fmtSemana.format(data).toUpperCase()}
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  feito ? 'bg-flame text-white' : 'bg-surface-2'
                } ${eHoje && !feito ? 'border-2 border-dashed border-flame' : ''}`}
              >
                <span className="sr-only">
                  {fmtDia.format(data)}: {feito ? 'revisou' : 'não revisou'}
                </span>
                <span aria-hidden="true">{feito ? '✓' : ''}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
