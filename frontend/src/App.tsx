import { createBrowserRouter, RouterProvider } from 'react-router'
import { ProvedorApp } from './app/ProvedorApp'
import { rotas } from './app/rotas'

const roteador = createBrowserRouter(rotas)

export default function App() {
  return (
    <ProvedorApp>
      <RouterProvider router={roteador} />
    </ProvedorApp>
  )
}
