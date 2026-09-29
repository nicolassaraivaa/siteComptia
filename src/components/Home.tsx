import { DOMINIOS } from '../config'
import { CARDS, type Dominio } from '../lib/cards'
import { diaSP, montarFila, type Filtro } from '../lib/fila'
import type { ProgressoMap } from '../lib/progresso'
import { supabase } from '../lib/supabase'

type Props = {
  email: string
  progresso: ProgressoMap
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  onComecar: () => void
}

const CHIPS: Filtro[] = ['todos', ...(Object.keys(DOMINIOS) as Dominio[])]

export default function Home({ email, progresso, filtro, onFiltro, onComecar }: Props) {
  const now = new Date()
  const hoje = diaSP(now)
  const fila = montarFila(progresso, filtro, now)

  const contadores = [
    { label: 'Em aprendizado', valor: fila.aprendizado.length },
    { label: 'Revisões vencidas', valor: fila.revisoes.length },
    { label: 'Novos (simulado)', valor: fila.novosSimulado.length },
    { label: 'Backlog restante hoje', valor: fila.novosBacklog.length },
  ]
  const totalFila = contadores.reduce((s, c) => s + c.valor, 0)

  const porDominio = (Object.keys(DOMINIOS) as Dominio[]).map((d) => {
    const cards = CARDS.filter((c) => c.dominio === d)
    let vencidos = 0
    let nuncaVistos = 0
    for (const c of cards) {
      const p = progresso.get(c.id)
      if (!p) nuncaVistos++
      else if (diaSP(p.card.due) <= hoje) vencidos++
    }
    return { d, total: cards.length, vencidos, nuncaVistos }
  })

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Sec+ Flashcards</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{email}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Sair
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => onFiltro(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filtro === c
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {c === 'todos' ? 'Todos' : c}
          </button>
        ))}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3">
        {contadores.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <div className="text-3xl font-bold tabular-nums">{c.valor}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{c.label}</div>
          </div>
        ))}
      </section>

      <button
        onClick={onComecar}
        className="mb-8 w-full rounded-xl bg-indigo-600 py-4 text-lg font-semibold text-white hover:bg-indigo-700"
      >
        Começar{totalFila > 0 ? ` (${totalFila})` : ''}
      </button>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500 uppercase dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Domínio</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Vencidos hoje</th>
              <th className="px-3 py-2 text-right font-medium">Nunca vistos</th>
            </tr>
          </thead>
          <tbody>
            {porDominio.map((r) => (
              <tr key={r.d} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2" title={DOMINIOS[r.d]}>
                  <span className="font-semibold">{r.d}</span>{' '}
                  <span className="hidden text-slate-500 sm:inline dark:text-slate-400">{DOMINIOS[r.d]}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.vencidos}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.nuncaVistos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
