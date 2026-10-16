import type { CSSProperties, ReactNode } from 'react'
import { DOMINIO_COR, DOMINIOS } from '../config'
import type { Dominio } from '../lib/cards'
import { diasEntre, formatarDataProva } from '../lib/datas'
import { diaSP, montarFila, type Baralho, type Filtro } from '../lib/fila'
import type { Ofensiva } from '../lib/ofensiva'
import type { ProgressoMap } from '../lib/progresso'
import MenuConta from './MenuConta'
import OfensivaCard from './OfensivaCard'
import Painel, { IconeFlashcards } from './Painel'

type Props = {
  email: string
  baralho: Baralho
  dataProva: string | null
  onAlterarDataProva: () => void
  simulado: ReactNode
  historico?: ReactNode
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

function corAcerto(pct: number): string {
  if (pct < 70) return 'var(--d2)'
  if (pct < 85) return 'var(--d4)'
  return 'var(--good)'
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

export default function Home({
  email,
  baralho,
  dataProva,
  onAlterarDataProva,
  simulado,
  historico,
  progresso,
  ofensiva,
  filtro,
  onFiltro,
  onComecar,
}: Props) {
  const now = new Date()
  const hoje = diaSP(now)
  const fila = montarFila(baralho, progresso, filtro, now)
  const diasProva = dataProva ? diasEntre(hoje, dataProva) : null

  const totalFila = fila.aprendizado.length + fila.revisoes.length + fila.novosSimulado.length + fila.novosBacklog.length
  const detalhes = [
    fila.novosSimulado.length > 0 && plural(fila.novosSimulado.length, 'novo', 'novos'),
    fila.aprendizado.length > 0 && `${fila.aprendizado.length} em andamento`,
    fila.revisoes.length > 0 && `${fila.revisoes.length} para revisar`,
    fila.novosBacklog.length > 0 && `${fila.novosBacklog.length} do backlog`,
  ].filter(Boolean) as string[]

  const porDominio = LISTA_DOMINIOS.map((d) => {
    let pendentes = 0
    let feitosHoje = 0
    let revisoes = 0
    let erros = 0
    let total = 0
    for (const c of baralho.cards) {
      if (c.dominio !== d) continue
      total++
      const p = progresso.get(c.id)
      if (!p) pendentes++
      else {
        revisoes += p.stats.revisoes
        erros += p.stats.erros
        if (p.card.due <= now) pendentes++
        else if (diaSP(p.updatedAt) === hoje) feitosHoje++
      }
    }
    return { d, total, pendentes, feitosHoje, acerto: acerto(revisoes, erros) }
  })
  const somar = (k: 'pendentes' | 'feitosHoje' | 'total') => porDominio.reduce((s, r) => s + r[k], 0)
  const acertoGeral = acerto(
    baralho.cards.reduce((s, c) => s + (progresso.get(c.id)?.stats.revisoes ?? 0), 0),
    baralho.cards.reduce((s, c) => s + (progresso.get(c.id)?.stats.erros ?? 0), 0),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <p className="text-lg font-extrabold tracking-tight">Sec+ SY0-701</p>
        <MenuConta email={email} onAlterarDataProva={onAlterarDataProva} />
      </header>

      {/* Situação: prova e ofensiva, em texto, sem competir com as ações */}
      <section
        aria-label="Sua situação"
        className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between"
      >
        <div>
          {diasProva !== null && diasProva > 0 ? (
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Faltam {plural(diasProva, 'dia', 'dias')} para a prova
            </h1>
          ) : (
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {diasProva === 0 ? 'A prova é hoje. Boa sorte!' : 'Bons estudos'}
            </h1>
          )}
          <p className="mt-1 text-muted">
            {dataProva ? `Prova em ${formatarDataProva(dataProva)}.` : 'Você ainda não marcou a data da prova.'}{' '}
            <button onClick={onAlterarDataProva} className="foco rounded font-medium text-ink underline underline-offset-2">
              {dataProva ? 'Alterar data' : 'Marcar data'}
            </button>
          </p>
        </div>
        <OfensivaCard ofensiva={ofensiva} />
      </section>

      {/* Para hoje: as duas atividades principais, lado a lado */}
      <section aria-labelledby="hoje-titulo" className="mt-8">
        <h2 id="hoje-titulo" className="mb-4 text-xl font-extrabold">
          Para hoje
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Painel
            icone={<IconeFlashcards />}
            titulo="Flashcards"
            descricao="Revisão espaçada das suas anotações e das questões que você errou no simulado."
            acao={
              <button
                onClick={onComecar}
                disabled={totalFila === 0}
                className="foco w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {totalFila > 0 ? 'Revisar flashcards' : 'Nada para revisar agora'}
              </button>
            }
          >
            <p className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight tabular-nums">{totalFila}</span>
              <span className="font-bold">{totalFila === 1 ? 'card para hoje' : 'cards para hoje'}</span>
            </p>
            <p className="mt-1 min-h-5 text-sm text-muted">
              {detalhes.length > 0
                ? detalhes.join(', ')
                : baralho.cards.length === 0
                  ? 'Ainda não há cards. Faça um simulado: cada questão que você errar vira um card aqui.'
                  : 'Tudo em dia. Volte mais tarde ou amanhã.'}
            </p>

            {baralho.cards.length > 0 && (
              <div className="mt-5">
                <label htmlFor="filtro-dominio" className="text-sm font-medium">
                  Domínio
                </label>
                <select
                  id="filtro-dominio"
                  value={filtro}
                  onChange={(e) => onFiltro(e.target.value as Filtro)}
                  className="foco mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
                >
                  <option value="todos">Todos os domínios</option>
                  {LISTA_DOMINIOS.map((d) => (
                    <option key={d} value={d}>
                      {d} {DOMINIOS[d]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Painel>

          {simulado}
        </div>
      </section>

      {historico}

      {/* Desempenho: leitura, não ação */}
      <section aria-labelledby="desempenho-titulo" className="mt-10">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="desempenho-titulo" className="text-xl font-extrabold">
            Desempenho por domínio
          </h2>
          <p className="text-sm text-muted">Com base nos flashcards que você já revisou.</p>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[1fr_14rem_8rem] gap-6 border-b border-line px-4 py-2.5 text-xs font-medium text-muted sm:grid">
            <span>Domínio</span>
            <span>Revisão de hoje</span>
            <span className="text-right">Acerto</span>
          </div>
          <ul>
            {porDominio.map((r) => (
              <LinhaDominio
                key={r.d}
                cor={DOMINIO_COR[r.d]}
                numero={r.d}
                nome={DOMINIOS[r.d]}
                total={r.total}
                pendentes={r.pendentes}
                feitosHoje={r.feitosHoje}
                acerto={r.acerto}
              />
            ))}
            <LinhaDominio
              cor="var(--ink)"
              nome="Todos os domínios"
              total={somar('total')}
              pendentes={somar('pendentes')}
              feitosHoje={somar('feitosHoje')}
              acerto={acertoGeral}
              destaque
            />
          </ul>
        </div>
        <p className="mt-2 px-1 text-xs text-muted">
          Acerto aparece a partir de {MIN_REVISOES_ACERTO} revisões no domínio. Verde a partir de 85%, a meta para passar com
          folga.
        </p>
      </section>
    </div>
  )
}

type LinhaProps = {
  cor: string
  numero?: string
  nome: string
  total: number
  pendentes: number
  feitosHoje: number
  acerto: number | null
  destaque?: boolean
}

function LinhaDominio({ cor, numero, nome, total, pendentes, feitosHoje, acerto, destaque }: LinhaProps) {
  // Revisão de hoje: a barra começa vazia quando há cards pendentes e enche conforme você revisa
  const meta = pendentes + feitosHoje
  const pct = meta === 0 ? 100 : Math.round((feitosHoje / meta) * 100)
  const textoHoje = total === 0 ? 'sem cards' : meta === 0 ? 'em dia' : `${feitosHoje} de ${meta}`

  return (
    <li
      style={{ '--dc': cor } as CSSProperties}
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_14rem_8rem] sm:gap-6 ${
        destaque ? 'bg-surface-2/60' : ''
      }`}
    >
      <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 sm:col-auto sm:row-auto">
        <span className="h-8 w-1.5 shrink-0 rounded-full bg-[var(--dc)]" aria-hidden="true" />
        <span className="min-w-0">
          <span className={`block truncate text-sm ${destaque ? 'font-bold' : 'font-medium'}`}>
            {numero && <span className="mr-1.5 font-bold tabular-nums">{numero}</span>}
            {nome}
          </span>
          <span className="block text-xs text-muted tabular-nums">{plural(total, 'card', 'cards')}</span>
        </span>
      </span>

      <span className="col-span-2 col-start-1 row-start-2 flex items-center gap-3 sm:col-span-1 sm:col-auto sm:row-auto">
        <span
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
          role="img"
          aria-label={meta === 0 ? 'Nada pendente hoje' : `${feitosHoje} de ${meta} cards de hoje revisados`}
        >
          <span className="block h-full rounded-full bg-[var(--dc)]" style={{ width: `${total === 0 ? 0 : pct}%` }} />
        </span>
        <span className="w-16 shrink-0 text-right text-xs text-muted tabular-nums">{textoHoje}</span>
      </span>

      <span className="col-start-2 row-start-1 text-right text-sm tabular-nums sm:col-auto sm:row-auto" title="Acerto nos flashcards">
        {acerto === null ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <span className="font-bold" style={{ color: corAcerto(acerto) }}>
            {acerto}%
          </span>
        )}
        <span className="block text-xs text-muted sm:hidden">acerto</span>
      </span>
    </li>
  )
}
