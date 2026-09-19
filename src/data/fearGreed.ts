export type FearGreedData = {
  value: number;
  classification: string;
  source: 'live' | 'fallback';
  fetchedAt?: string;
};

type FngResponse = {
  data: { value: string; value_classification: string }[];
};

export async function loadFearGreed(): Promise<FearGreedData> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as FngResponse;
    const row = json.data?.[0];
    if (!row) throw new Error('empty');
    return {
      value: parseInt(row.value, 10),
      classification: row.value_classification,
      source: 'live',
    };
  } catch {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}data/fear-greed.json`);
    if (!res.ok) throw new Error('Fear & Greed unavailable');
    const json = (await res.json()) as FearGreedData & { fetchedAt?: string };
    return {
      value: json.value,
      classification: json.classification,
      source: 'fallback',
      fetchedAt: json.fetchedAt,
    };
  }
}
