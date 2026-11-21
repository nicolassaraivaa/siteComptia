import { useState } from 'react'
import { useCert } from '../lib/certContexto'
import { salvarTreino } from '../lib/perfil'
import Castor from './Castor'

type Props = {
  userId: string
  /** Vai refazer a prova: abre a tela da data */
  onRefazer: () => void
  /** Escolheu só treinar (já gravado): segue para o simulado */
  onTreino: () => void
  onCancelar: () => void
}

/** Depois da aprovação, antes de um simulado novo: vai refazer a prova ou é só para treinar? */
export default function ObjetivoSimulado({ userId, onRefazer, onTreino, onCancelar }: Props) {
  const cert = useCert()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function treinar() {
    setErro(null)
    setSalvando(true)
    try {
      await salvarTreino(userId, cert.id)
    } catch (e) {
      setErro(`Não foi possível salvar (${(e as Error).message}). Tente de novo.`)
      setSalvando(false)
      return
    }
    onTreino()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="objetivo-titulo"
      onClick={(e) => e.target === e.currentTarget && !salvando && onCancelar()}
      onKeyDown={(e) => e.key === 'Escape' && !salvando && onCancelar()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/60 p-6 backdrop-blur-md"
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-line bg-surface p-7 text-center shadow-xl">
        <Castor pose="neutro" tamanho={96} />
        <h2 id="objetivo-titulo" className="mt-2 text-2xl font-extrabold tracking-tight">
          Fazer o simulado de novo?
        </h2>
        <p className="mt-2 text-muted">Você vai refazer a prova ou é só para treinar?</p>
        <button
          autoFocus
          onClick={onRefazer}
          disabled={salvando}
          className="foco mt-6 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Vou refazer a prova
        </button>
        <p className="mt-1.5 text-xs text-muted">Você marca a data da nova prova.</p>
        <button
          onClick={() => void treinar()}
          disabled={salvando}
          className="foco mt-4 w-full rounded-2xl border border-line py-3 font-bold transition-colors hover:bg-surface-2 disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Só para treinar'}
        </button>
        <p className="mt-1.5 text-xs text-muted">Sem data de prova. Dá para mudar depois na tela inicial.</p>
        <div aria-live="polite">{erro && <p className="mt-3 text-sm font-medium text-[var(--d2)]">{erro}</p>}</div>
        <button
          onClick={onCancelar}
          disabled={salvando}
          className="foco mt-4 rounded-full px-3 py-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
        >
          Agora não
        </button>
      </div>
    </div>
  )
}
