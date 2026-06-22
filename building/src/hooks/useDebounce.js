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

/**
 * Отдельный debounce-таймер на каждый ключ (например id строки корзины).
 * schedule(key, fn) перезапускает таймер только для этого key; cancel(key) снимает ожидание.
 */
export const useDebounceByKey = (delay = 400) => {
  const timersRef = useRef(new Map());

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const schedule = useCallback(
    (key, fn) => {
      const k = String(key);
      const prev = timersRef.current.get(k);
      if (prev) clearTimeout(prev);
      const id = setTimeout(() => {
        timersRef.current.delete(k);
        fn();
      }, delay);
      timersRef.current.set(k, id);
    },
    [delay],
  );

  const cancel = useCallback((key) => {
    const k = String(key);
    const prev = timersRef.current.get(k);
    if (prev) {
      clearTimeout(prev);
      timersRef.current.delete(k);
    }
  }, []);

  return { schedule, cancel };
};
