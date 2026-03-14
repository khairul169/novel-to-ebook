type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}.${P}`
    : never
  : never;

type Prev = [never, 0, 1, 2, 3, 4, 5];

export type Paths<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T & string]:
          | K
          | (Paths<T[K], Prev[D]> extends infer R
              ? R extends string
                ? Join<K, R>
                : never
              : never);
      }[keyof T & string]
    : never;

type Split<S extends string> = S extends `${infer A}.${infer B}`
  ? [A, ...Split<B>]
  : [S];

type ValueAtPath<T, P extends readonly string[]> = P extends [
  infer K,
  ...infer R,
]
  ? K extends keyof NonNullable<T>
    ? R extends string[]
      ? ValueAtPath<NonNullable<T>[K], R>
      : NonNullable<T>[K]
    : never
  : T;

export type PathValue<T, P extends string> = ValueAtPath<T, Split<P>>;
