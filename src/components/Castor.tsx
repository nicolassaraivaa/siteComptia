/**
 * Nickols, o castor: mascote e logo do app. Desenhado em SVG para ficar nítido em qualquer tamanho.
 * - "parado": só pisca (logo)
 * - "feliz": pisca e balança de leve
 * - "comemorando": pula e acena com os dois braços
 * As animações respeitam "reduzir movimento" do sistema (ver index.css).
 */
type Props = {
  tamanho?: number
  animacao?: 'parado' | 'feliz' | 'comemorando'
  className?: string
  /** Texto para leitores de tela; sem ele o castor é decorativo */
  rotulo?: string
}

const PELO = '#a0673b'
const PELO_ESCURO = '#6b4226'
const CLARO = '#ecd0a7'
const CONTORNO = '#3b2416'

export default function Castor({ tamanho = 120, animacao = 'parado', className = '', rotulo }: Props) {
  return (
    <svg
      viewBox="0 0 160 160"
      width={tamanho}
      height={tamanho}
      className={`castor castor-${animacao} ${className}`}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      <g className="castor-corpo-todo">
        {/* rabo achatado, com o padrão de escamas */}
        <g className="castor-rabo">
          <ellipse cx="122" cy="128" rx="30" ry="14" transform="rotate(-28 122 128)" fill={PELO_ESCURO} />
          <path
            d="M104 132 L138 114 M108 138 L142 120 M112 126 L132 140 M122 120 L140 132"
            stroke={CONTORNO}
            strokeOpacity=".35"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* corpo e barriga */}
        <ellipse cx="80" cy="112" rx="36" ry="37" fill={PELO} />
        <ellipse cx="80" cy="118" rx="23" ry="26" fill={CLARO} />

        {/* pés */}
        <ellipse cx="62" cy="148" rx="13" ry="7" fill={PELO_ESCURO} />
        <ellipse cx="98" cy="148" rx="13" ry="7" fill={PELO_ESCURO} />

        {/* braços: giram a partir do ombro */}
        <g className="castor-braco castor-braco-esq">
          <ellipse cx="50" cy="112" rx="8.5" ry="16" transform="rotate(18 50 112)" fill={PELO_ESCURO} />
        </g>
        <g className="castor-braco castor-braco-dir">
          <ellipse cx="110" cy="112" rx="8.5" ry="16" transform="rotate(-18 110 112)" fill={PELO_ESCURO} />
        </g>

        {/* cabeça */}
        <g className="castor-cabeca">
          <circle cx="50" cy="34" r="10.5" fill={PELO} />
          <circle cx="50" cy="34" r="5" fill={PELO_ESCURO} />
          <circle cx="110" cy="34" r="10.5" fill={PELO} />
          <circle cx="110" cy="34" r="5" fill={PELO_ESCURO} />
          <ellipse cx="80" cy="62" rx="38" ry="34" fill={PELO} />

          {/* olhos */}
          <g className="castor-olhos">
            <circle cx="64" cy="56" r="5.5" fill={CONTORNO} />
            <circle cx="96" cy="56" r="5.5" fill={CONTORNO} />
            <circle cx="65.8" cy="54.2" r="1.9" fill="#fff" />
            <circle cx="97.8" cy="54.2" r="1.9" fill="#fff" />
          </g>

          {/* bochechas */}
          <ellipse cx="55" cy="71" rx="6" ry="3.8" fill="#f07a6a" fillOpacity=".45" />
          <ellipse cx="105" cy="71" rx="6" ry="3.8" fill="#f07a6a" fillOpacity=".45" />

          {/* focinho, nariz, boca e os dentões */}
          <ellipse cx="80" cy="76" rx="19" ry="13.5" fill={CLARO} />
          <rect x="73.5" y="77" width="13" height="11" rx="2.5" fill="#fff" stroke={CONTORNO} strokeWidth="1.6" />
          <path d="M80 77.5 V87.5" stroke={CONTORNO} strokeWidth="1.4" />
          <path
            d="M72 74.5 Q76 78.5 80 74.5 Q84 78.5 88 74.5"
            fill="none"
            stroke={CONTORNO}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <ellipse cx="80" cy="68.5" rx="7.5" ry="5.2" fill={CONTORNO} />
          <ellipse cx="78" cy="67" rx="2.4" ry="1.3" fill="#fff" fillOpacity=".5" />
        </g>
      </g>
    </svg>
  )
}
