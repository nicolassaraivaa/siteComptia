import { useCallback, useState } from 'react'
import { FUSO } from '../config'
import { proximoVencimento, type Baralho, type Filtro } from '../lib/fila'
import { formatIntervalo } from '../lib/fsrs'
import type { Ofensiva } from '../lib/ofensiva'
import type { ProgressoMap } from '../lib/progresso'
import Castor from './Castor'
import NickolsVoando from './NickolsVoando'

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
  // decidido uma vez: a comemoração não pode mudar no meio do voo
  const [terminou] = useState(() => !proximo || proximo > new Date())
  // os textos aparecem depois que o Nickols pousa
  const [pousou, setPousou] = useState(!terminou)
  const onPouso = useCallback(() => setPousou(true), [])

  return (
    // o corte fica na tela inteira (não na coluna), para o voo usar a tela toda sem criar rolagem
    <div className="min-h-dvh overflow-hidden">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-10 text-center">
        {terminou ? (
          <NickolsVoando tamanho={200} onPouso={onPouso} />
        ) : (
          <Castor pose="neutro" tamanho={170} rotulo="Nickols, o castor" className="motion-safe:animate-castor-entrar" />
        )}

        <div className={`w-full ${pousou ? 'animate-surgir' : 'invisible'}`}>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{terminou ? 'Cards em dia!' : 'Sessão concluída'}</h1>
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
        </div>
      </main>
    </div>
  )
}
