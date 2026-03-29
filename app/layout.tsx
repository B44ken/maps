import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'gmaps' }

export default ({ children }: { children: ReactNode }) => <html lang="en"><body>{children}</body></html>
