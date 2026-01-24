import { useState, useEffect, useCallback, useRef } from "react";
import { listen, emit, EventCallback } from "@tauri-apps/api/event";
import { isTauri } from "./utils";

/**
 * Хук для работы с localStorage с типизацией и синхронизацией
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

/**
 * Хук для безопасной подписки на события Tauri с автоматической очисткой
 */
export function useTauriEvent<T>(eventName: string, callback: (payload: T) => void, deps: any[] = []) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const unlistenFn = await listen<T>(eventName, (event) => {
        callbackRef.current(event.payload);
      });
      unlisten = unlistenFn;
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}

/**
 * Хук для удобной отправки событий Tauri
 */
export function useTauriEmit() {
  return useCallback(async (eventName: string, payload?: any) => {
    if (isTauri()) {
      await emit(eventName, payload);
    }
  }, []);
}
