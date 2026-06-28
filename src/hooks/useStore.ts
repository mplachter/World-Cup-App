import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../types';

export function useStore<T>(store: Store<T>): T {
  const [value, setValue] = useState<T>(store.get());
  useEffect(() => {
    setValue(store.get());
    return store.sub(setValue);
  }, [store]);
  return value;
}
