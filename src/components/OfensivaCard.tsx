import type { Ofensiva } from '../lib/ofensiva'

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow', timeZone: 'UTC' })
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** Ofensiva em formato compacto: dias seguidos, o que fazer hoje e a semana */
export default function OfensivaCard({ ofensiva }: { ofensiva: Ofensiva }) {
  const { atual, hojeFeito, recorde, semana } = ofensiva
  const msg = hojeFeito
    ? 'Hoje já está garantido.'
    : atual > 0
      ? 'Revise 1 card ou responda 1 questão hoje para manter.'
      : 'Revise 1 card ou responda 1 questão para começar.'

  return (
    <div className="flex items-center gap-4" aria-label="Ofensiva">
      <div className="flex items-center gap-2">
        <span className={`text-3xl leading-none ${hojeFeito ? '' : 'opacity-40 grayscale'}`} aria-hidden="true">
          🔥
        </span>
        <div>
          <p className="font-extrabold tabular-nums">{atual === 1 ? '1 dia seguido' : `${atual} dias seguidos`}</p>
          <p className="text-xs text-muted">
            {msg}
            {recorde > 1 && ` Recorde: ${recorde}.`}
          </p>
        </div>
      </div>
      <ol className="flex gap-1">
        {semana.map(({ dia, feito }, i) => {
          const data = new Date(`${dia}T12:00:00Z`)
          const eHoje = i === semana.length - 1
          return (
            <li key={dia} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] ${eHoje ? 'font-bold text-ink' : 'text-muted'}`} aria-hidden="true">
                {fmtSemana.format(data).toUpperCase()}
              </span>
              <span
                className={`block h-5 w-5 rounded-full ${feito ? 'bg-flame' : 'bg-surface-2'} ${
                  eHoje && !feito ? 'border-2 border-dashed border-flame' : ''
                }`}
              >
                <span className="sr-only">
                  {fmtDia.format(data)}: {feito ? 'estudou' : 'não estudou'}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
