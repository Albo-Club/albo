import { supabase } from '@/integrations/supabase/client';

const PORTFOLIO_PRIMARY_BUCKET = 'portfolio-documents';
const PORTFOLIO_FALLBACK_BUCKET = 'report-files';

function getBucketOrder(sourceBucket?: string | null) {
  const primaryBucket = sourceBucket || PORTFOLIO_PRIMARY_BUCKET;
  const fallbackBucket = primaryBucket === PORTFOLIO_PRIMARY_BUCKET
    ? PORTFOLIO_FALLBACK_BUCKET
    : PORTFOLIO_PRIMARY_BUCKET;

  return [primaryBucket, fallbackBucket];
}

export async function downloadFromPortfolioStorage(storagePath: string, sourceBucket?: string | null) {
  const buckets = getBucketOrder(sourceBucket);

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (!error && data) {
      return { data, bucket };
    }
  }

  throw new Error('Fichier introuvable dans le storage');
}

export async function getPortfolioSignedUrl(storagePath: string, sourceBucket?: string | null, expiresIn = 3600) {
  const buckets = getBucketOrder(sourceBucket);

  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
    if (!error && data?.signedUrl) {
      return { signedUrl: data.signedUrl, bucket };
    }
  }

  throw new Error('Impossible de générer l\'URL de preview');
}

export async function removeFromPortfolioStorage(storagePath: string, sourceBucket?: string | null) {
  const buckets = getBucketOrder(sourceBucket);
  let lastError: unknown = null;

  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    if (!error) {
      return { bucket };
    }
    lastError = error;
  }

  throw lastError instanceof Error ? lastError : new Error('Impossible de supprimer le fichier du storage');
}
