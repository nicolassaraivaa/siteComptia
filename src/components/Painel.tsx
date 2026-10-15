import type { ReactNode } from 'react'

type Props = {
  icone: ReactNode
  titulo: string
  descricao: string
  children: ReactNode
  /** Botão principal, sempre no rodapé (alinha os painéis lado a lado) */
  acao?: ReactNode
}

/** Painel de atividade da home (Flashcards, Simulado): título, o que faz, números e a ação no rodapé */
export default function Painel({ icone, titulo, descricao, children, acao }: Props) {
  return (
    <section className="flex flex-col rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink"
          aria-hidden="true"
        >
          {icone}
        </span>
        <div>
          <h3 className="text-lg font-extrabold">{titulo}</h3>
          <p className="text-sm text-muted">{descricao}</p>
        </div>
      </div>
      <div>{children}</div>
      {acao && <div className="mt-auto pt-6">{acao}</div>}
    </section>
  )
}

const svg = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconeFlashcards() {
  return (
    <svg {...svg}>
      <rect x="3" y="7" width="14" height="12" rx="2" />
      <path d="M7 4h12a2 2 0 0 1 2 2v10" />
    </svg>
  )
}

export function IconeSimulado() {
  return (
    <svg {...svg}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 9 1.5 1.5L12 8" />
      <path d="M14 9.5h3" />
      <path d="m8 15 1.5 1.5L12 14" />
      <path d="M14 15.5h3" />
    </svg>
  )
}
