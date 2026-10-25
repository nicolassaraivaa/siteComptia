/**
 * Nickols, o castor: mascote e logo do app.
 * As poses vêm de castor-mascote/ (copiadas para public/mascote/). Cada SVG já traz a
 * própria animação em CSS e respeita "reduzir movimento" do sistema.
 * - neutro: em pé na nuvem, mãos no bolso
 * - acertou: pula, piscadinha, joinha
 * - errou: coça a cabeça
 * - streak: comemora com fogo e confete
 * - pensando: carregando
 * - icone: só a cabeça (logo do cabeçalho)
 */
export type Pose = 'neutro' | 'acertou' | 'errou' | 'streak' | 'pensando' | 'icone'

type Props = {
  pose?: Pose
  tamanho?: number
  className?: string
  /** Texto para leitores de tela; sem ele o castor é decorativo */
  rotulo?: string
}

export default function Castor({ pose = 'neutro', tamanho = 160, className = '', rotulo }: Props) {
  return (
    <img
      src={`/mascote/castor-${pose}.svg`}
      width={tamanho}
      height={tamanho}
      alt={rotulo ?? ''}
      aria-hidden={rotulo ? undefined : true}
      draggable={false}
      className={`select-none ${className}`}
    />
  )
}
