import { useEffect, useState } from 'react'

type Props = {
  /** Instante em que o simulado começou (ms) */
  inicio: number
  /** Simulado de prova: conta para frente e para neste tempo (1h30) */
  limiteMs?: number
  /** Cor da borda e do número (a prova muda de cor perto do fim) */
  cor?: string
  /** Prova pausada: o relógio fica congelado no valor deste instante */
  parado?: number
}

/** "4:07" ou "1:02:09" */
function relogio(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function segundos(inicio: number, limiteMs: number | undefined, parado?: number): number {
  const decorrido = Math.max(0, Math.floor(((parado ?? Date.now()) - inicio) / 1000))
  return limiteMs === undefined ? decorrido : Math.min(decorrido, Math.floor(limiteMs / 1000))
}

/** Cronômetro do simulado: conta o tempo desde o início (na prova, até o limite) */
export default function Cronometro({ inicio, limiteMs, cor, parado }: Props) {
  const [vivo, setVivo] = useState(() => segundos(inicio, limiteMs, parado))
  // Confere 4x por segundo para a troca cair junto com a virada do segundo; só redesenha quando o número muda
  useEffect(() => {
    if (parado !== undefined) return
    const id = setInterval(() => setVivo(segundos(inicio, limiteMs)), 250)
    return () => clearInterval(id)
  }, [inicio, limiteMs, parado])
  const valor = parado !== undefined ? segundos(inicio, limiteMs, parado) : vivo

  const texto = relogio(valor)
  return (
    <span
      role="timer"
      aria-label={`Tempo decorrido ${texto}${limiteMs === undefined ? '' : ` de ${relogio(Math.floor(limiteMs / 1000))}`}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-line px-3 py-1 text-sm font-extrabold tabular-nums"
      style={cor ? { borderColor: cor, color: cor } : undefined}
    >
      <IconeCronometro />
      <span className="inline-flex overflow-hidden" aria-hidden="true">
        {[...texto].map((c, i) => (
          // A key muda junto com o dígito: só os dígitos que mudaram são recriados e sobem de novo
          <span key={`${texto.length - i}:${c}`} className="inline-block motion-safe:animate-digito">
            {c}
          </span>
        ))}
      </span>
    </span>
  )
}

export function IconeCronometro() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="14" r="7.5" />
      <path d="M12 14v-3.5M10 2.5h4M12 2.5v4" />
    </svg>
  )
}
