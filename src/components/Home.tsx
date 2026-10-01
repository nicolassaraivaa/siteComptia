import type { CSSProperties } from 'react'
import { DATA_PROVA, DATA_PROVA_TEXTO, DOMINIO_COR, DOMINIOS } from '../config'
import { CARDS, type Dominio } from '../lib/cards'
import { diasEntre } from '../lib/datas'
import { diaSP, montarFila, type Filtro } from '../lib/fila'
import type { Ofensiva } from '../lib/ofensiva'
import type { ProgressoMap } from '../lib/progresso'
import { supabase } from '../lib/supabase'
import OfensivaCard from './OfensivaCard'

type Props = {
  email: string
  progresso: ProgressoMap
  ofensiva: Ofensiva
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  onComecar: () => void
}

const LISTA_DOMINIOS = Object.keys(DOMINIOS) as Dominio[]

/** Abaixo disso a porcentagem de acerto ainda não diz nada */
const MIN_REVISOES_ACERTO = 5

function acerto(revisoes: number, erros: number): number | null {
  return revisoes < MIN_REVISOES_ACERTO ? null : Math.round(((revisoes - erros) / revisoes) * 100)
}

export default function Home({ email, progresso, ofensiva, filtro, onFiltro, onComecar }: Props) {
  const now = new Date()
  const hoje = diaSP(now)
  const fila = montarFila(progresso, filtro, now)
  const diasProva = diasEntre(hoje, DATA_PROVA)

  const contadores = [
    { label: 'Aprendendo', valor: fila.aprendizado.length },
    { label: 'Vencidos', valor: fila.revisoes.length },
    { label: 'Novos', valor: fila.novosSimulado.length },
    { label: 'Backlog', valor: fila.novosBacklog.length },
  ]
  const totalFila = contadores.reduce((s, c) => s + c.valor, 0)

  const porDominio = LISTA_DOMINIOS.map((d) => {
    const cards = CARDS.filter((c) => c.dominio === d)
    let pendentes = 0
    let vistos = 0
    let revisoes = 0
    let erros = 0
    for (const c of cards) {
      const p = progresso.get(c.id)
      if (!p) pendentes++
      else {
        vistos++
        revisoes += p.stats.revisoes
        erros += p.stats.erros
        if (p.card.due <= now) pendentes++
      }
    }
    return { d, total: cards.length, vistos, pendentes, revisoes, erros }
  })
  const totalCards = CARDS.length
  const totalVistos = porDominio.reduce((s, r) => s + r.vistos, 0)
  const acertoGeral = acerto(
    porDominio.reduce((s, r) => s + r.revisoes, 0),
    porDominio.reduce((s, r) => s + r.erros, 0),
  )

  return (
    <div className="mx-auto max-w-xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-3">
        <h1 className="text-lg font-extrabold tracking-tight">Sec+ Flashcards</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          title={email}
          className="foco rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Sair
        </button>
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm text-muted">
          {diasProva > 0 ? `Faltam para a prova (${DATA_PROVA_TEXTO})` : diasProva === 0 ? 'A prova é hoje' : 'Prova realizada'}
        </p>
        {diasProva > 0 && (
          <p className="mt-1 flex items-baseline gap-2 leading-none">
            <span className="text-6xl font-extrabold tracking-tight tabular-nums">{diasProva}</span>
            <span className="text-xl font-bold">{diasProva === 1 ? 'dia' : 'dias'}</span>
          </p>
        )}

        <button
          onClick={onComecar}
          disabled={totalFila === 0}
          className="foco mt-6 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {totalFila > 0 ? `Revisar ${totalFila} ${totalFila === 1 ? 'card' : 'cards'}` : 'Tudo revisado por agora'}
        </button>
        {filtro !== 'todos' && (
          <p className="mt-2 text-center text-sm text-muted">
            Filtrando pelo domínio {filtro}.{' '}
            <button onClick={() => onFiltro('todos')} className="foco rounded font-medium text-ink underline underline-offset-2">
              Ver todos
            </button>
          </p>
        )}

        <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
          {contadores.map((c) => (
            <div key={c.label} className="flex flex-col-reverse">
              <dt className="text-xs text-muted">{c.label}</dt>
              <dd className="text-xl font-bold tabular-nums">{c.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <OfensivaCard ofensiva={ofensiva} />

      <section className="mt-8" aria-labelledby="dominios-titulo">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 id="dominios-titulo" className="text-base font-bold">
            Domínios
          </h2>
          <span className="text-sm text-muted tabular-nums">
            {totalVistos} de {totalCards} vistos
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          <li>
            <BotaoDominio
              ativo={filtro === 'todos'}
              onClick={() => onFiltro('todos')}
              cor="var(--ink)"
              titulo="Todos os domínios"
              vistos={totalVistos}
              total={totalCards}
              pendentes={porDominio.reduce((s, r) => s + r.pendentes, 0)}
              acerto={acertoGeral}
            />
          </li>
          {porDominio.map((r) => (
            <li key={r.d}>
              <BotaoDominio
                ativo={filtro === r.d}
                onClick={() => onFiltro(r.d)}
                cor={DOMINIO_COR[r.d]}
                numero={r.d}
                titulo={DOMINIOS[r.d]}
                vistos={r.vistos}
                total={r.total}
                pendentes={r.pendentes}
                acerto={acerto(r.revisoes, r.erros)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

type BotaoDominioProps = {
  ativo: boolean
  onClick: () => void
  cor: string
  numero?: string
  titulo: string
  vistos: number
  total: number
  pendentes: number
  acerto: number | null
}

function corAcerto(pct: number): string {
  if (pct < 70) return 'var(--d2)'
  if (pct < 85) return 'var(--d4)'
  return 'var(--good)'
}

function BotaoDominio({ ativo, onClick, cor, numero, titulo, vistos, total, pendentes, acerto }: BotaoDominioProps) {
  const pct = total === 0 ? 0 : Math.round((vistos / total) * 100)
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      style={{ '--dc': cor } as CSSProperties}
      className={`foco flex w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left transition-colors hover:bg-surface-2 ${
        ativo ? 'border-[var(--dc)] ring-1 ring-[var(--dc)]' : 'border-line'
      }`}
    >
      <span className="w-1.5 shrink-0 self-stretch rounded-full bg-[var(--dc)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          {numero && <span className="font-bold tabular-nums">{numero}</span>}
          <span className="line-clamp-2 text-sm leading-snug font-medium">{titulo}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-[var(--dc)]" style={{ width: `${pct}%` }} />
          </span>
          <span className="w-14 shrink-0 text-right text-xs text-muted tabular-nums">
            {vistos}/{total}
          </span>
        </span>
        <span className="mt-1 block text-xs text-muted">
          {acerto === null ? (
            'Acerto: poucas revisões ainda'
          ) : (
            <>
              Acerto:{' '}
              <span className="font-bold tabular-nums" style={{ color: corAcerto(acerto) }}>
                {acerto}%
              </span>
            </>
          )}
        </span>
      </span>
      <span className="w-12 shrink-0 text-right">
        <span className="block text-base font-bold tabular-nums">{pendentes}</span>
        <span className="block text-[11px] leading-tight text-muted">pendentes</span>
      </span>
    </button>
  )
}
