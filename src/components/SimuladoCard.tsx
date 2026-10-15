import { useState } from 'react'
import type { EstadoCiclo } from '../lib/questoes'
import Painel, { IconeSimulado } from './Painel'

type Props = {
  total: number
  estado: EstadoCiclo | null
  /** Mensagem quando as questões não puderam ser carregadas */
  indisponivel: string | null
  onComecar: (quantidade: number) => void
}

const ATALHOS = [10, 20, 30, 60, 90]

export default function SimuladoCard({ total, estado, indisponivel, onComecar }: Props) {
  const [quantidade, setQuantidade] = useState('20')
  const descricao = 'Questões no formato da prova, sem repetir. Você vê o resultado no fim, e as erradas viram flashcards.'

  if (indisponivel || !estado) {
    return (
      <Painel icone={<IconeSimulado />} titulo="Simulado" descricao={descricao}>
        <p className="text-sm text-muted">{indisponivel ?? 'Carregando questões…'}</p>
      </Painel>
    )
  }

  const restantes = estado.restantes.length
  const vistas = total - restantes
  const n = Math.min(Math.max(parseInt(quantidade, 10) || 0, 0), restantes)
  const pct = total === 0 ? 0 : Math.round((vistas / total) * 100)
  const personalizada = !ATALHOS.includes(n)

  return (
    <Painel
      icone={<IconeSimulado />}
      titulo="Simulado"
      descricao={descricao}
      acao={
        <button
          type="submit"
          form="form-simulado"
          disabled={n === 0}
          className="foco w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {n > 0 ? `Começar simulado de ${n}` : 'Escolha a quantidade'}
        </button>
      }
    >
      <p className="flex items-baseline gap-2">
        <span className="text-5xl font-extrabold tracking-tight tabular-nums">{vistas}</span>
        <span className="font-bold">de {total} questões feitas</span>
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${vistas} de ${total} questões feitas nesta volta`}
      >
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {estado.ciclo > 1 ? `${estado.ciclo}ª volta pelo banco. ` : ''}
        {restantes === total ? 'Nenhuma feita ainda nesta volta.' : `Restam ${restantes} sem repetir.`}
      </p>

      <form
        id="form-simulado"
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (n > 0) onComecar(n)
        }}
      >
        <fieldset>
          <legend className="text-sm font-medium">Quantas questões?</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ATALHOS.filter((a) => a <= restantes).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={n === a}
                onClick={() => setQuantidade(String(a))}
                className={`foco min-w-12 rounded-xl border px-3 py-2 text-sm font-bold tabular-nums transition-colors ${
                  n === a ? 'border-ink bg-ink text-bg' : 'border-line hover:bg-surface-2'
                }`}
              >
                {a}
              </button>
            ))}
            <label className="sr-only" htmlFor="quantidade">
              Outra quantidade
            </label>
            <input
              id="quantidade"
              name="quantidade"
              type="number"
              inputMode="numeric"
              min={1}
              max={restantes}
              placeholder="Outra"
              value={personalizada ? quantidade : ''}
              onChange={(e) => setQuantidade(e.target.value)}
              autoComplete="off"
              className={`foco w-24 rounded-xl border px-3 py-2 text-sm tabular-nums ${
                personalizada && n > 0 ? 'border-ink' : 'border-line'
              } bg-surface`}
            />
          </div>
        </fieldset>
        {parseInt(quantidade, 10) > restantes && (
          <p className="mt-2 text-sm text-muted">Restam {restantes} nesta volta; o simulado terá {restantes}.</p>
        )}
      </form>
    </Painel>
  )
}
