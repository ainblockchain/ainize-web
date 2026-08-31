import styled from 'styled-components';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/**
 * MUI "standard" text field look used across ainize-web: underline input, 14px.
 * The label is tied to the control with htmlFor and the helper line with aria-describedby, so a field's accessible
 * name is exactly its label ("Question", "facts covered (Facts covered)") and never includes the helper sentence.
 */
export const Field = styled.div`
  display: flex; flex-direction: column; gap: 6px; width: 100%;
`;

export const FieldLabel = styled.label`
  font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.GREY};
`;

/** Stable ids for one field: the control id (caller's `id` wins) and the helper-text id. */
function useFieldIds(id?: string) {
  const auto = useId();
  const controlId = id ?? `f${auto}`;
  return { controlId, helperId: `${controlId}-helper` };
}

export const inputBase = `
  width: 100%;
  padding: 8px 0 7px;
  font-size: 14px;
  color: inherit;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.42);
  border-radius: 0;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  &::placeholder { color: rgba(51, 51, 51, 0.4); }
  &:hover { border-bottom-color: rgba(0, 0, 0, 0.87); }
  &:focus { outline: none; border-bottom: 2px solid #8b3eeb; margin-bottom: -1px; }
  &:disabled { color: #8d8d8f; border-bottom-style: dotted; }
`;

export const Input = styled.input`${inputBase}`;
export const Textarea = styled.textarea`
  ${inputBase}
  min-height: 96px; resize: vertical; line-height: 1.5;
  padding: 8px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px;
  &:focus { border: 1px solid #8b3eeb; margin-bottom: 0; }
`;
export const Select = styled.select`
  ${inputBase}
  cursor: pointer;
`;

export const HelperText = styled.span<{ $error?: boolean }>`
  font-size: 12px; color: ${(p) => (p.$error ? p.theme.color.ERROR : p.theme.color.GREY)};
`;

export function TextField({ label, helper, error, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; helper?: ReactNode; error?: boolean }) {
  const { controlId, helperId } = useFieldIds(id);
  return (
    <Field>
      {label && <FieldLabel htmlFor={controlId}>{label}</FieldLabel>}
      <Input id={controlId} aria-describedby={helper ? helperId : undefined} {...rest} />
      {helper && <HelperText id={helperId} $error={error}>{helper}</HelperText>}
    </Field>
  );
}

export function TextArea({ label, helper, error, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; helper?: ReactNode; error?: boolean }) {
  const { controlId, helperId } = useFieldIds(id);
  return (
    <Field>
      {label && <FieldLabel htmlFor={controlId}>{label}</FieldLabel>}
      <Textarea id={controlId} aria-describedby={helper ? helperId : undefined} {...rest} />
      {helper && <HelperText id={helperId} $error={error}>{helper}</HelperText>}
    </Field>
  );
}

export function SelectField({ label, helper, children, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; helper?: ReactNode }) {
  const { controlId, helperId } = useFieldIds(id);
  return (
    <Field>
      {label && <FieldLabel htmlFor={controlId}>{label}</FieldLabel>}
      <Select id={controlId} aria-describedby={helper ? helperId : undefined} {...rest}>{children}</Select>
      {helper && <HelperText id={helperId}>{helper}</HelperText>}
    </Field>
  );
}

const CheckWrap = styled.label`
  display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; color: ${(p) => p.theme.color.BLACK};
  input { width: 18px; height: 18px; accent-color: #8b3eeb; cursor: pointer; }
`;

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (<CheckWrap><input type="checkbox" {...rest} />{label}</CheckWrap>);
}

export const FormRow = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px;
`;

export const Alert = styled.div<{ $tone?: 'error' | 'success' | 'info' | 'warning' }>`
  padding: 12px 16px; border-radius: 4px; font-size: 14px; line-height: 1.5;
  ${(p) => p.$tone === 'error' ? 'background:#fde8ec;color:#a0102c;' : p.$tone === 'success' ? 'background:#e6f4ea;color:#1e6b36;' : p.$tone === 'warning' ? 'background:#fff3e0;color:#8a4b00;' : 'background:#f5eefc;color:#5b1ca8;'}
`;
