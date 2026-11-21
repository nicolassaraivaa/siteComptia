import { useState } from 'react'
import type { Certificacao } from '../certificacoes'

type Props = {
  /** Certificação do catálogo: usa o badge oficial em public/certificacoes/ */
  cert?: Certificacao | null
  /** Para itens fora do catálogo (cadastrados à mão): o texto do selo neutro */
  rotulo?: string
  tamanho?: number
  /** Meta ainda não conquistada: selo apagado */
  apagado?: boolean
  className?: string
}

/**
 * Badge da certificação. Os oficiais vêm do Credly (public/certificacoes/<id>.png); enquanto o
 * arquivo não existe, mostra um selo neutro com o código da prova.
 */
export default function BadgeCertificacao({ cert, rotulo, tamanho = 64, apagado = false, className = '' }: Props) {
  // O selo aparece até o badge carregar: sem o arquivo, nunca pisca uma imagem quebrada
  const [carregou, setCarregou] = useState(false)
  const texto = cert?.codigo ?? rotulo ?? '?'
  const estilo = { width: tamanho, height: tamanho }
  const filtro = apagado ? 'grayscale opacity-45' : ''

  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={estilo} aria-hidden="true">
      {!carregou && <Selo texto={texto} className={filtro} />}
      {cert && (
        <img
          src={cert.badge}
          alt=""
          width={tamanho}
          height={tamanho}
          draggable={false}
          onLoad={() => setCarregou(true)}
          onError={() => setCarregou(false)}
          className={`absolute inset-0 h-full w-full object-contain select-none ${carregou ? '' : 'invisible'} ${filtro}`}
        />
      )}
    </span>
  )
}

/** Selo neutro: hexágono com o código, nas cores do tema */
function Selo({ texto, className }: { texto: string; className: string }) {
  const curto = texto.length > 7 ? texto.slice(0, 7) : texto
  return (
    <svg viewBox="0 0 64 64" className={`h-full w-full ${className}`}>
      <path
        d="M32 3 L57 17.5 L57 46.5 L32 61 L7 46.5 L7 17.5 Z"
        fill="var(--surface-2)"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M32 9 L52 20.5 L52 43.5 L32 55 L12 43.5 L12 20.5 Z" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fontSize={curto.length > 5 ? 9 : 11}
        fontWeight="800"
        fill="var(--ink)"
        fontFamily="inherit"
      >
        {curto}
      </text>
    </svg>
  )
}
