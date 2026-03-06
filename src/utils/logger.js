export default function logger(log, ...message) {
  if (process.env.NODE_ENV !== "development") return;
  log(...message);
}

export const info = (...message) => {
  logger(console.log, ...message);
};

export const error = (...message) => {
  logger(console.error, ...message);
};
