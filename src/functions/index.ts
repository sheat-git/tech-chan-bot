export function notNull<T>(item: T | null): item is T {
    return item !== null;
}
export const sleep = (msec: number) => new Promise(resolve => setTimeout(resolve, msec));
