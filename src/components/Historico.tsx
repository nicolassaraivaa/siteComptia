import { useMemo } from 'react'
import { diaSP, somarDias } from '../lib/datas'
import { questoesPorDia, simuladosFeitos, type CardsPorDia, type SimuladoFeito } from '../lib/historico'
import type { Resposta } from '../lib/questoes'

type Props = {
  respostas: Resposta[]
  /** null = histórico de cards indisponível (tabela revisoes ainda não criada) */
  cardsPorDia: CardsPorDia | null
  /** ids dos simulados de prova (90 questões), para identificá-los na lista */
  provas: Set<string>
  /** último dia da janela de 7 dias (fica no App para não se perder ao abrir um simulado) */
  fim: string
  onFim: (dia: string) => void
  onAbrirSimulado: (id: string) => void
  onVoltar: () => void
}

type Dia = {
  dia: string
  questoes: number
  certas: number
  corrigidas: number
  simulados: number
  /** null = antes de o app começar a contar as revisões de cards */
  cards: number | null
  errosCards: number
}

const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtCompleto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

const data = (dia: string) => new Date(`${dia}T12:00:00Z`)
const semana = (dia: string) => fmtSemana.format(data(dia)).replace('.', '')
const curto = (dia: string) => fmtDiaLongo.format(data(dia)).replace('.', '')

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

function pct(certas: number, total: number): number | null {
  return total === 0 ? null : Math.round((certas / total) * 100)
}

/** Questões e cards por dia, de 7 em 7 dias */
export default function Historico({ respostas, cardsPorDia, provas, fim, onFim: setFim, onAbrirSimulado, onVoltar }: Props) {
  const hoje = diaSP(new Date())
  const porDiaQuestoes = useMemo(() => questoesPorDia(respostas), [respostas])
  const simulados = useMemo(() => simuladosFeitos(respostas), [respostas])

  // As revisões de cards só passaram a ser contadas quando o histórico entrou no app
  const inicioCards = useMemo(() => {
    if (!cardsPorDia) return null
    let min = hoje
    for (const d of cardsPorDia.keys()) if (d < min) min = d
    return min
  }, [cardsPorDia, hoje])

  const primeiroDia = useMemo(() => {
    let min = inicioCards ?? hoje
    for (const d of porDiaQuestoes.keys()) if (d < min) min = d
    return min
  }, [porDiaQuestoes, inicioCards, hoje])

  const inicio = somarDias(fim, -6)
  const dias: Dia[] = []
  for (let i = 6; i >= 0; i--) {
    const dia = somarDias(fim, -i)
    const q = porDiaQuestoes.get(dia)
    const c = cardsPorDia?.get(dia)
    const contando = inicioCards !== null && dia >= inicioCards
    dias.push({
      dia,
      questoes: q?.questoes ?? 0,
      certas: q?.certas ?? 0,
      corrigidas: q?.corrigidas ?? 0,
      simulados: q?.simulados ?? 0,
      cards: contando ? (c?.cards ?? 0) : null,
      errosCards: c?.erros ?? 0,
    })
  }

  const totalQuestoes = dias.reduce((s, d) => s + d.questoes, 0)
  const acertoSemana = pct(
    dias.reduce((s, d) => s + d.certas, 0),
    dias.reduce((s, d) => s + d.corrigidas, 0),
  )
  const algumCard = dias.some((d) => d.cards !== null)
  const totalCards = dias.reduce((s, d) => s + (d.cards ?? 0), 0)
  const ativos = dias.filter((d) => d.questoes > 0 || (d.cards ?? 0) > 0).length

  const simuladosDaSemana = simulados.filter((x) => x.dia >= inicio && x.dia <= fim)

  const ehAtual = fim === hoje
  const podeVoltar = inicio > primeiroDia

  return (
    <div className="mx-auto max-w-5xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center py-4">
        <button
          onClick={onVoltar}
          className="foco -ml-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span> Início
        </button>
      </header>

      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Histórico</h1>
          <p className="mt-1 text-muted">Questões do simulado e flashcards revisados por dia.</p>
        </div>

        <nav aria-label="Escolher semana" className="flex items-center gap-2">
          <BotaoSeta direcao="anterior" disabled={!podeVoltar} onClick={() => setFim(somarDias(fim, -7))} />
          <div className="min-w-36 text-center" aria-live="polite">
            <p className="font-bold tabular-nums">
              {curto(inicio)} – {curto(fim)}
            </p>
            {ehAtual ? (
              <p className="text-xs text-muted">Últimos 7 dias</p>
            ) : (
              <button onClick={() => setFim(hoje)} className="foco rounded text-xs font-medium underline underline-offset-2">
                Voltar para hoje
              </button>
            )}
          </div>
          <BotaoSeta direcao="proxima" disabled={ehAtual} onClick={() => setFim(somarDias(fim, 7) > hoje ? hoje : somarDias(fim, 7))} />
        </nav>
      </div>

      {/* Totais da semana */}
      <dl className="mt-6 grid grid-cols-3 gap-3">
        <Total rotulo="Questões" valor={totalQuestoes} detalhe={acertoSemana === null ? 'sem questões' : `${acertoSemana}% de acerto`} />
        <Total
          rotulo="Cards"
          valor={algumCard ? totalCards : '—'}
          detalhe={cardsPorDia === null ? 'indisponível' : algumCard ? 'revisões' : 'sem registro'}
        />
        <Total rotulo="Dias ativos" valor={`${ativos}/7`} detalhe={ativos === 7 ? 'semana completa' : 'com estudo'} />
      </dl>

      {/* Um gráfico por medida: as escalas são diferentes, então nunca no mesmo eixo */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Grafico titulo="Questões por dia" dias={dias} hoje={hoje} valor={(d) => d.questoes} unidade={['questão', 'questões']} />
        <Grafico titulo="Cards por dia" dias={dias} hoje={hoje} valor={(d) => d.cards} unidade={['card', 'cards']} />
      </div>

      {/* Simulados da semana: cada um abre a correção, questão por questão */}
      <section aria-labelledby="simulados-titulo" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="simulados-titulo" className="text-xl font-extrabold">
            Simulados
          </h2>
          <p className="text-sm text-muted">Toque em um para ver o que você acertou e errou.</p>
        </div>
        {simuladosDaSemana.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Nenhum simulado nesses 7 dias.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
            {simuladosDaSemana.map((x) => (
              <LinhaSimulado key={x.id} s={x} prova={provas.has(x.id)} hoje={hoje} onAbrir={() => onAbrirSimulado(x.id)} />
            ))}
          </ul>
        )}
      </section>

      {/* Detalhe dia a dia, do mais recente para o mais antigo */}
      <section aria-labelledby="dias-titulo" className="mt-8">
        <h2 id="dias-titulo" className="mb-3 text-xl font-extrabold">
          Dia a dia
        </h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-[1fr_7.5rem_4.5rem] gap-3 border-b border-line px-4 py-2.5 text-xs font-medium text-muted sm:grid-cols-[1fr_10rem_10rem]">
            <span>Dia</span>
            <span className="text-right">Questões</span>
            <span className="text-right">Cards</span>
          </div>
          <ul>
            {[...dias].reverse().map((d) => (
              <LinhaDia key={d.dia} d={d} hoje={hoje} />
            ))}
          </ul>
        </div>
        {cardsPorDia === null ? (
          <p className="mt-2 px-1 text-xs text-muted">
            A contagem de cards ainda não está disponível. Falta criar a tabela de revisões no banco.
          </p>
        ) : (
          dias.some((d) => d.cards === null) && (
            <p className="mt-2 px-1 text-xs text-muted">
              A contagem de cards começou em {curto(inicioCards!)}. Antes disso aparece “—”.
            </p>
          )
        )}
      </section>
    </div>
  )
}

function BotaoSeta({ direcao, disabled, onClick }: { direcao: 'anterior' | 'proxima'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direcao === 'anterior' ? '7 dias anteriores' : '7 dias seguintes'}
      className="foco flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-lg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-surface"
    >
      <span aria-hidden="true">{direcao === 'anterior' ? '‹' : '›'}</span>
    </button>
  )
}

function Total({ rotulo, valor, detalhe }: { rotulo: string; valor: number | string; detalhe: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3 sm:px-5 sm:py-4">
      <dt className="text-xs font-medium text-muted sm:text-sm">{rotulo}</dt>
      <dd className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">{valor}</dd>
      <dd className="mt-0.5 truncate text-xs text-muted">{detalhe}</dd>
    </div>
  )
}

type GraficoProps = {
  titulo: string
  dias: Dia[]
  hoje: string
  valor: (d: Dia) => number | null
  unidade: [string, string]
}

/** Colunas dos 7 dias, cada uma com o valor escrito em cima */
function Grafico({ titulo, dias, hoje, valor, unidade }: GraficoProps) {
  const max = Math.max(1, ...dias.map((d) => valor(d) ?? 0))
  return (
    <figure className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="text-sm font-bold">{titulo}</figcaption>
      <ol className="mt-4 grid grid-cols-7 gap-1.5">
        {dias.map((d) => {
          const v = valor(d)
          const eHoje = d.dia === hoje
          const descricao = `${fmtCompleto.format(data(d.dia))}: ${v === null ? 'sem registro' : plural(v, unidade[0], unidade[1])}`
          return (
            <li key={d.dia} className="flex flex-col items-center" title={descricao}>
              <span className="sr-only">{descricao}</span>
              <div className="flex h-32 w-full flex-col items-center justify-end" aria-hidden="true">
                <span className={`mb-1 text-xs tabular-nums ${v ? 'font-bold text-ink' : 'text-muted'}`}>
                  {v === null ? '—' : v}
                </span>
                <span
                  className={`block w-full max-w-7 rounded-t ${v ? 'bg-ink' : 'bg-line'}`}
                  style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : '2px' }}
                />
              </div>
              <span className="mt-2 h-px w-full bg-line" aria-hidden="true" />
              <span className={`mt-1.5 text-[11px] leading-tight ${eHoje ? 'font-bold text-ink' : 'text-muted'}`} aria-hidden="true">
                {eHoje ? 'hoje' : semana(d.dia)}
              </span>
              <span className="text-[10px] leading-tight text-muted tabular-nums" aria-hidden="true">
                {fmtDiaMes.format(data(d.dia))}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

function LinhaSimulado({ s, prova, hoje, onAbrir }: { s: SimuladoFeito; prova: boolean; hoje: string; onAbrir: () => void }) {
  const corrigidas = s.total - s.pendentes
  const acerto = pct(s.certas, corrigidas)
  const quando = s.dia === hoje ? 'Hoje' : s.dia === somarDias(hoje, -1) ? 'Ontem' : `${semana(s.dia)} ${fmtDiaMes.format(data(s.dia))}`
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        onClick={onAbrir}
        className="foco grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            <span className="capitalize">{quando}</span>
            <span className="ml-1.5 text-muted tabular-nums">{fmtHora.format(s.inicio)}</span>
          </span>
          <span className="block text-xs text-muted">
            {prova ? 'Simulado de prova' : 'Simulado'} · {plural(s.total, 'questão', 'questões')}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-bold tabular-nums">{acerto === null ? '—' : `${acerto}%`}</span>
          <span className="block text-xs text-muted tabular-nums">
            <span className="text-[var(--good)]">{s.certas} ✓</span> · <span className="text-[var(--d2)]">{s.erradas} ✗</span>
            {s.pendentes > 0 && ` · ${s.pendentes} a corrigir`}
          </span>
        </span>
        <span className="text-lg text-muted" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}

function LinhaDia({ d, hoje }: { d: Dia; hoje: string }) {
  const acerto = pct(d.certas, d.corrigidas)
  const nome = d.dia === hoje ? 'Hoje' : d.dia === somarDias(hoje, -1) ? 'Ontem' : semana(d.dia)
  const vazio = d.questoes === 0 && !d.cards
  return (
    <li className="grid grid-cols-[1fr_7.5rem_4.5rem] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_10rem_10rem]">
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          <span className="capitalize">{nome}</span>
          <span className="ml-1.5 text-muted tabular-nums">{fmtDiaMes.format(data(d.dia))}</span>
        </span>
        {vazio && <span className="block text-xs text-muted">Sem estudo</span>}
      </span>
      <span className="text-right">
        <span className={`block font-bold tabular-nums ${d.questoes ? '' : 'text-muted'}`}>{d.questoes}</span>
        {d.questoes > 0 && (
          <span className="block text-xs text-muted tabular-nums">
            {acerto !== null && `${acerto}% · `}
            {plural(d.simulados, 'simulado', 'simulados')}
          </span>
        )}
      </span>
      <span className="text-right">
        <span className={`block font-bold tabular-nums ${d.cards ? '' : 'text-muted'}`}>{d.cards ?? '—'}</span>
        {!!d.cards && (
          <span className="block text-xs text-muted tabular-nums">{plural(d.errosCards, 'erro', 'erros')}</span>
        )}
      </span>
    </li>
  )
}
