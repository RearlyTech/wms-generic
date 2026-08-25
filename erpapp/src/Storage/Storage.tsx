import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();
export const setItem = (key: string, value: string) => storage.set(key, value);
export const getItem = (key: string): string | undefined => storage.getString(key);
export const removeItem = (key: string) => storage.delete(key);
export const clearAllItems = () => storage.clearAll();