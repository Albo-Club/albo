/**
 * Step: Store Matches
 *
 * Appelle la RPC upsert_email_matches_with_content
 * pour insérer/mettre à jour les matchs en batch.
 *
 * Chunke les matchs par groupes de CHUNK_SIZE pour éviter
 * les payloads trop gros (body_html + body_plain = lourd).
 *
 * Sanitize les bodies avant envoi (null bytes, troncature)
 * pour éviter "Empty or invalid json" côté PostgreSQL.
 */

import { supabase } from "../../lib/supabase.js";
import type { EmailMatch } from "./match-emails.js";

interface UpsertResult {
  matchesProcessed: number;
  contentSaved: number;
}

/** Max matchs par appel RPC — garde le payload sous ~4 MB */
const CHUNK_SIZE = 25;

/** Max chars par body — PostgreSQL JSONB a une limite pratique */
const MAX_BODY_LENGTH = 100_000;

/**
 * Supprime les caractères qui cassent le JSON PostgreSQL :
 * - null bytes (\u0000) rejetés par JSONB
 * - tronque les bodies trop longs
 */
function sanitizeBody(text: string | null): string | null {
  if (!text) return null;
  // eslint-disable-next-line no-control-regex
  let clean = text.replace(/\u0000/g, "");
  if (clean.length > MAX_BODY_LENGTH) {
    clean = clean.substring(0, MAX_BODY_LENGTH);
  }
  return clean;
}

function sanitizeMatch(match: EmailMatch): EmailMatch {
  return {
    ...match,
    body_html: sanitizeBody(match.body_html),
    body_plain: sanitizeBody(match.body_plain),
  };
}

export async function storeMatches(matches: EmailMatch[]): Promise<UpsertResult> {
  if (matches.length === 0) {
    return { matchesProcessed: 0, contentSaved: 0 };
  }

  let totalProcessed = 0;
  let totalContent = 0;

  for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
    const chunk = matches.slice(i, i + CHUNK_SIZE).map(sanitizeMatch);

    const { data, error } = await supabase.rpc("upsert_email_matches_with_content", {
      p_matches: chunk,
    });

    if (error) {
      throw new Error(
        `upsert_email_matches_with_content failed (chunk ${Math.floor(i / CHUNK_SIZE) + 1}, ${chunk.length} items): ${error.message}`
      );
    }

    const result = data as { matches_processed?: number; content_saved?: number } | null;
    totalProcessed += result?.matches_processed ?? chunk.length;
    totalContent += result?.content_saved ?? 0;
  }

  return {
    matchesProcessed: totalProcessed,
    contentSaved: totalContent,
  };
}
