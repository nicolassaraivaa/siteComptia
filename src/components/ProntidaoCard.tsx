import { useCert } from '../lib/certContexto'
import { COBERTURA_MINIMA, PROVAS_NA_MEDIA, type Prontidao } from '../lib/prontidao'
import Castor, { type Pose } from './Castor'

const NIVEL: Record<Prontidao['nivel'], { titulo: string; pose: Pose; cor: string }> = {
  'sem-dados': { titulo: 'Ainda sem estimativa', pose: 'pensando', cor: 'var(--muted)' },
  cedo: { titulo: 'Ainda não', pose: 'errou', cor: 'var(--d2)' },
  quase: { titulo: 'Quase lá', pose: 'neutro', cor: 'var(--d4)' },
  pronto: { titulo: 'Pronto para a prova', pose: 'acertou', cor: 'var(--good)' },
}

/** "Pronto para a prova?": média dos últimos simulados de prova e cobertura do banco */
export default function ProntidaoCard({ prontidao }: { prontidao: Prontidao }) {
  const cert = useCert()
  const { nivel, media, provas, cobertura } = prontidao
  const info = NIVEL[nivel]

  const motivo =
    nivel === 'sem-dados'
      ? `Faça um simulado de prova (${cert.prova.questoes} questões) para o Toco estimar.`
      : nivel === 'pronto'
        ? `Média acima da zona segura e ${cobertura}% do banco visto.`
        : media !== null && media >= cert.zonaSegura
          ? `A média já passa da zona segura, mas só ${cobertura}% do banco foi visto. Chegue a ${COBERTURA_MINIMA}% para confiar nela.`
          : `Faltam ${cert.zonaSegura - (media ?? 0)} pontos na média para a zona segura de ${cert.zonaSegura}%.`

  return (
    <section aria-labelledby="prontidao-titulo" className="mt-10">
      <h2 id="prontidao-titulo" className="mb-3 text-xl font-extrabold">
        Pronto para a prova?
      </h2>
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <Castor pose={info.pose} tamanho={84} className="-my-2 shrink-0 self-center" />
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold tracking-tight" style={{ color: info.cor }}>
            {info.titulo}
          </p>
          <p className="mt-1 text-sm text-muted">{motivo}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-center sm:w-64">
          <div className="flex flex-col-reverse rounded-2xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">
              {provas > 0 ? `média de ${provas === 1 ? '1 prova' : `${provas} provas`}` : 'média das provas'}
            </dt>
            <dd className="text-2xl font-bold tabular-nums">{media === null ? '—' : `${media}%`}</dd>
          </div>
          <div className="flex flex-col-reverse rounded-2xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">do banco visto</dt>
            <dd className="text-2xl font-bold tabular-nums">{cobertura}%</dd>
          </div>
        </dl>
      </div>
      <p className="mt-2 px-1 text-xs text-muted">
        Usa os últimos {PROVAS_NA_MEDIA} simulados de prova e a zona segura de {cert.zonaSegura}%. É uma referência de
        estudo, não a nota oficial.
      </p>
    </section>
  )
}
