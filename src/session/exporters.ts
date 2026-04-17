import type { SessionExport, SessionHandLog } from './types';

const pad = (value: number) => value.toString().padStart(2, '0');
const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>) => [
  headers.map(csvEscape).join(','),
  ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
].join('\n');

const fileStamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const handBoard = (hand: SessionHandLog) => [hand.board.flop.join(' '), hand.board.turn, hand.board.river].filter(Boolean).join(' ');

export const buildSessionJson = (sessionExport: SessionExport) => JSON.stringify(sessionExport, null, 2);

export const buildHandsCsv = (sessionExport: SessionExport) => toCsv([
  'sessionId',
  'handNumber',
  'handId',
  'startedAt',
  'heroSeat',
  'heroCards',
  'buttonSeat',
  'villainCount',
  'board',
  'resultBb',
  'winnerSeats',
  'showdown',
  'heroInvolved',
  'heroWon',
  'heroFoldStreet',
  'potFinal',
  'handIntegrity',
  'integrityErrors',
  'engineVersion',
  'notes'
], sessionExport.hands.map((hand) => ({
  sessionId: sessionExport.session.id,
  handNumber: hand.handNumber,
  handId: hand.handId,
  startedAt: hand.startedAt,
  heroSeat: 0,
  heroCards: hand.heroHoleCards.join(' '),
  buttonSeat: hand.buttonSeat,
  villainCount: Math.max(0, hand.activePlayersAtStart.length - 1),
  board: handBoard(hand),
  resultBb: hand.result.heroResultBb ?? '',
  winnerSeats: hand.result.winnerSeats.join('|'),
  showdown: hand.result.showdown,
  heroInvolved: hand.result.heroInvolved,
  heroWon: hand.result.heroWon,
  heroFoldStreet: hand.result.heroFoldStreet ?? '',
  potFinal: hand.result.potFinal ?? '',
  handIntegrity: hand.handIntegrity,
  integrityErrors: hand.integrityErrors.join(' | '),
  engineVersion: hand.engineVersion,
  notes: [hand.status !== 'completed' ? 'In progress' : '', ...hand.notes].filter(Boolean).join(' | ')
})));

export const buildActionsCsv = (sessionExport: SessionExport) => toCsv([
  'sessionId',
  'handNumber',
  'actionIndex',
  'timestamp',
  'street',
  'actorSeat',
  'actorName',
  'action',
  'amount',
  'toAmount',
  'potBefore',
  'potAfter',
  'stackBefore',
  'stackAfter',
  'amountToCallBefore',
  'amountToCallAfter',
  'isAllIn',
  'note'
], sessionExport.hands.flatMap((hand) => hand.actions.map((action) => ({
  sessionId: sessionExport.session.id,
  handNumber: hand.handNumber,
  actionIndex: action.actionIndex,
  timestamp: action.timestamp,
  street: action.street,
  actorSeat: action.actorSeat,
  actorName: action.actorName,
  action: action.action,
  amount: action.amount,
  toAmount: action.toAmount ?? '',
  potBefore: action.potBefore ?? '',
  potAfter: action.potAfter ?? '',
  stackBefore: action.stackBefore ?? '',
  stackAfter: action.stackAfter ?? '',
  amountToCallBefore: action.amountToCallBefore ?? '',
  amountToCallAfter: action.amountToCallAfter ?? '',
  isAllIn: action.isAllIn ?? '',
  note: action.note ?? ''
}))));

export const downloadTextFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const buildExportFilename = (timestamp: string, suffix: 'json' | 'hands.csv' | 'actions.csv') => (
  `pocket-pixel-poker-session-${fileStamp(timestamp)}.${suffix}`
);
