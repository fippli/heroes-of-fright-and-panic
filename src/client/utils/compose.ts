export const compose =
  <T>(...fns: ((x: T) => T)[]) =>
  (x: T) =>
    fns.reduce((acc, fn) => fn(acc), x as T);
