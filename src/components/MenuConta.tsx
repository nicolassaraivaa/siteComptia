import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = { email: string; onAlterarDataProva: () => void }

/** Menu do canto: dados da conta, data da prova e sair */
export default function MenuConta({ email, onAlterarDataProva }: Props) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const inicial = email.trim().charAt(0).toUpperCase() || '?'

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label="Abrir menu da conta"
        className="foco flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-bg"
          aria-hidden="true"
        >
          {inicial}
        </span>
        Conta
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg shadow-black/10"
        >
          <p className="border-b border-line px-4 py-3 text-sm">
            <span className="block text-xs text-muted">Conectado como</span>
            <span className="block truncate font-medium">{email}</span>
          </p>
          <button
            role="menuitem"
            onClick={() => {
              setAberto(false)
              onAlterarDataProva()
            }}
            className="foco block w-full px-4 py-3 text-left text-sm hover:bg-surface-2"
          >
            Alterar data da prova
          </button>
          <button
            role="menuitem"
            onClick={() => supabase.auth.signOut()}
            className="foco block w-full px-4 py-3 text-left text-sm text-[var(--d2)] hover:bg-surface-2"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
