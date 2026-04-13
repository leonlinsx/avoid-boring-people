const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

export const sanitizeJsonLd = (value: unknown): unknown => {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeJsonLd(item))
      .filter((item) => item !== undefined);
    return sanitizedItems;
  }

  if (isPlainObject(value)) {
    const sanitizedObject = Object.entries(value).reduce<Record<string, unknown>>(
      (acc, [key, nestedValue]) => {
        const sanitizedValue = sanitizeJsonLd(nestedValue);
        if (sanitizedValue !== undefined) {
          acc[key] = sanitizedValue;
        }
        return acc;
      },
      {},
    );

    return sanitizedObject;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return undefined;
};
