import { useEffect } from 'react';

export function useBodyClass(className) { // Toggle a body class for page-level styling.
  useEffect(() => {
    if (!className) return undefined;
    const { classList } = document.body;
    classList.add(className);
    return () => {
      classList.remove(className);
    };
  }, [className]);
}

