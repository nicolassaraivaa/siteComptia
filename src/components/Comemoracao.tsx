import { useEffect, useRef, type CSSProperties } from 'react'
import Castor from './Castor'

type Props = {
  /** dias seguidos de ofensiva, já contando hoje */
  dias: number
  recorde: boolean
  onFechar: () => void
}

const DURACAO_MS = 3500

// fagulhas que saem de trás do castor, em direções fixas
const FAGULHAS = [
  { fx: '-120px', fy: '-90px', atraso: 0 },
  { fx: '115px', fy: '-100px', atraso: 80 },
  { fx: '-150px', fy: '10px', atraso: 160 },
  { fx: '150px', fy: '0px', atraso: 40 },
  { fx: '-70px', fy: '-140px', atraso: 220 },
  { fx: '80px', fy: '-145px', atraso: 120 },
  { fx: '-110px', fy: '70px', atraso: 260 },
  { fx: '105px', fy: '80px', atraso: 200 },
]

/** Nickols comemora a ofensiva do dia: aparece na primeira revisão de cada dia e some sozinho */
export default function Comemoracao({ dias, recorde, onFechar }: Props) {
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    botao.current?.focus()
    const id = setTimeout(onFechar, DURACAO_MS)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', esc)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', esc)
    }
  }, [onFechar])

  const titulo = dias === 1 ? 'Ofensiva começou!' : `${dias} dias seguidos!`
  const subtitulo = recorde && dias > 1 ? 'Novo recorde. O Nickols está orgulhoso!' : dias === 1 ? 'O Nickols te espera amanhã para manter o fogo aceso.' : 'Ofensiva mantida. O Nickols está comemorando com você!'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comemoracao-titulo"
      onClick={onFechar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-6 backdrop-blur-sm"
    >
      <div className="motion-safe:animate-castor-entrar flex flex-col items-center text-center">
        <div className="relative">
          {FAGULHAS.map((f, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="castor-fagulha absolute top-1/2 left-1/2 -mt-3 -ml-3 text-2xl opacity-0"
              style={
                {
                  '--fx': f.fx,
                  '--fy': f.fy,
                  animation: `fagulha 1.1s ease-out ${f.atraso}ms 2 both`,
                } as CSSProperties
              }
            >
              🔥
            </span>
          ))}
          <Castor tamanho={180} animacao="comemorando" rotulo="Nickols, o castor, comemorando" className="relative z-10" />
        </div>
        <p id="comemoracao-titulo" className="mt-4 text-4xl font-extrabold tracking-tight tabular-nums">
          {titulo}
        </p>
        <p className="mt-2 font-medium text-flame">{subtitulo}</p>
        <button
          ref={botao}
          onClick={onFechar}
          className="foco mt-8 rounded-2xl bg-primary px-8 py-3 font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
