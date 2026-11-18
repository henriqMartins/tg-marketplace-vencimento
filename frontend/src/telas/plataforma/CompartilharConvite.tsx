import { useRef, useState } from 'react'
import type { Convite } from '../../api'
import { linkDoConvite, mensagemDoConvite } from '../../app/parceria'
import { Botao } from '../../componentes/Botao'
import { useToast } from '../../componentes/toast/contexto'
import { formatarDataCurta } from '../../util/formatar'
import styles from './Plataforma.module.css'

/**
 * O convite pronto para mandar (P3 e "Gerar novo convite" da P2): o link em texto
 * selecionável, "Copiar link", a validade e a mensagem pronta para o WhatsApp.
 * O sistema não envia e-mail (docs/parceria.md, seção 1): a equipe copia e manda.
 */
export function CompartilharConvite({ convite, nomeLoja }: { convite: Convite; nomeLoja: string }) {
  const mostrarToast = useToast()
  const campoLink = useRef<HTMLInputElement>(null)
  const campoMensagem = useRef<HTMLTextAreaElement>(null)
  const [semCopiar, setSemCopiar] = useState(false)
  const link = linkDoConvite(convite.codigo)
  const mensagem = mensagemDoConvite({ nomeLoja, link, expiraEm: convite.expira_em, email: convite.email })

  async function copiar(texto: string, campo: HTMLInputElement | HTMLTextAreaElement | null, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setSemCopiar(false)
      mostrarToast(aviso)
    } catch {
      // Navegador sem permissão (ou http fora do localhost): deixa o texto selecionado.
      campo?.select()
      setSemCopiar(true)
    }
  }

  return (
    <div className={styles.convite}>
      <label className={styles.rotulo} htmlFor="link-convite">
        Link do convite
      </label>
      <div className={styles.linhaCopiar}>
        <input
          ref={campoLink}
          id="link-convite"
          className={styles.textoSelecionavel}
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
        />
        <Botao larguraTotal={false} onClick={() => copiar(link, campoLink.current, 'Link copiado.')}>
          Copiar link
        </Botao>
      </div>
      <p className={styles.nota}>
        Vale até {formatarDataCurta(convite.expira_em)}, uma vez só, para <strong>{convite.email}</strong>.
      </p>

      <label className={styles.rotulo} htmlFor="mensagem-convite">
        Mensagem para o WhatsApp
      </label>
      <textarea
        ref={campoMensagem}
        id="mensagem-convite"
        className={styles.textoSelecionavel}
        readOnly
        rows={4}
        value={mensagem}
        onFocus={(e) => e.target.select()}
      />
      <Botao
        variante="secundario"
        larguraTotal={false}
        onClick={() => copiar(mensagem, campoMensagem.current, 'Mensagem copiada.')}
      >
        Copiar mensagem
      </Botao>
      {semCopiar && (
        <p className={styles.nota} role="status">
          O navegador não deixou copiar. O texto ficou selecionado: use Ctrl+C (ou segure e copie, no celular).
        </p>
      )}
    </div>
  )
}
