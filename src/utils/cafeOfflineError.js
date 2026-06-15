export function isOfflineNetworkError(err) {
  return (
    !err?.response &&
    (err?.code === "ERR_NETWORK" ||
      err?.code === "ECONNABORTED" ||
      err?.message === "Network Error" ||
      !navigator.onLine)
  );
}

export function suppressOfflineError(err) {
  if (isOfflineNetworkError(err)) {
    console.warn("Офлайн, операция в очереди");
    return true;
  }
  return false;
}
