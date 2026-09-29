import { FUSO } from '../config'
import { proximoVencimento, type Filtro } from '../lib/fila'
import { formatIntervalo } from '../lib/fsrs'
import type { Ofensiva } from '../lib/ofensiva'
import type { ProgressoMap } from '../lib/progresso'

type Props = { progresso: ProgressoMap; filtro: Filtro; ofensiva: Ofensiva; onVoltar: () => void }

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export default function Fim({ progresso, filtro, ofensiva, onVoltar }: Props) {
  const now = new Date()
  const proximo = proximoVencimento(progresso, filtro)
  const recorde = ofensiva.atual > 1 && ofensiva.atual === ofensiva.recorde

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      {ofensiva.hojeFeito && (
        <div className="mb-10">
          <div className="text-7xl leading-none motion-safe:animate-revelar" aria-hidden="true">
            🔥
          </div>
          <p className="mt-3 text-4xl font-extrabold tabular-nums">
            {ofensiva.atual} {ofensiva.atual === 1 ? 'dia' : 'dias'}
          </p>
          <p className="mt-1 font-medium text-flame">{recorde ? 'Novo recorde de ofensiva' : 'de ofensiva'}</p>
        </div>
      )}

      <h1 className="text-2xl font-bold">Nada para revisar agora</h1>
      <p className="mt-2 text-muted">
        {proximo
          ? proximo <= now
            ? 'Já há cards vencidos. Volte ao início e comece outra sessão.'
            : `O próximo card vence ${fmt.format(proximo)}, daqui a ${formatIntervalo(proximo, now)}.`
          : 'Nenhum card deste filtro foi revisado ainda.'}
      </p>

      <button
        onClick={onVoltar}
        className="foco mt-8 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
      >
        Voltar ao início
      </button>
    </main>
  )
}
