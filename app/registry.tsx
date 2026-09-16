'use client';

/**
 * styled-components on the server.
 *
 * Without this the first paint arrives unstyled and the page repaints when the JS lands — the flash is worst on
 * exactly the pages a visitor sees first. The registry collects the rules generated while the tree renders and
 * Next injects them into the streamed HTML; `useServerInsertedHTML` is the hook that makes the timing correct
 * for streaming, which a plain `<style>` in the layout does not.
 *
 * The client is unaffected: after hydration styled-components manages its own sheet and this returns children.
 */
import { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { ServerStyleSheet, StyleSheetManager, ThemeProvider } from 'styled-components';
import { theme } from '@/theme/theme';
import { GlobalStyle } from '@/styles/GlobalStyle';

export default function StyledRegistry({ children }: { children: React.ReactNode }) {
  const [sheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    // the sheet is emptied after it is handed over, or a streamed page repeats every rule it has seen
    sheet.instance.clearTag();
    return <>{styles}</>;
  });

  const tree = (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
  if (typeof window !== 'undefined') return tree;
  return <StyleSheetManager sheet={sheet.instance}>{tree}</StyleSheetManager>;
}
