import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCheckoutSession } from '../services/genai';
import { Zap, Sparkles, User, Calendar, CheckCircle2, ArrowRight, Menu, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'pt' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="bg-[#FAFAF9] h-screen overflow-y-auto custom-scrollbar font-sans text-[#1A1A1A]">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF9]/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="ContentSpark Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-bold tracking-tight">ContentSpark</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-[#1A1A1A] transition-colors">{t('landing.nav.features')}</a>
            <a href="#how-it-works" className="hover:text-[#1A1A1A] transition-colors">{t('landing.nav.how_it_works')}</a>
            <a href="#pricing" className="hover:text-[#1A1A1A] transition-colors">{t('landing.nav.pricing')}</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#1A1A1A] transition-colors"
              title={t('common.switch_language')}
            >
              <Globe size={16} />
              <span>{i18n.language === 'en' ? 'PT' : 'EN'}</span>
            </button>
            {!user && (
              <button
                onClick={() => navigate('/login')}
                className="hidden md:block text-sm font-bold text-gray-500 hover:text-[#1A1A1A] transition-colors"
              >
                Sign In
              </button>
            )}
            <Button
              onClick={() => user ? navigate('/app') : navigate('/login')}
              className="rounded-full font-bold shadow-sm bg-[#FFDA47] text-[#1A1A1A] hover:bg-[#FFC040] hover:scale-105 transition-all"
            >
              {user ? 'Dashboard' : 'Get Started Free'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">

          {/* Copy */}
          <div className="space-y-8 animate-fade-in z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-50 border border-yellow-100 text-yellow-700 text-xs font-bold uppercase tracking-wide">
              <Sparkles size={12} />
              <span>AI-Powered Strategy</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Stop Staring at a <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1A1A1A] to-gray-500">Blank Page.</span>
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed max-w-lg">
              The only AI Content Generator that reads your audience's mind. Define your <span className="text-[#1A1A1A] font-bold">Target Persona</span>, and get hyper-relevant post ideas, captions, and hooks instantly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => user ? navigate('/app') : navigate('/login')}
                className="rounded-full text-base font-bold shadow-xl shadow-black/10 bg-[#1A1A1A] hover:bg-black hover:scale-105 transition-all text-white h-auto px-8 py-4"
              >
                {user ? 'Go to Dashboard' : 'Start Creating for Free'} <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold text-gray-400">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white"></div>
                <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white"></div>
                <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white"></div>
              </div>
              <span>Trusted by 1,000+ Creators</span>
            </div>
          </div>

          {/* Visual Mockup */}
          <div className="relative animate-scale-in delay-100 hidden lg:block">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FFDA47]/20 rounded-full blur-3xl -z-10"></div>

            {/* Tilted Card */}
            <div className="relative transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="bg-white rounded-[32px] p-6 shadow-2xl border border-gray-100 w-96 mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-[#FFDA47] text-[#1A1A1A] text-xs font-bold px-3 py-1 rounded-full">New Idea</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">5 Mistakes Vegans Make</h3>
                <p className="text-gray-400 text-sm mb-4">Hook: "You might be accidentally ruining your progress..."</p>
                <div className="space-y-2">
                  <div className="h-2 bg-gray-100 rounded w-full"></div>
                  <div className="h-2 bg-gray-100 rounded w-5/6"></div>
                  <div className="h-2 bg-gray-100 rounded w-4/6"></div>
                </div>
                <div className="mt-6 flex justify-between items-center">
                  <div className="flex gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">IG</span>
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">TT</span>
                  </div>
                  <Button size="icon" className="bg-[#1A1A1A] text-white rounded-full">
                    <Calendar size={14} />
                  </Button>
                </div>
              </div>

              {/* Floating Element */}
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 animate-[bounce_3s_infinite]">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full text-green-600">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1A1A1A]">Scheduled</p>
                    <p className="text-[10px] text-gray-400">Tomorrow, 9:00 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Why Us Section */}
      <section id="features" className="py-20 bg-white rounded-t-[48px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#1A1A1A] mb-4">Not Just Another AI Wrapper</h2>
            <p className="text-gray-500 max-w-xl mx-auto">We don't just vomit words. We build a strategy based on who you're actually talking to.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#FAFAF9] p-8 rounded-[32px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                <User size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-3">Persona-First Engine</h3>
              <p className="text-gray-500 leading-relaxed text-sm">
                Generic AI gives generic advice. We use your specific Audience Pains & Goals to craft content that actually converts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#FAFAF9] p-8 rounded-[32px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-12 h-12 bg-[#FFDA47] rounded-2xl flex items-center justify-center mb-6 text-[#1A1A1A]">
                <Sparkles size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-3">First Drafts, Done</h3>
              <p className="text-gray-500 leading-relaxed text-sm">
                Don't just get ideas. Get the full Caption, Viral Hook, CTA, and Hashtags ready to copy-paste immediately.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#FAFAF9] p-8 rounded-[32px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 text-purple-600">
                <Calendar size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-3">Visual Planning</h3>
              <p className="text-gray-500 leading-relaxed text-sm">
                Drag your favorite ideas onto a Google-style calendar to plan your entire month in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-[#FAFAF9]">
        <div className="max-w-7xl mx-auto px-6 space-y-24">

          {/* Step 1 */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="text-5xl font-extrabold text-[#E5E5E5]">01</div>
              <h3 className="text-3xl font-bold text-[#1A1A1A]">Build Your Strategy.</h3>
              <p className="text-gray-500 text-lg">Input your niche, tone, and define your audience's deepest pains and desires. The AI learns what makes them tick.</p>
            </div>
            <div className="flex-1 bg-white p-6 rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 rotate-2">
              <div className="space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <div className="bg-[#FFDA47] px-4 py-2 rounded-lg text-xs font-bold text-[#1A1A1A]">Pains</div>
                  <div className="bg-gray-100 px-4 py-2 rounded-lg text-xs font-bold text-gray-400">Goals</div>
                  <div className="bg-gray-100 px-4 py-2 rounded-lg text-xs font-bold text-gray-400">Questions</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl text-sm font-medium text-gray-600">
                  "I don't have time to cook healthy meals..."
                </div>
                <div className="bg-gray-50 p-4 rounded-xl text-sm font-medium text-gray-600">
                  "Confused about which protein powder to buy..."
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="text-5xl font-extrabold text-[#E5E5E5]">02</div>
              <h3 className="text-3xl font-bold text-[#1A1A1A]">Generate Magic.</h3>
              <p className="text-gray-500 text-lg">Click one button and watch as 6 unique, fully-fleshed out content ideas appear tailored to your persona.</p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-4 rounded-2xl shadow-md border border-gray-50">
                  <div className="w-8 h-2 bg-gray-200 rounded mb-2"></div>
                  <div className="w-full h-12 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="text-5xl font-extrabold text-[#E5E5E5]">03</div>
              <h3 className="text-3xl font-bold text-[#1A1A1A]">Plan & Post.</h3>
              <p className="text-gray-500 text-lg">Drag your winning ideas onto the calendar. Export, copy-paste, and watch your engagement grow.</p>
            </div>
            <div className="flex-1 bg-white p-4 rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 -rotate-2">
              <div className="grid grid-cols-7 gap-2">
                {[...Array(14)].map((_, i) => (
                  <div key={i} className={`aspect-square rounded-lg ${i === 4 || i === 9 ? 'bg-[#FFDA47]' : 'bg-gray-50'}`}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white rounded-t-[48px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#1A1A1A] mb-4">Simple Pricing</h2>
            <p className="text-gray-500">Start for free. Upgrade when you're famous.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <div className="bg-[#FAFAF9] p-8 rounded-[32px] border border-gray-100">
              <h3 className="text-xl font-bold text-[#1A1A1A]">Free</h3>
              <div className="text-4xl font-extrabold mt-4 mb-2">$0</div>
              <p className="text-gray-500 text-sm mb-6">Perfect to try the magic.</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm font-medium text-gray-700"><CheckCircle2 size={16} className="text-[#1A1A1A]" /> 10 Credits</li>
                <li className="flex items-center gap-2 text-sm font-medium text-gray-700"><CheckCircle2 size={16} className="text-[#1A1A1A]" /> Basic Persona</li>
              </ul>
              <Button
                onClick={() => user ? navigate('/app') : navigate('/login')}
                variant="outline"
                className="w-full py-6 rounded-xl border-2 border-[#1A1A1A] text-[#1A1A1A] font-bold hover:bg-[#1A1A1A] hover:text-white transition-colors"
              >
                {user ? 'Go to Dashboard' : 'Start Free'}
              </Button>
            </div>

            {/* Creator */}
            <div className="bg-[#1A1A1A] p-8 rounded-[32px] text-white relative transform md:-translate-y-4 shadow-2xl">
              <div className="absolute top-4 right-4 bg-[#FFDA47] text-[#1A1A1A] text-xs font-bold px-2 py-1 rounded">POPULAR</div>
              <h3 className="text-xl font-bold">Creator</h3>
              <div className="text-4xl font-extrabold mt-4 mb-2 text-[#FFDA47]">$12<span className="text-base font-medium text-gray-400">/mo</span></div>
              <p className="text-gray-400 text-sm mb-6">For consistent posting.</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={16} className="text-[#FFDA47]" /> 100 Credits / mo</li>
                <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={16} className="text-[#FFDA47]" /> Advanced Persona</li>
                <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={16} className="text-[#FFDA47]" /> Calendar Export</li>
              </ul>
              <Button
                onClick={async () => {
                  if (user) {
                    try {
                      // Replace with actual Stripe Price ID
                      const res = await createCheckoutSession('price_1Q...', user.id, user.email);
                      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
                    } catch (e) {
                      alert("Checkout failed. Please try again.");
                    }
                  } else {
                    navigate('/login');
                  }
                }}
                className="w-full py-6 rounded-xl bg-[#FFDA47] text-[#1A1A1A] font-bold hover:bg-[#FFC040] transition-colors"
                variant="default"
              >
                {user ? 'Upgrade to Creator' : 'Get Started'}
              </Button>
            </div>

            {/* Pro */}
            <div className="bg-[#FAFAF9] p-8 rounded-[32px] border border-gray-100">
              <h3 className="text-xl font-bold text-[#1A1A1A]">Pro</h3>
              <div className="text-4xl font-extrabold mt-4 mb-2">$39<span className="text-base font-medium text-gray-500">/mo</span></div>
              <p className="text-gray-500 text-sm mb-6">For Agencies & Power Users.</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm font-medium text-gray-700"><CheckCircle2 size={16} className="text-[#1A1A1A]" /> 1,000 Credits / mo</li>
                <li className="flex items-center gap-2 text-sm font-medium text-gray-700"><CheckCircle2 size={16} className="text-[#1A1A1A]" /> Multiple Personas</li>
              </ul>
              <Button onClick={() => navigate('/login')} variant="outline" className="w-full py-6 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors">Contact Sales</Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#FFDA47] py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1A1A1A]">Ready to explode your engagement?</h2>
          <Button
            onClick={() => user ? navigate('/app') : navigate('/login')}
            className="bg-white text-[#1A1A1A] px-10 py-6 h-auto rounded-full text-lg font-bold hover:scale-105 transition-transform shadow-xl hover:bg-white/90"
          >
            {user ? 'Go to Dashboard' : 'Create My Free Account'}
          </Button>
          <p className="text-[#1A1A1A]/60 text-sm font-medium">No credit card required for free tier.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="ContentSpark Logo" className="w-6 h-6 rounded-lg" />
            <span className="font-bold tracking-tight">ContentSpark</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
          <div className="text-sm text-gray-600">
            © 2025 ContentSpark. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
