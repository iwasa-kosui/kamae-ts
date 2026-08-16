type Driver = Readonly<{
  id: string;
  availability: "Available" | "Busy";
}>;

const foundFirstAvailable = Symbol("foundFirstAvailable");

const isFoundFirstAvailable = (
  error: unknown,
): error is typeof foundFirstAvailable => error === foundFirstAvailable;

export const findFirstAvailable = (
  drivers: readonly Driver[],
): Driver | undefined => {
  let firstAvailable: Driver | undefined;

  const visit = (remaining: readonly Driver[]): void => {
    const [driver, ...rest] = remaining;
    if (driver === undefined) return;

    if (driver.availability === "Available") {
      firstAvailable = driver;
      throw foundFirstAvailable;
    }

    visit(rest);
  };

  try {
    visit(drivers);
    return undefined;
  } catch (error: unknown) {
    if (isFoundFirstAvailable(error)) return firstAvailable;
    throw error;
  }
};
