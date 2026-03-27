/**
 * Valide qu'une variable d'environnement existe et retourne sa valeur.
 * Throw une erreur explicite si manquante.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}. Vérifiez .env ou le dashboard Trigger.dev.`);
  }
  return value;
}
