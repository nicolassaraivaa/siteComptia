import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Castor from './Castor'

type Props = {
  tamanho?: number
  onPouso?: () => void
}

const DURACAO_MS = 2800

/**
 * Pontos do voo em frações da tela (0 a 1; x = largura, y = altura), sempre dentro da área
 * visível. Entra pelo canto de baixo à esquerda, dá uma volta pela tela e pousa no lugar dele.
 */
const ROTA: [number, number][] = [
  [-0.2, 1.15],
  [0.22, 0.3],
  [0.72, 0.18],
  [0.8, 0.62],
  [0.5, 0.8],
  [0.2, 0.58],
  [0.36, 0.28],
]

const FAGULHAS = [
  { fx: '-130px', fy: '-110px', atraso: 0 },
  { fx: '125px', fy: '-120px', atraso: 90 },
  { fx: '-165px', fy: '-20px', atraso: 170 },
  { fx: '160px', fy: '-30px', atraso: 50 },
  { fx: '-60px', fy: '-165px', atraso: 230 },
  { fx: '70px', fy: '-170px', atraso: 130 },
]

/** Catmull-Rom: curva suave que passa por todos os pontos, sem parar em cada um */
function pontoNaCurva(rota: [number, number][], u: number): [number, number] {
  const ROTA = rota
  const n = ROTA.length - 1
  const s = Math.min(u * n, n - 1e-9)
  const i = Math.floor(s)
  const t = s - i
  const p0 = ROTA[Math.max(0, i - 1)]
  const p1 = ROTA[i]
  const p2 = ROTA[i + 1]
  const p3 = ROTA[Math.min(n, i + 2)]
  const c = (a: number, b: number, c2: number, d: number) =>
    0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t)
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]
}

/**
 * Quadros do voo: posição pela curva, inclinação pela direção e o castor crescendo ao chegar perto.
 * (cx, cy) é o centro do lugar onde ele pousa; os quadros são deslocamentos a partir dele.
 */
function quadros(w: number, h: number, cx: number, cy: number): Keyframe[] {
  const N = 90
  const rota: [number, number][] = [...ROTA, [cx / w, cy / h]]
  const pos = Array.from({ length: N + 1 }, (_, k) => {
    // começa rápido e desacelera para pousar
    const u = 1 - Math.pow(1 - k / N, 2.2)
    const [x, y] = pontoNaCurva(rota, u)
    return { x: x * w - cx, y: y * h - cy, u }
  })
  return pos.map((p, k) => {
    const prox = pos[Math.min(N, k + 1)]
    const ant = pos[Math.max(0, k - 1)]
    const inclina = k === N ? 0 : Math.max(-28, Math.min(28, (prox.x - ant.x) * 0.35))
    const escala = 0.55 + 0.45 * p.u
    return {
      offset: k / N,
      transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${inclina.toFixed(1)}deg) scale(${escala.toFixed(3)})`,
    }
  })
}

function reduzMovimento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Nickols atravessa a tela voando, pousa no lugar dele e o fogo acende atrás. Um toque pula o voo. */
export default function NickolsVoando({ tamanho = 190, onPouso }: Props) {
  const castor = useRef<HTMLDivElement>(null)
  const rastro = useRef<HTMLDivElement>(null)
  const [pousou, setPousou] = useState(reduzMovimento)
  const avisou = useRef(false)
  // em ref para o voo não recomeçar se a tela por trás renderizar de novo
  const aoPousar = useRef(onPouso)
  useEffect(() => {
    aoPousar.current = onPouso
  }, [onPouso])

  useEffect(() => {
    if (pousou) {
      if (!avisou.current) {
        avisou.current = true
        aoPousar.current?.()
      }
      return
    }
    const el = castor.current
    if (!el) return
    const destino = el.getBoundingClientRect()
    const anim = el.animate(
      quadros(window.innerWidth, window.innerHeight, destino.left + destino.width / 2, destino.top + destino.height / 2),
      { duration: DURACAO_MS, fill: 'both' },
    )

    // rastro de brilhos atrás do castor enquanto ele voa
    const id = setInterval(() => {
      const caixa = el.getBoundingClientRect()
      const brilho = document.createElement('span')
      brilho.textContent = Math.random() < 0.5 ? '✦' : '•'
      brilho.setAttribute('aria-hidden', 'true')
      Object.assign(brilho.style, {
        position: 'fixed',
        left: `${caixa.left + caixa.width / 2 + (Math.random() - 0.5) * 30}px`,
        top: `${caixa.top + caixa.height * 0.75}px`,
        color: Math.random() < 0.5 ? '#ffb938' : '#8a70ff',
        fontSize: `${12 + Math.random() * 12}px`,
        animation: 'rastro 700ms ease-out forwards',
      })
      brilho.addEventListener('animationend', () => brilho.remove())
      rastro.current?.appendChild(brilho)
    }, 45)

    const pular = () => anim.finish()
    window.addEventListener('pointerdown', pular)
    anim.onfinish = () => setPousou(true)
    return () => {
      clearInterval(id)
      window.removeEventListener('pointerdown', pular)
      anim.onfinish = null
      anim.cancel()
    }
  }, [pousou])

  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }}>
      <div ref={rastro} className="pointer-events-none fixed inset-0 z-40 overflow-hidden" />
      {pousou && (
        <>
          <div aria-hidden="true" className="fogo-atras absolute -inset-[22%] -top-[38%]" />
          {FAGULHAS.map((f, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="castor-fagulha absolute top-1/3 left-1/2 -ml-3 text-2xl opacity-0"
              style={
                {
                  '--fx': f.fx,
                  '--fy': f.fy,
                  animation: `fagulha 1.2s ease-out ${f.atraso}ms 3 both`,
                } as CSSProperties
              }
            >
              🔥
            </span>
          ))}
        </>
      )}
      <div ref={castor} className="relative z-50 will-change-transform">
        <Castor
          pose={pousou ? 'streak' : 'acertou'}
          tamanho={tamanho}
          rotulo={pousou ? 'Nickols, o castor, comemorando na frente do fogo' : 'Nickols, o castor, voando'}
        />
      </div>
    </div>
  )
}
