import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  html, body {
    margin: 0;
    background-color: #ffffff;
    color: ${(p) => p.theme.color.BLACK};
    font-family: ${(p) => p.theme.font.body};
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  a { color: ${(p) => p.theme.color.PRIMARY}; }
  button, input, select, textarea { font-family: inherit; font-size: inherit; }
  code, pre, .mono { font-family: ${(p) => p.theme.font.mono}; }
  :focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 2px; }
  ::selection { background: ${(p) => p.theme.color.PRESSED}; }
`;
