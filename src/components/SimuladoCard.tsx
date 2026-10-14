import { useState } from 'react'
import type { EstadoCiclo } from '../lib/questoes'

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

  if (indisponivel || !estado) {
    return (
      <section className="mt-4 rounded-3xl border border-dashed border-line bg-surface p-5" aria-labelledby="simulado-titulo">
        <h2 id="simulado-titulo" className="text-lg font-extrabold">
          Simulado
        </h2>
        <p className="mt-1 text-sm text-muted">{indisponivel ?? 'Carregando questões…'}</p>
      </section>
    )
  }

  const restantes = estado.restantes.length
  const vistas = total - restantes
  const n = Math.min(Math.max(parseInt(quantidade, 10) || 0, 0), restantes)
  const pct = total === 0 ? 0 : Math.round((vistas / total) * 100)

  return (
    <section className="mt-4 rounded-3xl border border-line bg-surface p-5" aria-labelledby="simulado-titulo">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="simulado-titulo" className="text-lg font-extrabold">
          Simulado
        </h2>
        <span className="text-sm text-muted tabular-nums">
          {estado.ciclo > 1 ? `${estado.ciclo}ª volta · ` : ''}
          {vistas} de {total} feitas
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        Sem repetir: só caem questões que você ainda não fez nesta volta. Você vê o resultado no fim, e as que errar vão
        para os flashcards.
      </p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (n > 0) onComecar(n)
        }}
      >
        <label htmlFor="quantidade" className="text-sm font-medium">
          Quantas questões?
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ATALHOS.filter((a) => a <= restantes).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={n === a}
              onClick={() => setQuantidade(String(a))}
              className={`foco rounded-full border px-4 py-1.5 text-sm font-bold tabular-nums transition-colors ${
                n === a ? 'border-ink bg-ink text-bg' : 'border-line hover:bg-surface-2'
              }`}
            >
              {a}
            </button>
          ))}
          <input
            id="quantidade"
            name="quantidade"
            type="number"
            inputMode="numeric"
            min={1}
            max={restantes}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            autoComplete="off"
            className="foco w-24 rounded-full border border-line bg-surface px-4 py-1.5 text-sm tabular-nums"
          />
        </div>
        {parseInt(quantidade, 10) > restantes && (
          <p className="mt-2 text-sm text-muted">Restam {restantes} nesta volta; o simulado terá {restantes}.</p>
        )}
        <button
          type="submit"
          disabled={n === 0}
          className="foco mt-4 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {n > 0 ? `Começar simulado de ${n}` : 'Escolha a quantidade'}
        </button>
      </form>
    </section>
  )
}
