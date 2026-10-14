import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'questoes'
const VALIDADE_S = 60 * 60
const cache = new Map<string, Promise<string | null>>()

function urlAssinada(nome: string): Promise<string | null> {
  let p = cache.get(nome)
  if (!p) {
    p = supabase.storage
      .from(BUCKET)
      .createSignedUrl(nome, VALIDADE_S)
      .then(({ data, error }) => {
        if (error) {
          cache.delete(nome) // permite tentar de novo
          return null
        }
        return data.signedUrl
      })
    cache.set(nome, p)
  }
  return p
}

/** Imagem de uma questão, servida do bucket privado por URL assinada */
export default function ImagemQuestao({ nome, alt }: { nome: string; alt: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let ativo = true
    urlAssinada(nome).then((u) => ativo && setUrl(u))
    return () => {
      ativo = false
    }
  }, [nome])

  if (url === undefined) return <div className="h-32 animate-pulse rounded-xl bg-surface-2" aria-label="Carregando imagem…" />
  if (url === null) {
    return (
      <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
        Imagem {nome} indisponível. Confira se ela foi enviada ao bucket “questoes” do Storage.
      </p>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="foco block rounded-xl" title="Abrir em tamanho real">
      <img src={url} alt={alt} loading="lazy" className="h-auto w-full rounded-xl border border-line bg-white" />
    </a>
  )
}
