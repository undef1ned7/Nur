import { useCallback, useEffect, useRef, useState } from "react";
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


export const useDebouncedValue = (value, delay = 400, callback) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
      callback?.()
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
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
