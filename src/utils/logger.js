export default function logger(log, message) {
    if (process.env.NODE_ENV !== 'development') return;
    log(message)
}