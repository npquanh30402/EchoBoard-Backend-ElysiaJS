import { LRUCache } from "lru-cache";

const options = {
  max: 500,
  maxSize: 31457280, // 30MB
  ttl: 24 * 60 * 60 * 1000,

  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,

  sizeCalculation: (value: any, key: any) => {
    return 1;
  },
};

export const lruCache = new LRUCache(options);
