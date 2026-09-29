import { FUSO } from '../config'
import { proximoVencimento, type Filtro } from '../lib/fila'
import { formatIntervalo } from '../lib/fsrs'
import type { Ofensiva } from '../lib/ofensiva'
import type { ProgressoMap } from '../lib/progresso'

type Props = { progresso: ProgressoMap; filtro: Filtro; ofensiva: Ofensiva; onVoltar: () => void }

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default function Fim({ progresso, filtro, ofensiva, onVoltar }: Props) {
  const now = new Date()
  const proximo = proximoVencimento(progresso, filtro)

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 text-center">
      {ofensiva.hojeFeito && (
        <div className="mb-8">
          <div className="text-6xl" aria-hidden>
            🔥
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums">
            {ofensiva.atual} {ofensiva.atual === 1 ? 'dia' : 'dias'} de ofensiva
          </div>
          {ofensiva.atual > 1 && ofensiva.atual === ofensiva.recorde && (
            <div className="mt-1 text-sm font-medium text-orange-600 dark:text-orange-400">Novo recorde!</div>
          )}
        </div>
      )}
      <h1 className="mb-3 text-2xl font-bold">Nada pra revisar agora</h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">
        {proximo
          ? proximo <= now
            ? 'Já há cards vencidos: volte e comece uma nova sessão.'
            : `Próximo card vence ${fmt.format(proximo)} (em ${formatIntervalo(proximo, now)}).`
          : 'Nenhum card revisado ainda neste filtro.'}
      </p>
      <button onClick={onVoltar} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
        Voltar
      </button>
    </div>
  )
}
