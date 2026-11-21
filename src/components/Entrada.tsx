import { CERTIFICACOES, certificacaoPorId, type Certificacao } from '../certificacoes'
import { diaSP, diasEntre, formatarDataCompleta, formatarDataProva } from '../lib/datas'
import type { Ofensiva } from '../lib/ofensiva'
import type { Perfil } from '../lib/perfil'
import { situacaoValidade, type ItemTrilha } from '../lib/trilha'
import BadgeCertificacao from './BadgeCertificacao'
import Castor from './Castor'
import MenuConta from './MenuConta'
import OfensivaCard from './OfensivaCard'

type Props = {
  email: string
  perfis: Map<string, Perfil>
  ultima: string | null
  trilha: ItemTrilha[]
  ofensiva: Ofensiva
  onEscolher: (cert: Certificacao) => void
  onMinhas: () => void
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

/** Uma linha sobre onde a pessoa está naquela certificação */
function situacao(cert: Certificacao, perfil: Perfil | undefined, hoje: string): string {
  if (!cert.disponivel) return 'Em breve'
  if (!perfil) return 'Ainda não começou'
  if (perfil.resultado === 'aprovado' && perfil.resultado_data === perfil.data_prova) return 'Aprovado'
  if (perfil.treino) return 'Modo treinamento'
  if (perfil.data_prova) {
    const dias = diasEntre(hoje, perfil.data_prova)
    if (dias > 0) return `Prova em ${plural(dias, 'dia', 'dias')} · ${formatarDataProva(perfil.data_prova)}`
    if (dias === 0) return 'A prova é hoje'
    return `Prova feita em ${formatarDataProva(perfil.data_prova)}`
  }
  return 'Sem data de prova'
}

/** Tela de entrada: qual certificação treinar, a ofensiva de todas e a trilha de carreira */
export default function Entrada({ email, perfis, ultima, trilha, ofensiva, onEscolher, onMinhas }: Props) {
  const hoje = diaSP(new Date())
  // a última treinada vem primeiro e em destaque; as disponíveis antes das "em breve"
  const certs = [...CERTIFICACOES].sort(
    (a, b) => Number(b.id === ultima) - Number(a.id === ultima) || Number(b.disponivel) - Number(a.disponivel),
  )
  const conquistadas = trilha.filter((i) => i.status === 'conquistada')
  const metas = trilha
    .filter((i) => i.status === 'meta')
    .sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'))
  const avisos = conquistadas
    .map((i) => ({ i, v: situacaoValidade(i, hoje) }))
    .filter(({ v }) => v.tipo === 'renovar' || v.tipo === 'expirada')

  return (
    <div className="mx-auto max-w-5xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Castor pose="icone" tamanho={40} />
          Nickols Certificações
        </p>
        <MenuConta email={email} onMinhas={onMinhas} />
      </header>

      <section className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Qual certificação você quer treinar?
          </h1>
          <p className="mt-1 text-muted">Flashcards e simulados no formato de cada prova.</p>
        </div>
        <OfensivaCard ofensiva={ofensiva} />
      </section>

      {avisos.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2" aria-label="Avisos de renovação">
          {avisos.map(({ i, v }) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-2xl border-2 p-3 text-sm"
              style={{ borderColor: v.tipo === 'expirada' ? 'var(--d2)' : 'var(--d4)' }}
            >
              <BadgeCertificacao cert={certificacaoPorId(i.certificacao)} rotulo={i.nome} tamanho={36} />
              <span className="min-w-0 flex-1">
                <span className="font-bold">{i.nome}</span>{' '}
                {v.tipo === 'expirada'
                  ? `expirou em ${formatarDataCompleta(i.expira_em!)}.`
                  : `vence em ${plural(v.dias!, 'dia', 'dias')} (${formatarDataCompleta(i.expira_em!)}). Hora de renovar.`}
              </span>
              <button onClick={onMinhas} className="foco shrink-0 rounded font-medium underline underline-offset-2">
                Ver
              </button>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="certs-titulo" className="mt-8">
        <h2 id="certs-titulo" className="sr-only">
          Certificações
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {certs.map((cert) => {
            const destaque = cert.id === ultima && cert.disponivel
            return (
              <li key={cert.id}>
                <button
                  onClick={() => onEscolher(cert)}
                  disabled={!cert.disponivel}
                  aria-describedby={`situacao-${cert.id}`}
                  className={`foco flex w-full items-center gap-4 rounded-3xl border-2 bg-surface p-5 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-surface ${
                    destaque ? 'border-ink' : 'border-line'
                  }`}
                >
                  <BadgeCertificacao cert={cert} tamanho={72} apagado={!cert.disponivel} />
                  <span className="min-w-0 flex-1">
                    {destaque && (
                      <span className="mb-1 inline-block rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-bg">
                        Continuar
                      </span>
                    )}
                    <span className="block text-lg leading-tight font-extrabold">{cert.nome}</span>
                    <span className="block text-sm text-muted">
                      {cert.codigo} · {cert.emissor}
                    </span>
                    <span id={`situacao-${cert.id}`} className="mt-1.5 block text-sm font-medium">
                      {situacao(cert, perfis.get(cert.id), hoje)}
                    </span>
                  </span>
                  {cert.disponivel && (
                    <span className="text-2xl text-muted" aria-hidden="true">
                      →
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="trilha-titulo" className="mt-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="trilha-titulo" className="text-xl font-extrabold">
            Minha trilha
          </h2>
          <button onClick={onMinhas} className="foco rounded text-sm font-medium underline underline-offset-2">
            Minhas certificações
          </button>
        </div>

        {conquistadas.length === 0 && metas.length === 0 ? (
          <div className="flex items-center gap-4 rounded-3xl border border-dashed border-line p-5">
            <Castor pose="pensando" tamanho={72} className="-my-2 shrink-0" />
            <p className="text-sm text-muted">
              As certificações que você conquistar aparecem aqui, junto com as próximas que você planeja tirar.{' '}
              <button onClick={onMinhas} className="foco rounded font-medium text-ink underline underline-offset-2">
                Adicionar
              </button>
            </p>
          </div>
        ) : (
          <ol className="flex flex-wrap gap-3">
            {conquistadas.map((i) => (
              <li key={i.id} className="flex w-36 flex-col items-center rounded-3xl border border-line bg-surface p-3 text-center">
                <BadgeCertificacao cert={certificacaoPorId(i.certificacao)} rotulo={i.nome} tamanho={72} />
                <span className="mt-2 text-sm leading-tight font-bold">{i.nome}</span>
                <span className="mt-0.5 text-xs text-muted">{i.data ? formatarDataCompleta(i.data) : 'Conquistada'}</span>
              </li>
            ))}
            {metas.map((i) => {
              const dias = i.data ? diasEntre(hoje, i.data) : null
              return (
                <li
                  key={i.id}
                  className="flex w-36 flex-col items-center rounded-3xl border border-dashed border-line p-3 text-center"
                >
                  <BadgeCertificacao cert={certificacaoPorId(i.certificacao)} rotulo={i.nome} tamanho={72} apagado />
                  <span className="mt-2 text-sm leading-tight font-bold">{i.nome}</span>
                  <span className="mt-0.5 text-xs text-muted">
                    {dias === null
                      ? 'Meta'
                      : dias > 0
                        ? `Meta · em ${plural(dias, 'dia', 'dias')}`
                        : `Meta · ${formatarDataCompleta(i.data!)}`}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
