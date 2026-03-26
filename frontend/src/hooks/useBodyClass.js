import { useEffect } from 'react';

export function useBodyClass(className) {
  useEffect(() => {
    if (!className) return undefined;
    const { classList } = document.body;
    classList.add(className);
    return () => {
      classList.remove(className);
    };
  }, [className]);
}
