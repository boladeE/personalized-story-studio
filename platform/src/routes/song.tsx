import { createFileRoute, redirect } from '@tanstack/react-router'

/** The song used to have a page of its own. It is now a room of the film's editor, and old links go there. */
export const Route = createFileRoute('/song')({
  beforeLoad: () => {
    throw redirect({ to: '/preview', search: { edit: 1, song: 1 } })
  },
})
