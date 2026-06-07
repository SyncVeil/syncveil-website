import React, { useEffect, useState } from 'react';
import BreachMap from '../BreachMap';
import NewsSection from '../NewsSection';

export default function Home({ onSwitchView }) {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Initialize map when component mounts
    setMapReady(true);
  }, []);

  return (
    <div id="view-home" className="view-section active">
      {/* HERO SECTION */}
      <div className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden" style={{paddingTop:"clamp(80px,10vw,9rem)",paddingBottom:"clamp(40px,5vw,6rem)"}}>
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-bl from-indigo-50 via-teal-50 to-white opacity-60 rounded-bl-[100px]"></div>
        <div className="absolute bottom-0 left-0 -z-10 w-96 h-96 bg-rose-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-xs font-semibold text-slate-700">
                <span className="flex h-2 w-2 rounded-full bg-green-600"></span>
                Privacy is a right, not a privilege
              </div>

              <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 leading-tight" style={{fontSize:"clamp(2rem,6vw,3.75rem)"}}>
                Privacy that <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-teal-500">Empowers</span>
              </h1>

              <p className="text-xl text-slate-600 leading-relaxed max-w-lg" style={{fontSize:"clamp(1rem,2.5vw,1.25rem)"}}>
                SyncVeil gives you complete control over your digital footprint. Monitor, manage, and secure your data without compromising speed.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button 
                  onClick={() => onSwitchView('auth-choice')}
                  className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  Get Started
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById('features');
                    if(el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-8 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:border-indigo-200 hover:bg-indigo-50 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5v14"/>
                  </svg>
                  Learn More
                </button>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative animate-fade-in-right hidden lg:block">
              <div className="relative z-10 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 transform rotate-[-2deg] hover:rotate-0 transition-all duration-500 max-w-md mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-600">
                        <circle cx="12" cy="12" r="1"/><path d="M12 1C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 6 15.5 6 14 6.67 14 7.5s.67 1.5 1.5 1.5m-7 0c.83 0 1.5-.67 1.5-1.5S9.33 6 8.5 6 7 6.67 7 7.5 7.67 9 8.5 9m3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">SyncVeil Vault</p>
                      <p className="text-xs text-slate-500">Secured Account</p>
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">Active</div>
                </div>

                <div className="space-y-4">
                  <div className="h-28 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-indigo-100 to-transparent opacity-50"></div>
                    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 pb-2 h-full">
                      <div className="bar-h-40 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                      <div className="bar-h-70 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                      <div className="bar-h-45 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                      <div className="bar-h-90 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                      <div className="bar-h-60 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                      <div className="bar-h-80 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                      <div className="bar-h-50 w-1.5 bg-indigo-500 rounded-t-sm"></div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <div className="space-y-1">
                      <div className="h-1.5 w-20 bg-slate-200 rounded-full"></div>
                      <div className="h-1.5 w-12 bg-slate-100 rounded-full"></div>
                    </div>
                    <div className="h-6 w-16 bg-slate-900 rounded-lg"></div>
                  </div>
                </div>
              </div>

              <div className="absolute -top-8 -right-8 z-0 bg-white p-3 rounded-2xl shadow-xl border border-slate-100 animate-float">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <div className="absolute -bottom-4 -left-4 z-0 bg-indigo-600 text-white p-3 rounded-2xl shadow-xl border border-indigo-400 animate-float-delayed">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES SECTION */}
      <section id="features" className="relative py-20 lg:py-28 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6" style={{fontSize:"clamp(1.75rem,5vw,3rem)"}}>Core Features</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Everything you need to protect your data and maintain your privacy in today's digital world.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))"}}>
            {[
              {
                icon: '🔐',
                title: 'Encrypted Vault',
                description: 'Files are encrypted with AES-GCM before storage and tracked with integrity metadata.'
              },
              {
                icon: '🛡️',
                title: 'Adaptive Login Defense',
                description: 'Offline risk scoring detects unusual sign-in behavior such as device and network shifts.'
              },
              {
                icon: '👁️',
                title: 'Step-Up Verification',
                description: 'High-risk sign-ins are challenged automatically with one-time verification before access.'
              },
              {
                icon: '🔑',
                title: 'Secure Authentication',
                description: 'Argon2 password hashing plus validated JWT session controls on every protected request.'
              },
              {
                icon: '📊',
                title: 'Security Telemetry',
                description: 'Operational dashboard shows active sessions, failed attempts, risk levels, and mitigations.'
              },
              {
                icon: '🌐',
                title: 'Production Deployment',
                description: 'Render-ready architecture with SQL-backed auth, vault storage, and resilient backend APIs.'
              }
            ].map((feature, idx) => (
              <div key={idx} className="group p-8 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-300">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BREACH MAP SECTION */}
      <section id="news-section" className="relative py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6">Security Operations Telemetry</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">Live platform activity generated from backend protection events.</p>
          </div>
          
          {mapReady && <BreachMap />}
        </div>
      </section>

      {/* NEWS SECTION */}
      <NewsSection />

      {/* CTA SECTION */}
      <section className="relative py-20 lg:py-28 bg-gradient-to-r from-indigo-600 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-6" style={{fontSize:"clamp(1.75rem,5vw,3rem)"}}>Ready to Take Control?</h2>
          <p className="text-xl text-indigo-100 mb-8">Start protecting your digital life today. SyncVeil makes security effortless.</p>
          <button 
            onClick={() => onSwitchView('auth-choice')}
            className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-bold shadow-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-2"
          >
            Get Started Free
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5v14"/>
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
