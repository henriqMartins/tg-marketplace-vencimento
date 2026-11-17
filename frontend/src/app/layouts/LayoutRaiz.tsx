import { Outlet } from 'react-router'
import { FaixaServidor } from '../FaixaServidor'

/** Em volta de tudo (menos a A1, que tem a própria faixa): a faixa do servidor. */
export function LayoutRaiz() {
  return (
    <>
      <FaixaServidor />
      <Outlet />
    </>
  )
}
