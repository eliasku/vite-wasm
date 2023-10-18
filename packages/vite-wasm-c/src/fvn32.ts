export const fvn32 = (value: string, hash = 0x811C9DC5): number => {
    for (let i = 0; i < value.length; ++i) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
};