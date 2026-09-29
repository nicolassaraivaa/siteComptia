import { FUSO } from '../config'
import { proximoVencimento, type Filtro } from '../lib/fila'
import { formatIntervalo } from '../lib/fsrs'
import type { ProgressoMap } from '../lib/progresso'

type Props = { progresso: ProgressoMap; filtro: Filtro; onVoltar: () => void }

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default function Fim({ progresso, filtro, onVoltar }: Props) {
  const now = new Date()
  const proximo = proximoVencimento(progresso, filtro)

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 text-center">
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
