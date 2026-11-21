import { createContext, useContext } from 'react'
import { PADRAO, type Certificacao } from '../certificacoes'

/** Certificação que está sendo treinada: domínios, formato da prova e dados ficam presos a ela */
export const CertContexto = createContext<Certificacao>(PADRAO)

export function useCert(): Certificacao {
  return useContext(CertContexto)
}
