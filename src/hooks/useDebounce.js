import { useCallback, useRef } from "react";
import { useDispatch } from "react-redux";

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

export const useDebouncedAction = (
  actionCreator,
  delay = 600,
  transform = (e) => e?.target?.value ?? e
) => {
  const dispatch = useDispatch();
  const debounced = useDebounce((v) => dispatch(actionCreator(v)), delay);

  return useCallback(
    (e) => {
      debounced(transform(e));
    },
    [debounced, transform]
  );
};
