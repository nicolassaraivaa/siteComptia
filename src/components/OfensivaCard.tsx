import type { Ofensiva } from '../lib/ofensiva'

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function OfensivaCard({ ofensiva }: { ofensiva: Ofensiva }) {
  const { atual, hojeFeito, recorde, semana } = ofensiva
  const msg = hojeFeito
    ? 'Ofensiva de hoje garantida!'
    : atual > 0
      ? 'Revise 1 card hoje para não perder a ofensiva.'
      : 'Revise 1 card para começar uma ofensiva.'

  return (
    <section className="mb-6 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`text-4xl ${hojeFeito ? '' : 'opacity-40 grayscale'}`} aria-hidden>
          🔥
        </span>
        <div className="flex-1">
          <div className="text-2xl font-bold tabular-nums">
            {atual} {atual === 1 ? 'dia' : 'dias'}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{msg}</div>
        </div>
        {recorde > 0 && (
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            Recorde
            <div className="text-base font-semibold text-slate-700 tabular-nums dark:text-slate-200">{recorde}</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-between">
        {semana.map(({ dia, feito }, i) => (
          <div key={dia} className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {LETRAS[new Date(`${dia}T12:00:00Z`).getUTCDay()]}
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                feito ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800'
              } ${i === semana.length - 1 ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}`}
            >
              {feito ? '✓' : ''}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
