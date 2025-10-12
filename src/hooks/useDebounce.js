import { useRef } from "react";

export const useDebounce = (callback, delay = 1000) => {
  const timer = useRef();

  return (arg) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      callback(arg);
    }, delay);
  };
};
