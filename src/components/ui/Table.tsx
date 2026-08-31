import styled from 'styled-components';

/** Table primitives ported from ainize-web components/ui/table/Table.js */
export const TableWrapper = styled.div`
  width: 100%; overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%; border-collapse: collapse;
`;

export const TableHeader = styled.thead``;
export const TableBody = styled.tbody`
  background-color: #ffffff;
`;

export const TableRow = styled.tr`
  height: 50px; background-color: #ffffff;
`;

export const TableRowEmpty = styled.tr<{ $height?: number }>`
  height: ${(p) => p.$height ?? 160}px; background-color: #ffffff;
  td { text-align: center; color: ${(p) => p.theme.color.GREY}; font-size: 14px; }
`;

export const TableHead = styled.th<{ $align?: 'left' | 'center' | 'right'; $padding?: string }>`
  position: sticky; top: 0; z-index: 1;
  padding: ${(p) => p.$padding ?? '0 8px'};
  font-size: 14px; font-weight: 400;
  text-align: ${(p) => p.$align ?? 'center'};
  user-select: none; white-space: nowrap;
  background-color: #ffffff;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: ${(p) => p.theme.color.GREY};
`;

export const TableData = styled.td<{ $align?: 'left' | 'center' | 'right'; $padding?: string; $maxWidth?: string; $weight?: number; $color?: string; $mono?: boolean }>`
  max-width: ${(p) => p.$maxWidth ?? '240px'};
  padding: ${(p) => p.$padding ?? '0 8px'};
  font-size: 14px;
  text-align: ${(p) => p.$align ?? 'center'};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: ${(p) => p.$weight ?? 400};
  font-family: ${(p) => (p.$mono ? p.theme.font.mono : 'inherit')};
  color: ${(p) => p.$color ?? p.theme.color.BLACK};
  border-bottom: 1px solid #f4f4f4;
`;

export const SubText = styled.div`
  margin-top: 4px; font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.GREY};
  overflow: hidden; text-overflow: ellipsis;
`;
