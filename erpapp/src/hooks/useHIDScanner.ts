import { useEffect, useRef } from 'react';
import KeyEvent from 'react-native-keyevent';

export const useHIDScanner = (onScan: (data: string) => void) => {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedRef = useRef<{tag: string, time: number}>({ tag: '', time: 0 });

  useEffect(() => {
    // Optional: if the scanner is inactive for a bit, submit the buffer in case it doesn't send an Enter key
    const resetBufferTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const result = bufferRef.current.trim();
        if (result.length > 0) {
          const now = Date.now();
          if (lastScannedRef.current.tag !== result || (now - lastScannedRef.current.time) > 1500) {
            onScan(result);
            lastScannedRef.current = { tag: result, time: now };
          }
        }
        bufferRef.current = '';
      }, 500); // submit buffer if no keystrokes for 500ms
    };

    KeyEvent.onKeyDownListener((keyEvent: { keyCode: number, pressedKey: string }) => {
      // keyCode 66 is Enter, 160 is Numpad Enter on some Android devices
      if (keyEvent.keyCode === 66 || keyEvent.keyCode === 160 || keyEvent.pressedKey === '\n' || keyEvent.pressedKey === '\r') {
        const result = bufferRef.current.trim();
        if (result.length > 0) {
          // Deduplicate scans: ignore if the same tag was scanned within the last 1500ms
          const now = Date.now();
          if (lastScannedRef.current.tag !== result || (now - lastScannedRef.current.time) > 1500) {
            onScan(result);
            lastScannedRef.current = { tag: result, time: now };
          }
          bufferRef.current = ''; // clear buffer
        }
      } else {
        // Filter out control characters, but capture valid characters
        if (keyEvent.pressedKey && keyEvent.pressedKey.length === 1 && !keyEvent.pressedKey.match(/[\x00-\x1F\x7F]/)) {
          bufferRef.current += keyEvent.pressedKey;
          resetBufferTimeout();
        }
      }
    });

    return () => {
      KeyEvent.removeKeyDownListener();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onScan]);
};
