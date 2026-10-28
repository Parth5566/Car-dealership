"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Heart,
  Menu,
  X,
  UserRound,
  ChevronDown,
  CarFront,
  GitCompareArrows,
  BadgePercent,
  Phone,
  Calculator,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Instagram,
} from "lucide-react";
import { useAuth } from "./providers";
import { Settings } from "@/lib/types";
import { resolveBusiness } from "@/lib/business";
import footerStyles from "./site-footer.module.css";
import { HomeHighlights } from "./home-highlights";
export function Logo({ name = "NCR Wheelz" }: { name?: string }) {
  return (
    <Link href="/" className="logo" aria-label={name + " home"}>
      <span className="logo-mark">
        {/* Same NW badge as the favicon; the link's aria-label names it. */}
        <img src="/images/logo-mark.webp" alt="" width={48} height={48} />
      </span>
      <span>
        {name === "NCR Wheelz" ? (
          <>
            NCR<span className="logo-light"> WHEELZ</span>
          </>
        ) : (
          name
        )}
        <small>DRIVE YOUR NEXT CHAPTER</small>
      </span>
    </Link>
  );
}
export function Header({ settings = {} }: { settings?: Partial<Settings> }) {
  const business = resolveBusiness(settings);
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const [menu, setMenu] = useState(false),
    [account, setAccount] = useState(false),
    [vehicles, setVehicles] = useState(false);
  const header = useRef<HTMLElement>(null);
  function closeMenus() {
    setMenu(false);
    setAccount(false);
    setVehicles(false);
  }
  useEffect(() => {
    closeMenus();
  }, [path]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) closeMenus();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <>
      <HomeHighlights />
      <header
        className="header"
        ref={header}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeMenus();
            (event.target as HTMLElement).blur();
          }
        }}
      >
        <div className="container nav">
          <Logo name={business.name} />
          <button
            className="mobile-toggle icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
            aria-expanded={menu}
            aria-controls="main-navigation"
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            className={menu ? "main-nav open" : "main-nav"}
            aria-label="Main navigation"
            id="main-navigation"
          >
            <Link
              href="/"
              className={path === "/" ? "active" : ""}
              aria-current={path === "/" ? "page" : undefined}
              onClick={closeMenus}
            >
              Home
            </Link>
            <div
              className="nav-vehicle-menu"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setVehicles(false);
              }}
            >
              <button
                className={
                  path.startsWith("/cars") ||
                  path.startsWith("/commercial") ||
                  path === "/car-valuation" ||
                  path === "/compare"
                    ? "nav-menu-trigger active"
                    : "nav-menu-trigger"
                }
                aria-expanded={vehicles}
                aria-controls="vehicle-navigation"
                onClick={() => {
                  setVehicles(!vehicles);
                  setAccount(false);
                }}
              >
                <CarFront size={19} /> Vehicles <ChevronDown size={15} />
              </button>
              {vehicles && (
                <div className="vehicle-dropdown" id="vehicle-navigation">
                  <Link href="/cars" onClick={closeMenus}>
                    <CarFront />
                    <span>
                      <strong>Passenger cars</strong>
                      <small>Find your everyday companion</small>
                    </span>
                  </Link>
                  <Link href="/commercial" onClick={closeMenus}>
                    <CarFront />
                    <span>
                      <strong>Commercial cabs</strong>
                      <small>Yellow-plate passenger cabs</small>
                    </span>
                  </Link>
                  <Link href="/compare" onClick={closeMenus}>
                    <GitCompareArrows />
                    <span>
                      <strong>Compare vehicles</strong>
                      <small>Pick 2–3. See the difference.</small>
                    </span>
                  </Link>
                  <Link href="/car-valuation" onClick={closeMenus}>
                    <Calculator />
                    <span>
                      <strong>Car valuation</strong>
                      <small>A price range before your next move</small>
                    </span>
                  </Link>
                </div>
              )}
            </div>
            {[
              ["/sell", "Sell a vehicle"],
              ["/emi-calculator", "EMI calculator"],
              ["/discounts", "Discounts"],
              ["/about", "About us"],
              ["/contact", "Contact us"],
            ].map(([href, title]) => (
              <Link
                className={
                  (href === "/" ? path === href : path.startsWith(href))
                    ? "active"
                    : ""
                }
                href={href}
                key={href}
                onClick={closeMenus}
                aria-current={path === href ? "page" : undefined}
              >
                {href === "/discounts" && <BadgePercent size={18} />}
                {href === "/emi-calculator" && <Calculator size={18} />}
                {title}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <Link
              href="/saved"
              className="icon-button saved-link"
              aria-label="Saved vehicles"
            >
              <Heart size={20} />
            </Link>
            <div
              className="account-menu"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setAccount(false);
              }}
            >
              <button
                className="account-button"
                aria-label="Account menu"
                onClick={() => {
                  setAccount(!account);
                  setVehicles(false);
                }}
                aria-expanded={account}
              >
                <UserRound size={18} />
                <span>
                  {loading
                    ? "Account"
                    : user
                      ? user.name.split(" ")[0]
                      : "Sign in"}
                </span>
                <ChevronDown size={13} />
              </button>
              {account && (
                <div className="dropdown" onClick={() => setAccount(false)}>
                  {user ? (
                    <>
                      <Link href="/account">My account</Link>
                      <Link href="/account/submissions">
                        My listed vehicles
                      </Link>
                      <Link href="/saved">Saved vehicles</Link>
                      {user.role !== "customer" && (
                        <Link href="/admin">Admin portal</Link>
                      )}
                      <button onClick={logout}>Sign out</button>
                    </>
                  ) : (
                    <>
                      <Link href="/login">Sign in</Link>
                      <Link href="/signup">Create an account</Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
const footerGroups = [
  {
    title: "Explore",
    label: "Footer vehicle links",
    links: [
      ["/", "Home"],
      ["/cars", "Passenger cars"],
      ["/commercial", "Commercial cabs"],
      ["/compare", "Compare vehicles"],
      ["/discounts", "Discounts & offers"],
      ["/about", "About NCR Wheelz"],
      ["/blog", "Blog & guides"],
    ],
  },
  {
    title: "Tools & selling",
    label: "Footer tools and selling links",
    links: [
      ["/car-valuation", "Check car value"],
      ["/sell", "Sell your vehicle"],
      ["/selling-guide", "Selling guide"],
      ["/emi-calculator", "EMI calculator"],
      ["/finance", "Finance information"],
      ["/saved", "Saved vehicles"],
    ],
  },
  {
    title: "Policies & guidance",
    label: "Footer policies",
    links: [
      ["/policies/verification", "Listing & document review"],
      ["/policies/seller-agreement", "Seller agreement"],
      ["/policies/buyer-agreement", "Buyer agreement"],
      ["/policies/condition", "Vehicle condition"],
      ["/policies/cancellation-refund", "Cancellations & refunds"],
      ["/policies/finance", "Finance disclaimer"],
    ],
  },
];

// Phones fold each group behind a tappable heading; wider screens show the
// plain heading with every link (the toggle is hidden there, see CSS).
function FooterLinks({ group }: { group: (typeof footerGroups)[number] }) {
  const [open, setOpen] = useState(false);
  const listId = `footer-links-${group.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <nav
      className={footerStyles.linkGroup}
      aria-label={group.label}
      data-open={open}
    >
      <h3>
        <span className={footerStyles.groupTitle}>{group.title}</span>
        <button
          type="button"
          className={footerStyles.groupToggle}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          {group.title}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </h3>
      <ul id={listId}>
        {group.links.map(([href, label]) => (
          <li key={href}>
            <Link href={href}>{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer({ settings }: { settings: Partial<Settings> }) {
  const business = resolveBusiness(settings);
  const hasContact =
    business.phones.length > 0 ||
    business.email ||
    business.whatsapp ||
    business.instagram;
  return (
    <footer className={footerStyles.footer} aria-label="NCR Wheelz footer">
      <div className="container">
        <section
          className={footerStyles.invitation}
          aria-labelledby="footer-invitation-title"
        >
          <div>
            <span className={footerStyles.eyebrow}>
              THE ROAD AHEAD STARTS HERE
            </span>
            <h2 id="footer-invitation-title">Let’s find what moves you.</h2>
            <p>A car for everyday life. A vehicle for the work ahead.</p>
          </div>
          <div className={footerStyles.actions}>
            <Link href="/cars" className={footerStyles.browse}>
              Explore passenger cars <ArrowUpRight size={17} />
            </Link>
            <Link href="/contact" className={footerStyles.talk}>
              Talk to the team <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
        <div className={footerStyles.grid}>
          <div className={footerStyles.brand}>
            <Logo name={business.name} />
            <p className={footerStyles.description}>
              New keys. New possibilities.
              <br />
              Explore used passenger and commercial cabs in Delhi NCR.
            </p>
            <address className={footerStyles.details}>
              {business.address && (
                <span>
                  <MapPin size={16} />
                  <span>{business.address}</span>
                </span>
              )}
              {business.hours && (
                <span>
                  <Clock3 size={16} />
                  <span>{business.hours}</span>
                </span>
              )}
            </address>
            {business.address && (
              <a
                className={footerStyles.directions}
                href={business.mapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Get directions <ArrowUpRight size={14} />
              </a>
            )}
          </div>
          {footerGroups.map((group) => (
            <FooterLinks group={group} key={group.title} />
          ))}
        </div>
        {hasContact && (
          <div className={footerStyles.contactStrip}>
            {business.phones.length > 0 && (
              <div className={footerStyles.contactItem}>
                <span className={footerStyles.contactIcon}>
                  <Phone size={19} />
                </span>
                <div>
                  <span className={footerStyles.contactLabel}>
                    Speak to the team
                  </span>
                  <div className={footerStyles.phoneNumbers}>
                    {business.phones.map((phone) => (
                      <a href={phone.href} key={phone.href}>
                        {phone.display}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {business.email && (
              <div className={footerStyles.contactItem}>
                <span className={footerStyles.contactIcon}>
                  <Mail size={19} />
                </span>
                <div>
                  <span className={footerStyles.contactLabel}>Write to us</span>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </div>
              </div>
            )}
            {business.whatsapp && (
              <div className={footerStyles.contactItem}>
                <span className={footerStyles.contactIcon}>
                  <MessageCircle size={19} />
                </span>
                <div>
                  <span className={footerStyles.contactLabel}>
                    Continue the conversation
                  </span>
                  <a
                    href={`https://wa.me/${business.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chat on WhatsApp <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
            )}
            {business.instagram && (
              <div className={footerStyles.contactItem}>
                <span className={footerStyles.contactIcon}>
                  <Instagram size={19} />
                </span>
                <div>
                  <span className={footerStyles.contactLabel}>
                    Follow our latest arrivals
                  </span>
                  <a
                    href={business.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @ncrwheels2026 <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
        <div className={footerStyles.bottom}>
          <span>
            © {new Date().getFullYear()} {business.name}. All rights reserved.
          </span>
          <nav aria-label="Footer legal and support links">
            <Link href="/policies/terms">Terms</Link>
            <Link href="/policies/privacy">Privacy</Link>
            <Link href="/policies/cookies">Cookie preferences</Link>
            <Link href="/contact">Contact us</Link>
            <Link href="/admin/login">
              Staff access <ArrowUpRight size={12} />
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
