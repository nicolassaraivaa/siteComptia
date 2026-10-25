import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Castor from './Castor'

type Props = {
  tamanho?: number
  onPouso?: () => void
}

const DURACAO_MS = 3800

type Ponto = [number, number]

/**
 * Pontos da "onda" que ele surfa, em frações da tela (0 a 1; x = largura, y = altura).
 * Arcos longos e abertos, sem curvas fechadas: entra pela esquerda, desce a onda até a direita,
 * sobe, volta por cima e desliza até o lugar do pouso (o último ponto é calculado na hora).
 */
const ROTA: Ponto[] = [
  [-0.3, 0.72],
  [0.2, 0.68],
  [0.62, 0.74],
  [0.86, 0.52],
  [0.74, 0.22],
  [0.4, 0.14],
  [0.16, 0.3],
]

const FAGULHAS = [
  { fx: '-130px', fy: '-110px', atraso: 0 },
  { fx: '125px', fy: '-120px', atraso: 90 },
  { fx: '-165px', fy: '-20px', atraso: 170 },
  { fx: '160px', fy: '-30px', atraso: 50 },
  { fx: '-60px', fy: '-165px', atraso: 230 },
  { fx: '70px', fy: '-170px', atraso: 130 },
]

/** Catmull-Rom: curva suave que passa por todos os pontos */
function pontoNaCurva(rota: Ponto[], u: number): Ponto {
  const n = rota.length - 1
  const s = Math.min(u * n, n - 1e-9)
  const i = Math.floor(s)
  const t = s - i
  const p0 = rota[Math.max(0, i - 1)]
  const p1 = rota[i]
  const p2 = rota[i + 1]
  const p3 = rota[Math.min(n, i + 2)]
  const c = (a: number, b: number, c2: number, d: number) =>
    0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t)
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]
}

/** Ritmo do passeio: arranca suave, desliza em velocidade quase constante e freia devagar no pouso */
function ritmo(t: number): number {
  const a = 0.12 // fração do tempo acelerando
  const b = 0.3 // fração do tempo freando
  const v = 1 / (1 - a / 2 - b / 2) // velocidade de cruzeiro para percorrer tudo em t = 1
  if (t < a) return (v * t * t) / (2 * a)
  if (t < 1 - b) return v * (t - a / 2)
  const r = 1 - t
  return 1 - (v * r * r) / (2 * b)
}

/** Onde o castor está num instante: centro na tela, inclinação e escala */
type Amostra = { x: number; y: number; incl: number; escala: number }

/**
 * Calcula o passeio inteiro de uma vez. O castor percorre a curva em velocidade uniforme (pela
 * distância, não pelo parâmetro da curva, que acelera e freia em cada trecho), balança nas ondas
 * e inclina como surfista. Devolve os quadros da animação e as mesmas posições em coordenadas
 * da tela, que o rastro usa sem precisar medir a página a cada quadro.
 * (cx, cy) é o centro do lugar onde ele pousa.
 */
function passeio(w: number, h: number, cx: number, cy: number, tamanho: number) {
  const rota: Ponto[] = [...ROTA, [cx / w, cy / h] as Ponto].map(([x, y]) => [x * w, y * h])

  // curva amostrada bem fina, com a distância acumulada
  const M = 600
  const curva = Array.from({ length: M + 1 }, (_, k) => pontoNaCurva(rota, k / M))
  const dist = [0]
  for (let k = 1; k <= M; k++) {
    dist.push(dist[k - 1] + Math.hypot(curva[k][0] - curva[k - 1][0], curva[k][1] - curva[k - 1][1]))
  }
  const total = dist[M]
  const naDistancia = (d: number): Ponto => {
    let i = 1
    while (i < M && dist[i] < d) i++
    const f = (d - dist[i - 1]) / (dist[i] - dist[i - 1] || 1)
    return [curva[i - 1][0] + (curva[i][0] - curva[i - 1][0]) * f, curva[i - 1][1] + (curva[i][1] - curva[i - 1][1]) * f]
  }

  // ondas do mesmo tamanho em qualquer tela (proporcionais ao castor, não à tela)
  const comprimentoOnda = tamanho * 1.8
  const N = 160
  const pts = Array.from({ length: N + 1 }, (_, k) => {
    const t = k / N
    const d = ritmo(t) * total
    const [x, y] = naDistancia(d)
    const onda = Math.sin((d / comprimentoOnda) * Math.PI * 2) * 12 * Math.min(1, (1 - t) * 3) // some no pouso
    return { x, y: y + onda, t }
  })

  // inclinação de surfista: pela direção do movimento (sobe a onda = bico para cima), suavizada
  const bruta = pts.map((_, k) => {
    const a = pts[Math.max(0, k - 2)]
    const b = pts[Math.min(N, k + 2)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.hypot(dx, dy) < 0.5) return 0
    const angulo = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI
    return Math.max(-24, Math.min(24, angulo * 0.7 * Math.sign(dx || 1)))
  })
  const amostras: Amostra[] = pts.map((p, k) => {
    let soma = 0
    let n = 0
    for (let j = Math.max(0, k - 6); j <= Math.min(N, k + 6); j++) {
      soma += bruta[j]
      n++
    }
    return {
      x: p.x,
      y: p.y,
      incl: (soma / n) * Math.min(1, (1 - p.t) * 4), // endireita ao pousar
      escala: 0.62 + 0.38 * ritmo(p.t),
    }
  })

  const quadros: Keyframe[] = amostras.map((a, k) => ({
    offset: k / N,
    transform: `translate(${(a.x - cx).toFixed(1)}px, ${(a.y - cy).toFixed(1)}px) rotate(${a.incl.toFixed(2)}deg) scale(${a.escala.toFixed(3)})`,
  }))
  return { quadros, amostras }
}

/** Posição do castor no instante t (0 a 1), interpolando as amostras */
function amostraEm(amostras: Amostra[], t: number): Amostra {
  const s = Math.max(0, Math.min(1, t)) * (amostras.length - 1)
  const i = Math.min(amostras.length - 2, Math.floor(s))
  const f = s - i
  const a = amostras[i]
  const b = amostras[i + 1]
  const mix = (p: number, q: number) => p + (q - p) * f
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), incl: mix(a.incl, b.incl), escala: mix(a.escala, b.escala) }
}

/** Solta na tela uma bolinha de espuma (ou um brilho) que se desfaz sozinha */
function soltar(onde: HTMLElement, x: number, y: number, dx: number, dy: number, tam: number, brilho = false) {
  const el = document.createElement('span')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${tam}px`,
    height: `${tam}px`,
    borderRadius: '9999px',
  })
  if (brilho) {
    el.textContent = '✦'
    Object.assign(el.style, { color: '#ffb938', fontSize: `${tam}px`, lineHeight: `${tam}px`, animation: 'rastro 700ms ease-out forwards' })
  } else {
    Object.assign(el.style, {
      background: 'radial-gradient(circle at 40% 35%, #ffffff, #f4f3ff 45%, #cfcbf7 100%)',
      animation: `espuma ${750 + Math.random() * 300}ms ease-out forwards`,
    })
  }
  el.style.setProperty('--dx', `${dx}px`)
  el.style.setProperty('--dy', `${dy}px`)
  el.addEventListener('animationend', () => el.remove())
  onde.appendChild(el)
}

function reduzMovimento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Nickols atravessa a tela surfando na nuvem, pousa no lugar dele (com impacto e espuma
 * espirrando) e o fogo acende atrás. Um toque ou Espaço/Enter/Esc pula direto para o pouso.
 */
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
    const tela = rastro.current
    if (!el || !tela) return
    const caixa = el.getBoundingClientRect()
    const cx = caixa.left + caixa.width / 2
    const cy = caixa.top + caixa.height / 2
    const { quadros, amostras } = passeio(window.innerWidth, window.innerHeight, cx, cy, tamanho)
    const anim = el.animate(quadros, { duration: DURACAO_MS, fill: 'both' })

    // Rastro: espuma a cada ~14 px percorridos, saindo da parte de trás da nuvem (já inclinada),
    // sincronizado com os quadros da tela e calculado pela rota, sem medir a página
    let ultimo: Ponto | null = null
    let conta = 0
    let quadro = 0
    const passo = () => {
      const t = (Number(anim.currentTime) || 0) / DURACAO_MS
      const a = amostraEm(amostras, t)
      const b = amostraEm(amostras, t + 0.01)
      const vel = Math.hypot(b.x - a.x, b.y - a.y)
      if (vel > 0.05) {
        const tras: Ponto = [-(b.x - a.x) / vel, -(b.y - a.y) / vel]
        const giro = (a.incl * Math.PI) / 180
        const tam = tamanho * a.escala
        // base da nuvem (abaixo do centro), girada junto com a prancha, e depois para trás
        const px = a.x - Math.sin(giro) * tam * 0.36 + tras[0] * tam * 0.3
        const py = a.y + Math.cos(giro) * tam * 0.36 + tras[1] * tam * 0.08
        if (!ultimo || Math.hypot(px - ultimo[0], py - ultimo[1]) > 14) {
          ultimo = [px, py]
          const brilho = ++conta % 5 === 0
          soltar(
            tela,
            px + (Math.random() - 0.5) * 10,
            py + (Math.random() - 0.5) * 6,
            tras[0] * 34,
            tras[1] * 10 + 10,
            brilho ? 14 : tam * (0.12 + Math.random() * 0.1),
            brilho,
          )
        }
      }
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)

    const pular = () => anim.finish()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        pular()
      }
    }
    window.addEventListener('pointerdown', pular)
    window.addEventListener('keydown', tecla)
    anim.onfinish = () => {
      // pouso: a nuvem espirra espuma para os dois lados
      for (let i = 0; i < 14; i++) {
        const lado = i % 2 === 0 ? -1 : 1
        soltar(
          tela,
          cx + lado * tamanho * (0.12 + Math.random() * 0.22),
          cy + tamanho * 0.38,
          lado * (40 + Math.random() * 80),
          -8 - Math.random() * 28,
          tamanho * (0.09 + Math.random() * 0.1),
        )
      }
      // a posição final é a mesma de sem animação; tirar a animação deixa o castor nítido
      anim.cancel()
      setPousou(true)
    }
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('pointerdown', pular)
      window.removeEventListener('keydown', tecla)
      anim.onfinish = null
      anim.cancel()
    }
  }, [pousou, tamanho])

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
                  animation: `fagulha 1.2s ease-out ${300 + f.atraso}ms 3 both`,
                } as CSSProperties
              }
            >
              🔥
            </span>
          ))}
        </>
      )}
      <div
        ref={castor}
        className={`relative z-50 ${pousou ? '' : 'will-change-transform'}`}
        style={{ width: tamanho, height: tamanho }}
      >
        {pousou && (
          <span aria-hidden="true" className="anel-pouso absolute bottom-[4%] left-1/2 h-7 w-4/5 -translate-x-1/2 rounded-[50%]" />
        )}
        {/* As duas poses ficam montadas desde o início: a troca no pouso é um cruzamento rápido, sem piscar */}
        <div className={`relative h-full w-full ${pousou ? 'animate-pouso' : ''}`}>
          <Castor
            pose="neutro"
            tamanho={tamanho}
            rotulo={pousou ? undefined : 'Nickols, o castor, surfando na nuvem'}
            className={`absolute inset-0 transition-opacity duration-150 ${pousou ? 'opacity-0' : ''}`}
          />
          <Castor
            pose="streak"
            tamanho={tamanho}
            rotulo={pousou ? 'Nickols, o castor, comemorando na frente do fogo' : undefined}
            className={`absolute inset-0 transition-opacity duration-150 ${pousou ? '' : 'opacity-0'}`}
          />
        </div>
      </div>
    </div>
  )
}
