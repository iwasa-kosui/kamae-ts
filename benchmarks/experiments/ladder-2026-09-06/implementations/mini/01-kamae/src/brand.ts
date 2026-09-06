export type Brand<TValue, TBrand extends symbol> = TValue & {
  readonly [key in TBrand]: true;
};

export const brandString = <TBrand extends symbol>(
  value: string,
): Brand<string, TBrand> => value as Brand<string, TBrand>;

export const brandNumber = <TBrand extends symbol>(
  value: number,
): Brand<number, TBrand> => value as Brand<number, TBrand>;
