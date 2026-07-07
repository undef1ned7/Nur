export function findLeadOnBoard(board, leadId) {
  if (!board) return null;
  for (const col of board.columns || []) {
    const found = (col.leads || []).find((l) => l.id === leadId);
    if (found) return found;
  }
  return (board.unassigned || []).find((l) => l.id === leadId) || null;
}

export function pluckLeadFromBoard(board, leadId) {
  if (!board) return { board, lead: null };
  const next = {
    ...board,
    columns: (board.columns || []).map((col) => ({
      ...col,
      leads: [...(col.leads || [])],
    })),
    unassigned: [...(board.unassigned || [])],
  };

  let removed = null;
  for (const col of next.columns) {
    const i = col.leads.findIndex((l) => l.id === leadId);
    if (i !== -1) {
      removed = col.leads.splice(i, 1)[0];
      return { board: next, lead: removed };
    }
  }
  const j = next.unassigned.findIndex((l) => l.id === leadId);
  if (j !== -1) removed = next.unassigned.splice(j, 1)[0];
  return { board: next, lead: removed };
}

export function placeLeadOnBoard(board, lead) {
  if (!board || !lead) return board;
  const next = {
    ...board,
    columns: (board.columns || []).map((col) => ({
      ...col,
      leads: [...(col.leads || [])],
    })),
    unassigned: [...(board.unassigned || [])],
  };

  const stageId = lead.stage;
  if (!stageId) {
    next.unassigned = [lead, ...next.unassigned];
    return next;
  }
  const col = next.columns.find((c) => c.stage?.id === stageId);
  if (col) {
    col.leads = [lead, ...col.leads];
  } else {
    next.unassigned = [lead, ...next.unassigned];
  }
  return next;
}

export function moveLeadOnBoard(board, leadId, toStageId) {
  const { board: without, lead } = pluckLeadFromBoard(board, leadId);
  if (!lead) return board;
  return placeLeadOnBoard(without, { ...lead, stage: toStageId || null });
}

export function upsertLeadOnBoard(board, lead) {
  if (!board || !lead) return board;
  const { board: without } = pluckLeadFromBoard(board, lead.id);
  return placeLeadOnBoard(without, lead);
}

export function removeLeadFromBoard(board, leadId) {
  const { board: next } = pluckLeadFromBoard(board, leadId);
  return next;
}
