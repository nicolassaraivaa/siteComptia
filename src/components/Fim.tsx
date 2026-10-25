import { FUSO } from '../config'
import Castor from './Castor'
import { proximoVencimento, type Baralho, type Filtro } from '../lib/fila'
import { formatIntervalo } from '../lib/fsrs'
import type { Ofensiva } from '../lib/ofensiva'
import type { ProgressoMap } from '../lib/progresso'

type Props = { baralho: Baralho; progresso: ProgressoMap; filtro: Filtro; ofensiva: Ofensiva; onVoltar: () => void }

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export default function Fim({ baralho, progresso, filtro, ofensiva, onVoltar }: Props) {
  const now = new Date()
  const proximo = proximoVencimento(baralho, progresso, filtro)
  const recorde = ofensiva.atual > 1 && ofensiva.atual === ofensiva.recorde
  const terminou = !proximo || proximo > now

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <Castor
        tamanho={170}
        animacao={terminou ? 'comemorando' : 'feliz'}
        className="motion-safe:animate-castor-entrar"
        rotulo={terminou ? 'Nickols, o castor, comemorando' : 'Nickols, o castor'}
      />

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{terminou ? 'Cards em dia!' : 'Sessão concluída'}</h1>
      {ofensiva.hojeFeito && (
        <p className="mt-2 text-lg font-bold">
          <span aria-hidden="true">🔥 </span>
          <span className="tabular-nums">
            {ofensiva.atual} {ofensiva.atual === 1 ? 'dia' : 'dias'}
          </span>{' '}
          <span className="text-flame">{recorde ? 'de ofensiva, novo recorde!' : 'de ofensiva'}</span>
        </p>
      )}

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
