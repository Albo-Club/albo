const Privacy = () => (
  <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#fafafa", color: "#1a1a1a", lineHeight: 1.7, minHeight: "100vh" }}>
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
      <a href="https://app.alboteam.com" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#000", textDecoration: "none", display: "inline-block", marginBottom: 48 }}>Albo</a>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8, color: "#000" }}>Politique de Confidentialité</h1>
      <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: 40 }}>Dernière mise à jour : 23 février 2026</p>

      <p>La présente politique de confidentialité décrit comment Albo (« nous », « notre », « nos ») collecte, utilise et protège vos données personnelles lorsque vous utilisez notre plateforme de gestion d'investissement pour Business Angels, accessible à l'adresse <a href="https://app.alboteam.com">app.alboteam.com</a> (le « Service »).</p>
      <p>Nous nous engageons à protéger votre vie privée conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi française Informatique et Libertés.</p>

      <h2>1. Responsable du traitement</h2>
      <p>Le responsable du traitement des données est :</p>
      <p>Albo<br />Email : <a href="mailto:mael@alboteam.com">mael@alboteam.com</a><br />Site : <a href="https://app.alboteam.com">app.alboteam.com</a></p>

      <h2>2. Données collectées</h2>
      <p>Nous collectons les catégories de données suivantes :</p>
      <ul>
        <li><strong>Données d'identification</strong> : nom, prénom, adresse email, photo de profil (via Google OAuth).</li>
        <li><strong>Données professionnelles</strong> : fonction, organisation, secteur d'activité, préférences d'investissement.</li>
        <li><strong>Données d'utilisation</strong> : interactions avec la plateforme, historique de navigation dans l'application, préférences.</li>
        <li><strong>Données de communication</strong> : emails synchronisés via les intégrations autorisées (Unipile), métadonnées d'emails (expéditeur, destinataire, objet, date).</li>
        <li><strong>Documents</strong> : pitch decks, rapports de portfolio et documents téléversés par l'utilisateur ou reçus par email.</li>
        <li><strong>Données techniques</strong> : adresse IP, type de navigateur, système d'exploitation, données de connexion.</li>
      </ul>

      <h2>3. Finalités et bases légales du traitement</h2>
      <p>Vos données sont traitées pour les finalités suivantes :</p>
      <ul>
        <li><strong>Exécution du contrat</strong> : gestion de votre compte, fourniture du Service, analyse de pitch decks et rapports, suivi de portfolio.</li>
        <li><strong>Consentement</strong> : synchronisation de vos emails, envoi de notifications, connexion de comptes tiers.</li>
        <li><strong>Intérêt légitime</strong> : amélioration du Service, analyse d'usage agrégée, détection de fraude et sécurité.</li>
        <li><strong>Obligation légale</strong> : conservation de données requises par la réglementation applicable.</li>
      </ul>

      <h2>4. Partage des données</h2>
      <p>Vos données personnelles peuvent être partagées avec :</p>
      <ul>
        <li><strong>Membres de votre workspace</strong> : les données liées aux deals et au portfolio sont partagées au sein de votre espace de travail, selon les rôles et permissions configurés.</li>
        <li><strong>Sous-traitants techniques</strong> : nous utilisons des prestataires pour l'hébergement et le fonctionnement du Service, notamment Supabase (base de données, hébergement UE), Vercel (hébergement frontend), Unipile (synchronisation email), et des services d'intelligence artificielle pour l'analyse de documents.</li>
      </ul>
      <p>Nous ne vendons jamais vos données personnelles à des tiers. Nous ne partageons vos données qu'avec les prestataires nécessaires au fonctionnement du Service, dans le cadre de contrats conformes au RGPD.</p>

      <h2>5. Transferts internationaux</h2>
      <p>Certains de nos sous-traitants peuvent être situés en dehors de l'Espace Économique Européen. Dans ce cas, nous nous assurons que des garanties appropriées sont en place (clauses contractuelles types de la Commission européenne, décisions d'adéquation) conformément aux articles 46 et 49 du RGPD.</p>

      <h2>6. Durée de conservation</h2>
      <p>Vos données sont conservées pendant la durée de votre utilisation du Service, puis :</p>
      <ul>
        <li><strong>Données de compte</strong> : supprimées dans les 30 jours suivant la suppression de votre compte.</li>
        <li><strong>Documents et analyses</strong> : conservés tant que votre compte est actif, supprimés sur demande.</li>
        <li><strong>Données de connexion et logs</strong> : conservés 12 mois maximum.</li>
        <li><strong>Données de facturation</strong> : conservées conformément aux obligations légales (10 ans).</li>
      </ul>

      <h2>7. Sécurité des données</h2>
      <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :</p>
      <ul>
        <li>Chiffrement des données en transit (TLS/SSL) et au repos.</li>
        <li>Contrôle d'accès basé sur les rôles (Row Level Security).</li>
        <li>Authentification sécurisée (OAuth 2.0, tokens chiffrés).</li>
        <li>Isolation des données entre workspaces.</li>
        <li>Sauvegardes régulières et plan de continuité.</li>
      </ul>

      <h2>8. Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles.</li>
        <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes.</li>
        <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données.</li>
        <li><strong>Droit à la limitation</strong> : restreindre le traitement de vos données.</li>
        <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré et lisible.</li>
        <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos données.</li>
        <li><strong>Droit de retirer votre consentement</strong> : à tout moment, sans affecter la licéité du traitement antérieur.</li>
      </ul>
      <p>Pour exercer ces droits, contactez-nous à <a href="mailto:mael@alboteam.com">mael@alboteam.com</a>. Nous répondrons dans un délai de 30 jours.</p>
      <p>Vous avez également le droit d'introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr">www.cnil.fr</a>).</p>

      <h2>9. Cookies</h2>
      <p>Notre Service utilise des cookies strictement nécessaires au fonctionnement de l'application (authentification, préférences de session). Nous n'utilisons pas de cookies publicitaires ni de trackers tiers à des fins marketing.</p>

      <h2>10. Intelligence artificielle</h2>
      <p>Notre Service utilise des technologies d'intelligence artificielle pour analyser les documents (pitch decks, rapports) et extraire des informations pertinentes. Ces analyses sont réalisées de manière automatisée mais ne font l'objet d'aucune décision entièrement automatisée ayant un effet juridique ou significatif sur vous. Vous pouvez demander une intervention humaine à tout moment.</p>

      <h2>11. Modifications</h2>
      <p>Nous nous réservons le droit de modifier cette politique de confidentialité. En cas de modification substantielle, nous vous en informerons par email ou via une notification dans l'application. La date de dernière mise à jour est indiquée en haut de cette page.</p>

      <h2>12. Contact</h2>
      <p>Pour toute question relative à cette politique de confidentialité ou au traitement de vos données, contactez-nous :</p>
      <p>Email : <a href="mailto:mael@alboteam.com">mael@alboteam.com</a></p>

      <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid #e0e0e0", fontSize: "0.875rem", color: "#666" }}>
        <p>© 2026 Albo. Tous droits réservés.</p>
      </div>
    </div>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
      .privacy-page p, .privacy-page li { font-size: 0.975rem; color: #333; margin-bottom: 12px; }
      .privacy-page ul { padding-left: 24px; margin-bottom: 16px; }
      .privacy-page li { margin-bottom: 6px; }
      .privacy-page a { color: #000; text-decoration: underline; }
      .privacy-page h2 { font-size: 1.25rem; font-weight: 700; margin-top: 40px; margin-bottom: 12px; color: #000; }
    `}</style>
  </div>
);

export default Privacy;
