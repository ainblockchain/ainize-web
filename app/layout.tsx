/**
 * The document. A server component: it names the page, loads the fonts and hands the tree to the style registry.
 *
 * What used to be `index.html` lives here, with one difference that matters — `metadata` is per route now, so a
 * knowledge page can carry its own title and description instead of every URL sharing the landing page's.
 */
import type { Metadata, Viewport } from 'next';
import StyledRegistry from './registry';

const TITLE = 'Ainize | Plug knowledge into your AI';
const DESCRIPTION = 'Ainize: pick verified knowledge, test it live, and load it into your AI model in seconds. Publish knowledge and the network verifies it and pays you per sale.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  icons: { shortcut: '/static/favicon.png' },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: 'AI + -ize: make knowledge something a model actually knows. Verified, live-testable, paid automatically.',
    images: ['/static/images/cover_image.png'],
  },
};

export const viewport: Viewport = { themeColor: '#8b3eeb', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Mulish:wght@400;600;700;800&family=Inconsolata:wght@400;500&family=Noto+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <StyledRegistry>{children}</StyledRegistry>
      </body>
    </html>
  );
}
