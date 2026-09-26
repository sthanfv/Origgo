export const TEXTOS_LEGALES_ORIGGO_EN: Record<string, { titulo: string; subtitulo: string; badge: string; icono: string; html: string }> = {
  terminos: {
    titulo: 'Terms and Conditions of Use',
    subtitulo: 'Public Aggregation & Market Intelligence Terminal — Version v1.0 (September 2026)',
    badge: 'Intelligence & Aggregation Terminal',
    icono: 'fa-solid fa-file-contract',
    html: `<div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-server"></i> 1. Software Nature: Intelligence & Aggregation Terminal</div>
      <p>Origgo is algorithmic market monitoring, classification, and real estate intelligence software in Colombia. <strong>Origgo is not a real estate agency, broker, or exclusive listing repository</strong>. We do not represent buyers or sellers, hold keys, set prices, or participate in property walkthroughs, earnest deposits, or sales/rental deeds; our technological function is structuring open public data and connecting buyers directly with advertisers for direct deals.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-network-wired"></i> 2. Public Data Indexing & No Exclusivity</div>
      <p>Displayed listings and links originate from open public sources on the internet, aggregated via referential search algorithms. Origgo claims no exclusivity, commercial mandate, or legal ownership over referenced properties or public imagery.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 3. Analytical Query Credits & Instant Execution</div>
      <p>Each purchased credit enables analytical query and direct viewing of the advertiser's verified contact channel. Under Art. 47.1 of Colombian Consumer Law 1480/2011, accessing a contact constitutes an instantly and definitively executed digital service.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 4. Clear Pricing in Colombian Pesos (COP) & Wompi</div>
      <p>All prices in COP. Encrypted bank-level payments via Wompi Bancolombia (SFC regulated), with zero hidden fees or forced recurring charges.</p>
    </div>
    <div class="legal-section legal-history-box">
      <div class="legal-section-badge"><i class="fa-solid fa-clock-rotate-left"></i> 5. Version History & Legal Audit</div>
      <p>For evidentiary validity under Electronic Commerce regulations (Law 527/1999), terms are immutable. Active version: <strong>v1.0</strong>.</p>
    </div>`
  },
  exoneracion: {
    titulo: 'Due Diligence & Disclaimer',
    subtitulo: 'Essential recommendations for buyers and advertisers — Version v1.0 (September 2026)',
    badge: 'Due Diligence',
    icono: 'fa-solid fa-shield-halved',
    html: `<div class="legal-section legal-section-warning">
      <div class="legal-section-badge"><i class="fa-solid fa-circle-exclamation"></i> 1. Physical Inspection & Title Verification</div>
      <p>Always inspect the property in person, verify the owner identity, and obtain an official Title Certificate (Certificado de Tradición y Libertad) before transferring funds or signing agreements.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-scale-balanced"></i> 2. Neutral Software & Agreements Between Private Parties</div>
      <p>As neutral search and intelligence software, Origgo is not liable for latent defects, unilateral price changes, physical property condition, or private agreements between parties.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-copyright"></i> 3. Third-Party Trademarks & Intellectual Property</div>
      <p>Trademarks, names, or brand signs appearing incidentally on public source images belong to their respective owners. Origgo has no affiliation, partnership, or sponsorship with external portals or competitors.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-user-lock"></i> 4. Anti-Spam & Fair Use</div>
      <p>Access is strictly for legitimate personal or commercial direct-deal purposes. Automated mass data extraction (scraping), data resale, and spam/harassment to owners are strictly prohibited.</p>
    </div>`
  },
  privacidad: {
    titulo: 'Personal Data Processing Policy',
    subtitulo: 'Habeas Data Compliance (Law 1581/2012) — Version v1.0 (September 2026)',
    badge: 'Data Privacy (SIC)',
    icono: 'fa-solid fa-user-shield',
    html: `<div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-database"></i> 1. Purpose of Data Processing</div>
      <p>User phone and email are collected solely to: <strong>(i)</strong> safeguard unlock credits, <strong>(ii)</strong> issue purchase receipts and secure access links (Magic Link), and <strong>(iii)</strong> provide support. <strong>Zero data selling and zero spam</strong>.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. AES-256 Military-Grade Encryption</div>
      <p>Owner phone numbers are stored encrypted with AES-256-GCM. Browsing is protected with HTTPS/TLS and OWASP headers.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-id-card"></i> 3. Rights of Data Subjects (Habeas Data)</div>
      <p>Under Law 1581 of 2012, data subjects may request the update or removal of public contact details directly via platform self-service channels or official WhatsApp.</p>
    </div>
    <div class="legal-section legal-section-highlight">
      <div class="legal-section-badge"><i class="fa-solid fa-shield-cat"></i> 4. Listing Removal (Data Protection)</div>
      <p>If you are the owner (or their representative) and want a listing removed, use "Remove Property" in the Self-Support Center. Identify the listing by its link, the code shown in its spec sheet, the original listing link or the phone published on it, and give your name and an email. You will receive a filing number. If the listing is identified exactly, we hide it immediately while we review the request; we reply within 15 business days (Colombian Law 1581 of 2012, art. 15). Request data is used only to handle it.</p>
    </div>`
  },
  reembolsos: {
    titulo: 'Credit Balance Guarantee & PQR',
    subtitulo: 'Commercial & Consumer Protection Framework — Version v1.0 (September 2026)',
    badge: 'Guarantee & Reversal',
    icono: 'fa-solid fa-rotate-left',
    html: `<div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-shield-halved"></i> 1. Your Balance Never Expires</div>
      <p>Purchased credits do not expire. If you switch devices or clear cookies, restore them anytime using <strong>"Restore Account"</strong> with your WhatsApp.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-arrow-rotate-left"></i> 2. Right of Withdrawal & Payment Reversal</div>
      <p>For unconsumed credit packs, users may exercise withdrawal within 5 business days of purchase (Art. 47 Law 1480). For system errors or duplicate charges, payment reversal applies under Decree 587/2016.</p>
    </div>
    <div class="legal-section">
      <div class="legal-section-badge"><i class="fa-solid fa-headset"></i> 3. Petitions & Inquiries (PQR)</div>
      <p>For inquiries regarding balance transactions or Wompi payments, contact Origgo official WhatsApp with your payment reference. Business-day support under Colombian commercial regulations.</p>
    </div>`
  }
};
