export function getErrorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;

  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;

  if (Array.isArray(data)) {
    const msg = data.filter((item) => typeof item === 'string' && item.trim()).join(', ');
    if (msg) return msg;
  }

  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}

