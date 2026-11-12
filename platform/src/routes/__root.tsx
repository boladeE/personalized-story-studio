import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles/app.css?url'
import { DraftProvider } from '../components/draft'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex' },
      { title: 'Little Things Digital - Studio' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: 'data:,' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <main className="studio-page narrow">
      <h1 className="studio-title">This page doesn’t exist.</h1>
      <p><a href="/">Back to the studio</a></p>
    </main>
  ),
})

function RootComponent() {
  useEffect(() => {
    document.documentElement.dataset.ready = 'true'
  }, [])
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <DraftProvider>
          <Outlet />
        </DraftProvider>
        <Scripts />
      </body>
    </html>
  )
}
