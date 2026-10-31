import { api } from '../api/api';
import { current, isDraft } from '@reduxjs/toolkit';
import type { AppDispatch } from '../store';
import { readWalletSend, walletSendContextKey, type WalletSendContext, type WalletSendStatus } from './accountWalletSend';
const snapshot = (value: unknown) => isDraft(value) ? current(value as object) : value;

function retainProgress(previous: WalletSendStatus | null, incoming: WalletSendStatus): WalletSendStatus {
  const a = previous?.operation, b = incoming.operation;
  if (!a || !b || a.id !== b.id) return incoming;
  const sameIntent = a.tx_hash === b.tx_hash && a.to === b.to && a.actor === b.actor && a.amount === b.amount && (a.memo ?? null) === (b.memo ?? null) && a.created_at === b.created_at && walletSendContextKey(a.context) === walletSendContextKey(b.context);
  const transitions = { prepared: ['prepared', 'submitted', 'confirmed', 'rejected', 'cancelled'], submitted: ['submitted', 'confirmed', 'rejected'], confirmed: ['confirmed'], rejected: ['rejected'], cancelled: ['cancelled'] };
  return !sameIntent || b.updated_at < a.updated_at || !transitions[a.state].includes(b.state) ? previous! : incoming;
}

/** An exact receipt may update the same active request, never replace it with an older history selection. */
export function syncWalletSendReceipt(dispatch: AppDispatch, scope: { identity: string; context: WalletSendContext }, raw: unknown, before?: unknown) {
  let value = readWalletSend(raw, scope.context);
  if (!value?.operation) return;
  const remembered = readWalletSend(before, scope.context);
  value = retainProgress(remembered, value);
  const op = value.operation!;
  const observed = remembered?.operation;
  let changed = observed?.id === op.id && observed.state !== op.state;
  dispatch(api.util.updateQueryData('walletSendStatus', scope, cached => {
    const previous = readWalletSend(snapshot(cached), scope.context);
    if (previous?.operation?.id !== op.id) return;
    value = retainProgress(previous, value!);
    changed ||= previous.operation.state !== value.operation!.state;
    return value;
  }));
  dispatch(api.util.updateQueryData('walletSendRequest', { ...scope, id: op.id }, cached => {
    value = retainProgress(readWalletSend(snapshot(cached), scope.context), value!);
    return value;
  }));
  // A detail cache may have a newer receipt than a just-arrived latest-query response.
  dispatch(api.util.updateQueryData('walletSendStatus', scope, cached => {
    const previous = readWalletSend(snapshot(cached), scope.context);
    if (previous?.operation?.id !== op.id) return;
    const next = retainProgress(previous, value!);
    changed ||= previous.operation.state !== next.operation!.state;
    return next;
  }));
  if (changed) {
    dispatch(api.util.invalidateTags(['WalletSendHistory']));
    if (value.operation?.state === 'confirmed' || value.operation?.state === 'rejected') dispatch(api.util.invalidateTags(['WalletBalance']));
  }
}
