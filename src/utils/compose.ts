export const compose =
  (...fns: Function[]) =>
  (x: any) =>
    fns.reduce((acc, fn) => fn(acc), x);
