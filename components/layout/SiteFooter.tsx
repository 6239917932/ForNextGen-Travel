import Link from 'next/link';

import { MandyalLogo } from '@/components/brand/MandyalLogo';
import { FooterNewsletterForm } from '@/components/footer/FooterNewsletterForm';
import { PaymentMarks, SecureWebsiteMark } from '@/components/footer/PaymentMarks';
import { siteConfig } from '@/config/site';

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand-column">
          <Link aria-label="Mandyal Travels home" className="site-footer__logo" href="/">
            <MandyalLogo appearance="inverse" eager showTagline />
          </Link>
          <p className="site-footer__description">{siteConfig.description}</p>
          <p className="site-footer__origin">
            Legal business name: {siteConfig.legalName}.
            <br />
            Registered office: {siteConfig.registeredOffice.lines.join(', ')}.
          </p>
        </div>

        <div>
          <p className="site-footer__heading">Company</p>
          <nav aria-label="Company information" className="site-footer__links">
            <Link href="/about">About us</Link>
            <a href={siteConfig.group.href}>Explore {siteConfig.group.name}</a>
            <a href={siteConfig.group.travelDirectoryHref}>Travel in the Group portfolio</a>
            <Link href="/contact">Contact us and office locations</Link>
            <Link href="/login#business">Business travel workspace</Link>
            <Link href="/login#partner">Hotel partner workspace</Link>
          </nav>
        </div>

        <div>
          <p className="site-footer__heading">Travel services</p>
          <nav aria-label="Travel services" className="site-footer__links">
            {siteConfig.footerNavigation.map((item) => (
              <Link href={item.href} key={`${item.href}-${item.label}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="site-footer__heading">Partners and policies</p>
          <nav aria-label="Partner and legal navigation" className="site-footer__links">
            <Link href="/partners/apply">Partner registration</Link>
            <Link href="/login?portal=partner&amp;returnTo=/partner">Partner login</Link>
            <Link href="/register?account=business">Register your business</Link>
            <Link href="/login?portal=corporate">Corporate login</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/cancellation-refunds">Cancellation &amp; refunds</Link>
            <Link href="/pricing">How pricing works</Link>
          </nav>
        </div>

        <div className="site-footer__updates">
          <p className="site-footer__heading">Stay informed</p>
          <FooterNewsletterForm />
          <div className="site-footer__contacts" aria-label="Customer support">
            <a href={`tel:${siteConfig.supportPhone.href}`}>{siteConfig.supportPhone.display}</a>
            <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>
            <a href="https://wa.me/918069377940" rel="noreferrer" target="_blank">
              Chat on WhatsApp
            </a>
            <a href={siteConfig.socialLinks.facebook} rel="noreferrer" target="_blank">
              Follow us on Facebook
            </a>
          </div>
        </div>
      </div>

      <div className="site-footer__trust" aria-label="Payment and website security information">
        <div className="site-footer__trust-inner">
          <SecureWebsiteMark />
          <div>
            <p>Payment methods</p>
            <PaymentMarks />
          </div>
          <small>
            Payment methods depend on the active provider and are shown before confirmation. Never
            share card details or one-time codes with support staff.
          </small>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>
          © {currentYear} {siteConfig.legalName}. All rights reserved.
        </p>
        <nav aria-label="Footer policy shortcuts">
          <Link href="/legal/cookies">Cookie notice</Link>
          <Link href="/legal">Policy center</Link>
        </nav>
      </div>
    </footer>
  );
}
