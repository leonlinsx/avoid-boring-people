export const titleCase = (s: string) =>
  (s ?? "").toString().replace(
    /\w\S*/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );

export const normalizeCategory = (s: string) =>
  (s ?? "").toString().trim().toLowerCase();
