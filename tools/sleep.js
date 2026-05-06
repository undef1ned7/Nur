const sleep = (ms = 0) =>
  new Promise((resolve) => {
    const timeout = Number.isFinite(Number(ms)) ? Number(ms) : 0;
    setTimeout(resolve, Math.max(0, timeout));
  });

export default sleep;
