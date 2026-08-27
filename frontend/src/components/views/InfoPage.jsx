import React from 'react';

const sections = [
  {
    title: 'Security Architecture',
    body: 'SyncVeil uses short-lived JWT access tokens, refresh-token session validation, Argon2 password hashing, and adaptive sign-in risk analysis to protect every account.',
  },
  {
    title: 'Encrypted Vault',
    body: 'Files uploaded to the vault are encrypted with AES-GCM before storage. Metadata shown in your dashboard is derived from encrypted storage records, not plain file content.',
  },
  {
    title: 'Adaptive Risk Detection',
    body: 'The backend continuously scores suspicious login behavior using offline signals such as unusual IP changes, new device fingerprints, and failed-attempt bursts. High-risk sign-ins require step-up verification.',
  },
  {
    title: 'Automatic Remediation',
    body: 'When suspicious behavior is detected, SyncVeil can trigger challenge verification, apply temporary lockouts, and revoke expired or compromised sessions automatically.',
  },
];

export default function InfoPage({ onSwitchView }) {
  return (
    <div id="view-info" className="view-section active">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => onSwitchView('home')}
          className="mb-8 text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <h1 id="info-title" className="text-4xl font-bold text-slate-900 mb-4">Platform Security</h1>
        <p className="text-slate-600 mb-10">A transparent overview of how SyncVeil secures your account and data end-to-end.</p>

        <div id="info-content" className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="p-6 bg-white border border-slate-200 rounded-2xl">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{section.title}</h2>
              <p className="text-slate-600 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
