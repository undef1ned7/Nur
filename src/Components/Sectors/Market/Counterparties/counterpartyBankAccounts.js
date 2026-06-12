export const emptyBankAccountRow = () => ({ id: "", score: "", bik: "" });

export const bankAccountsFromCounterparty = (counterparty) => {
  const list = Array.isArray(counterparty?.bank_accounts)
    ? counterparty.bank_accounts
    : [];
  if (list.length) {
    return list.map((item) => ({
      id: item?.id ?? "",
      score: item?.score ?? "",
      bik: item?.bik ?? "",
    }));
  }

  const score = String(counterparty?.score ?? "").trim();
  const bik = String(counterparty?.bik ?? "").trim();
  if (score || bik) {
    return [{ id: "", score, bik }];
  }

  return [emptyBankAccountRow()];
};

export const validateBankAccounts = (rows) => {
  for (const row of rows || []) {
    const score = String(row?.score ?? "").trim();
    const bik = String(row?.bik ?? "").trim();
    if ((score && !bik) || (!score && bik)) {
      return "Р/С и БИК должны указываться вместе";
    }
  }
  return null;
};

export const buildBankAccountsPayload = (rows) =>
  (rows || [])
    .map((row) => ({
      score: String(row?.score ?? "").trim(),
      bik: String(row?.bik ?? "").trim(),
    }))
    .filter((row) => row.score && row.bik);
