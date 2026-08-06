/**
 * Controlled audit fixture site.
 *
 * A small, deliberately imperfect website used to run a repeatable full audit
 * in tests. It contains a known mix of GEO strengths and weaknesses so the
 * expected score band is stable.
 *
 * Deliberate strengths:
 *   - HTTPS-equivalent handling, valid single H1, descriptive titles
 *   - Organization/LocalBusiness schema with sameAs, areaServed and address
 *   - FAQPage schema with real question/answer pairs
 *   - Named author with credentials, published and modified dates
 *   - Full contact details, license number, founding year
 *   - Question-led headings, lists, tables, explicit definitions
 *   - robots.txt and sitemap.xml
 *
 * Deliberate weaknesses:
 *   - one very thin page (under 150 words)
 *   - two pages sharing a duplicated opening paragraph
 *   - vague marketing filler and an unsupported superlative
 *   - a page missing its meta description
 *   - a broken internal link
 *   - no llms.txt
 *   - no comparison content
 *   - images without alt text on one page
 */

export interface FixturePage {
  path: string;
  contentType?: string;
  body: string;
}

const ORIGIN = 'http://127.0.0.1:4321';

function page(options: {
  title: string;
  description?: string;
  canonical: string;
  h1: string;
  body: string;
  schema?: string;
  author?: boolean;
  dates?: boolean;
}): string {
  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${options.title}</title>
  ${options.description ? `<meta name="description" content="${options.description}">` : ''}
  <link rel="canonical" href="${ORIGIN}${options.canonical}">
  <meta property="og:title" content="${options.title}">
  <meta property="og:description" content="${options.description ?? 'Northbridge Plumbing Co.'}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${ORIGIN}${options.canonical}">
  <meta property="og:image" content="${ORIGIN}/logo.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${options.title}">
  ${options.dates ? '<meta property="article:published_time" content="2026-02-11T09:00:00Z">\n  <meta property="article:modified_time" content="2026-03-28T11:15:00Z">' : ''}
  ${options.author ? '<meta name="author" content="Priya Raman">' : ''}
  ${options.schema ? `<script type="application/ld+json">${options.schema}</script>` : ''}
</head>
<body>
  <header>
    <a href="/">Northbridge Plumbing Co.</a>
    <nav>
      <a href="/about">About</a>
      <a href="/services/drain-cleaning">Drain cleaning</a>
      <a href="/services/water-heaters">Water heaters</a>
      <a href="/services/emergency">Emergency service</a>
      <a href="/faq">FAQ</a>
      <a href="/contact">Contact</a>
      <a href="/blog/how-to-spot-a-leak">Guides</a>
    </nav>
  </header>
  <main>
    <h1>${options.h1}</h1>
    ${options.body}
  </main>
  <footer>
    <address>
      Northbridge Plumbing Co., 1420 Harlow Avenue, Northbridge, MA 01534<br>
      Phone: (508) 555-0173 · Email: service@northbridgeplumbing.test<br>
      Massachusetts Plumbing License #PL-20418 · Serving Worcester County since 2011
    </address>
    <p><a href="/privacy">Privacy policy</a> · <a href="/terms">Terms</a></p>
  </footer>
</body>
</html>`;
}

const ORGANIZATION_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Plumber',
  name: 'Northbridge Plumbing Co.',
  legalName: 'Northbridge Plumbing Company LLC',
  url: ORIGIN,
  logo: `${ORIGIN}/logo.png`,
  description:
    'Northbridge Plumbing Co. is a licensed residential plumbing contractor serving homeowners and property managers across Worcester County, Massachusetts.',
  telephone: '+1-508-555-0173',
  email: 'service@northbridgeplumbing.test',
  foundingDate: '2011-04-01',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1420 Harlow Avenue',
    addressLocality: 'Northbridge',
    addressRegion: 'MA',
    postalCode: '01534',
    addressCountry: 'US',
  },
  areaServed: ['Northbridge', 'Worcester', 'Millbury', 'Sutton', 'Uxbridge'],
  sameAs: [
    'https://www.linkedin.com/company/northbridge-plumbing-example',
    'https://www.bbb.org/us/ma/northbridge/profile/plumber/northbridge-plumbing-example',
  ],
});

const WEBSITE_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Northbridge Plumbing Co.',
  url: ORIGIN,
  publisher: { '@type': 'Organization', name: 'Northbridge Plumbing Co.' },
});

const FAQ_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How much does drain cleaning cost in Worcester County?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A standard kitchen or bathroom drain clearing runs $185 to $340 as of 2026. Main sewer line clearing with camera inspection runs $450 to $780 depending on the length of the run and whether root intrusion is present.',
      },
    },
    {
      '@type': 'Question',
      name: 'How long does a water heater replacement take?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A like-for-like tank replacement takes three to four hours. Converting from a tank to a tankless unit takes a full day because it requires new gas line sizing and venting.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do you charge for emergency call-outs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Emergency call-outs outside 7am to 5pm on weekdays carry a $145 dispatch fee, which is credited against the repair if you proceed with the work the same visit.',
      },
    },
  ],
});

const ARTICLE_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'How to spot a hidden water leak before it damages your floors',
  datePublished: '2026-02-11T09:00:00Z',
  dateModified: '2026-03-28T11:15:00Z',
  author: {
    '@type': 'Person',
    name: 'Priya Raman',
    jobTitle: 'Master Plumber, MA License #PL-20418',
    url: `${ORIGIN}/about`,
  },
  publisher: { '@type': 'Organization', name: 'Northbridge Plumbing Co.' },
});

/** Shared opening paragraph, duplicated across two pages on purpose. */
const DUPLICATED_OPENING =
  '<p>Northbridge Plumbing Co. has served homeowners across Worcester County since 2011. Our licensed technicians arrive in stocked trucks and complete most repairs on the first visit.</p>';

export const FIXTURE_PAGES: FixturePage[] = [
  {
    path: '/',
    body: page({
      title: 'Plumber in Northbridge, MA | Northbridge Plumbing Co.',
      description:
        'Licensed residential plumbing across Worcester County. Drain cleaning, water heaters and 24-hour emergency service. Same-day appointments most weekdays.',
      canonical: '/',
      h1: 'Northbridge Plumbing Co.',
      schema: `${ORGANIZATION_SCHEMA}</script><script type="application/ld+json">${WEBSITE_SCHEMA}`,
      body: `
      <p>Northbridge Plumbing Co. is a licensed residential plumbing contractor that repairs, replaces and maintains drains, water heaters and supply lines for homeowners and property managers across Worcester County, Massachusetts. We have operated from the same Northbridge shop since 2011.</p>
      <p>We work with three groups: homeowners dealing with an urgent leak or blockage, property managers maintaining multi-unit buildings, and general contractors who need a licensed plumbing subcontractor on residential builds.</p>
      <h2>What does a plumber actually do on a first visit?</h2>
      <p>On a first visit our technician diagnoses the fault, quotes a fixed price before starting, and completes the repair the same visit in about 78% of cases based on our 2025 job records. If a part has to be ordered we schedule the return visit before leaving.</p>
      <h2>How quickly can you get here?</h2>
      <p>We respond to emergency calls within four business hours. In 2025 we reached 92% of same-day emergency calls before 6pm. Scheduled appointments are usually available within two business days.</p>
      <h2>Which areas do you serve?</h2>
      <p>We serve Northbridge, Worcester, Millbury, Sutton, Uxbridge and the surrounding towns within a 25 mile radius of our Northbridge shop.</p>
      <h3>Our services</h3>
      <ul>
        <li><a href="/services/drain-cleaning">Drain cleaning and sewer line clearing</a></li>
        <li><a href="/services/water-heaters">Water heater repair and replacement</a></li>
        <li><a href="/services/emergency">24-hour emergency plumbing</a></li>
        <li><a href="/services/fixtures">Fixture installation</a></li>
      </ul>
      <h3>Typical response times</h3>
      <table>
        <thead><tr><th>Service</th><th>Typical response</th><th>Typical cost</th></tr></thead>
        <tbody>
          <tr><td>Emergency leak</td><td>Within 4 business hours</td><td>$145 dispatch + repair</td></tr>
          <tr><td>Drain clearing</td><td>1-2 business days</td><td>$185 - $340</td></tr>
          <tr><td>Water heater replacement</td><td>2-3 business days</td><td>$1,450 - $3,900</td></tr>
        </tbody>
      </table>
      <p>Backflow prevention is a device that stops contaminated water from being drawn back into the clean supply. Massachusetts requires annual testing on commercial installations, and we are certified to perform it.</p>
      <p>According to the 2021 Massachusetts State Plumbing Code (248 CMR 10.00), a licensed plumber must perform any work on potable water supply lines.</p>
      <p>See our <a href="https://www.mass.gov/orgs/board-of-state-examiners-of-plumbers-and-gas-fitters">state licensing board listing</a> to verify our license.</p>
      <img src="/photo-truck.jpg" alt="A Northbridge Plumbing service truck parked outside a residential property">
      `,
    }),
  },

  {
    path: '/about',
    body: page({
      title: 'About Northbridge Plumbing Co. | Licensed Since 2011',
      description:
        'Who runs Northbridge Plumbing Co., our licenses and certifications, crew size and the towns we cover across Worcester County.',
      canonical: '/about',
      h1: 'About Northbridge Plumbing Co.',
      author: true,
      body: `
      <p>Northbridge Plumbing Co. was founded in April 2011 by Priya Raman, a master plumber who had spent nine years working on commercial retrofits across greater Boston before returning to Worcester County to start a residential practice.</p>
      <h2>Who runs the business?</h2>
      <p>Priya Raman holds Massachusetts Master Plumber License #PL-20418 and has 23 years in the trade. She still runs about a third of the diagnostic calls herself. The company employs six technicians, four of whom hold journeyman licenses, and two apprentices working toward theirs.</p>
      <h2>What do we specialize in?</h2>
      <p>Older housing stock. Roughly 60% of the homes in our service area were built before 1960, which means galvanized supply lines, cast-iron waste stacks and undersized service entries. We hold current certifications in backflow prevention testing and gas fitting, and we carry $2 million in general liability coverage.</p>
      <h2>Where do we work?</h2>
      <p>Northbridge, Whitinsville, Worcester, Millbury, Sutton, Uxbridge, Douglas and Grafton — a 25 mile radius from our shop at 1420 Harlow Avenue.</p>
      <p>Written by <a href="/about">Priya Raman</a>, Master Plumber, MA License #PL-20418.</p>
      <p>Last reviewed: <time datetime="2026-03-28">March 28, 2026</time></p>
      `,
    }),
  },

  {
    path: '/services/drain-cleaning',
    body: page({
      title: 'Drain Cleaning and Sewer Clearing | Northbridge Plumbing Co.',
      description:
        'Drain and sewer line clearing across Worcester County, with camera inspection, fixed pricing from $185 and a 90-day workmanship guarantee.',
      canonical: '/services/drain-cleaning',
      h1: 'Drain cleaning and sewer line clearing',
      schema: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Drain cleaning',
        serviceType: 'Drain and sewer line clearing',
        provider: { '@type': 'Plumber', name: 'Northbridge Plumbing Co.' },
        areaServed: 'Worcester County, MA',
      }),
      body: `
      <p>Drain cleaning is the mechanical or hydro-jet removal of a blockage from a fixture drain, branch line or main sewer lateral. We clear the line, camera it to confirm the cause, and tell you whether the blockage is a one-off or a structural problem that will recur.</p>
      <h2>How much does drain cleaning cost?</h2>
      <p>A single kitchen or bathroom drain runs $185 to $340. A main sewer lateral with camera inspection runs $450 to $780 depending on the length of the run and whether root intrusion is present. We quote a fixed price before starting.</p>
      <h2>What does the process involve?</h2>
      <ol>
        <li>Diagnosis — we identify which line is blocked and where the access point is.</li>
        <li>Fixed quote — you approve the price before any work starts.</li>
        <li>Clearing — cable machine for most branch lines, hydro-jetting for grease or root intrusion.</li>
        <li>Camera inspection — we show you the inside of the line on a monitor.</li>
        <li>Report — you get the footage and a written recommendation.</li>
      </ol>
      <h2>How long does it take?</h2>
      <p>Most branch line clearings take 60 to 90 minutes. A main lateral with camera work takes two to three hours.</p>
      <h2>Will the blockage come back?</h2>
      <p>If the cause is grease or hair, clearing usually resolves it for 12 to 24 months. If the camera shows root intrusion or a bellied line, clearing buys time but the line needs repair. We tell you which one you have rather than selling a repeat visit.</p>
      <p>Case study: in November 2025 we cleared a recurring main line blockage at a three-family property in Whitinsville. The camera showed root intrusion at a clay joint 34 feet from the cleanout. The owner chose a spot repair at $2,900 rather than repeated $600 clearings, and the line has been clear for five months.</p>
      <p>Last updated: <time datetime="2026-03-14">March 14, 2026</time></p>
      `,
    }),
  },

  {
    path: '/services/water-heaters',
    body: page({
      title: 'Water Heater Repair and Replacement | Northbridge Plumbing Co.',
      description:
        'Tank and tankless water heater repair and replacement across Worcester County, with realistic pricing and honest advice on which option suits your home.',
      canonical: '/services/water-heaters',
      h1: 'Water heater repair and replacement',
      body: `
      ${DUPLICATED_OPENING}
      <h2>Should you repair or replace a water heater?</h2>
      <p>A tank under eight years old with a failed thermocouple or element is worth repairing — typically $180 to $420. A tank over twelve years old with a leaking body is not repairable and must be replaced. Between eight and twelve years, the decision depends on the cost of the specific fault against the $1,450 to $2,400 replacement cost.</p>
      <h2>How much does replacement cost?</h2>
      <p>A like-for-like 50 gallon gas tank replacement runs $1,450 to $2,400 installed. A tankless conversion runs $3,200 to $3,900 because it requires new gas line sizing, stainless venting and often an electrical circuit.</p>
      <h2>Is tankless worth it?</h2>
      <p>For a household of two using under 40 gallons a day, the payback period on a tankless conversion is roughly 14 years at current Massachusetts gas rates — longer than most people keep the house. For a household of five or more with staggered showers, the payback is closer to seven years and the endless hot water is worth something on its own. We will tell you which case you are in.</p>
      <p>We are an industry-leading provider of world-class water heater solutions and the best plumbers in the region.</p>
      <p>Last updated: <time datetime="2026-02-02">February 2, 2026</time></p>
      `,
    }),
  },

  {
    path: '/services/emergency',
    body: page({
      title: 'Emergency Plumbing | Northbridge Plumbing Co.',
      description:
        '24-hour emergency plumbing across Worcester County, with a stated dispatch fee and a four-hour target response.',
      canonical: '/services/emergency',
      h1: '24-hour emergency plumbing',
      body: `
      ${DUPLICATED_OPENING}
      <h2>What counts as an emergency?</h2>
      <p>An active leak you cannot stop at the shutoff, no water in the property, sewage backing up into a fixture, or no heat in freezing conditions where the cause is plumbing rather than the boiler itself.</p>
      <h2>What does an emergency call-out cost?</h2>
      <p>Emergency call-outs outside 7am to 5pm on weekdays carry a $145 dispatch fee, credited against the repair if you proceed the same visit. Repair costs are quoted before work starts, as with any other job.</p>
      <h2>What should you do before we arrive?</h2>
      <ol>
        <li>Close the main shutoff, usually where the supply enters the basement.</li>
        <li>Open the lowest tap in the house to drain the standing pressure.</li>
        <li>If the leak is near electrics, switch off that circuit at the panel.</li>
        <li>Photograph the damage before you move anything, for your insurer.</li>
      </ol>
      <p>Last updated: <time datetime="2026-03-01">March 1, 2026</time></p>
      `,
    }),
  },

  {
    // Deliberately thin page with a missing meta description.
    path: '/services/fixtures',
    body: page({
      title: 'Fixtures',
      canonical: '/services/fixtures',
      h1: 'Fixture installation',
      body: `
      <p>We install taps, toilets, sinks and showers. Call us for a quote.</p>
      <img src="/tap.jpg">
      <img src="/sink.jpg">
      `,
    }),
  },

  {
    path: '/faq',
    body: page({
      title: 'Frequently Asked Questions | Northbridge Plumbing Co.',
      description:
        'Answers to the questions Worcester County homeowners ask most about plumbing costs, timing, licensing and emergency service.',
      canonical: '/faq',
      h1: 'Frequently asked questions',
      schema: FAQ_SCHEMA,
      body: `
      <h2>How much does drain cleaning cost in Worcester County?</h2>
      <p>A standard kitchen or bathroom drain clearing runs $185 to $340 as of 2026. Main sewer line clearing with camera inspection runs $450 to $780 depending on the length of the run and whether root intrusion is present.</p>
      <h2>How long does a water heater replacement take?</h2>
      <p>A like-for-like tank replacement takes three to four hours. Converting from a tank to a tankless unit takes a full day because it requires new gas line sizing and venting.</p>
      <h2>Do you charge for emergency call-outs?</h2>
      <p>Yes. Emergency call-outs outside 7am to 5pm on weekdays carry a $145 dispatch fee, which is credited against the repair if you proceed with the work the same visit.</p>
      <h2>Are you licensed and insured?</h2>
      <p>Yes. Massachusetts Master Plumber License #PL-20418, with $2 million in general liability coverage. You can verify the license on the state licensing board website.</p>
      <h2>What is a bellied sewer line?</h2>
      <p>A bellied line is a section of pipe that has sagged below the intended grade, so waste and water collect there instead of draining. It shows on a camera inspection as standing water and it causes blockages that recur every few months.</p>
      <h2>Do you offer a guarantee?</h2>
      <p>Workmanship is guaranteed for 90 days on drain clearing and for one year on installations. Manufacturer warranties on parts are passed through in full.</p>
      <p>Last reviewed: <time datetime="2026-03-20">March 20, 2026</time></p>
      `,
    }),
  },

  {
    path: '/contact',
    body: page({
      title: 'Contact Northbridge Plumbing Co. | Worcester County',
      description:
        'Phone, email and address for Northbridge Plumbing Co., plus opening hours and the towns we cover.',
      canonical: '/contact',
      h1: 'Contact us',
      schema: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact Northbridge Plumbing Co.',
        url: `${ORIGIN}/contact`,
      }),
      body: `
      <h2>How do you reach us?</h2>
      <p>Call (508) 555-0173 during business hours, or email service@northbridgeplumbing.test. Emergency calls are answered 24 hours.</p>
      <h2>Where are we?</h2>
      <p>1420 Harlow Avenue, Northbridge, MA 01534. The shop counter is open to the public for parts.</p>
      <h2>What are the hours?</h2>
      <ul>
        <li>Monday to Friday: 7:00am - 5:00pm</li>
        <li>Saturday: 8:00am - 1:00pm</li>
        <li>Sunday: emergency calls only</li>
      </ul>
      <p>Prefer to see availability first? Our <a href="/booking-calendar">live booking calendar</a> shows open slots.</p>
      `,
    }),
  },

  {
    path: '/blog/how-to-spot-a-leak',
    body: page({
      title: 'How to Spot a Hidden Water Leak | Northbridge Plumbing Co.',
      description:
        'Six signs of a hidden water leak, how to confirm one with your water meter, and when it needs a plumber rather than a wrench.',
      canonical: '/blog/how-to-spot-a-leak',
      h1: 'How to spot a hidden water leak before it damages your floors',
      schema: ARTICLE_SCHEMA,
      author: true,
      dates: true,
      body: `
      <p>A hidden leak is a supply or waste line failure inside a wall, under a slab or beneath a floor, where the water is not visible until it has already caused damage. Most are found by their side effects rather than by seeing water.</p>
      <h2>What are the signs of a hidden leak?</h2>
      <ol>
        <li>A water bill that rises without a change in usage.</li>
        <li>A musty smell in one room that does not clear with ventilation.</li>
        <li>Warm patches on a floor, which suggest a hot supply line under a slab.</li>
        <li>Paint or wallpaper lifting along one wall at floor level.</li>
        <li>The sound of running water when every fixture is closed.</li>
        <li>Cupped or lifting hardwood boards in a single area.</li>
      </ol>
      <h2>How do you confirm a leak with the water meter?</h2>
      <p>Close every tap and appliance, then read the meter and write down the number. Wait two hours without using water and read it again. If the number moved, water is leaving the system somewhere. This is the simplest reliable test and it costs nothing.</p>
      <h2>How much does hidden leak detection cost?</h2>
      <p>Acoustic and thermal leak detection runs $280 to $520 depending on the size of the property. That is diagnostic only — the repair is quoted separately once we know what failed and where.</p>
      <h2>When should you call a plumber?</h2>
      <p>Immediately, if the meter test shows movement. A slab leak that runs for a month can cost more in remediation than the plumbing repair itself. According to the Insurance Information Institute, water damage claims average several thousand dollars, and most of that is drying and reconstruction rather than pipework.</p>
      <p>Written by <a href="/about">Priya Raman</a>, Master Plumber, MA License #PL-20418 — 23 years in the trade.</p>
      <p>Published <time datetime="2026-02-11">February 11, 2026</time> · Last reviewed <time datetime="2026-03-28">March 28, 2026</time></p>
      `,
    }),
  },

  {
    path: '/privacy',
    body: page({
      title: 'Privacy Policy | Northbridge Plumbing Co.',
      description: 'How Northbridge Plumbing Co. handles customer information.',
      canonical: '/privacy',
      h1: 'Privacy policy',
      body: `
      <p>We collect only the contact and property details needed to schedule and complete work. We do not sell customer data. Records are retained for seven years for warranty and accounting purposes.</p>
      `,
    }),
  },

  {
    path: '/robots.txt',
    contentType: 'text/plain; charset=utf-8',
    body: `User-agent: *
Allow: /
Disallow: /admin
Disallow: /booking-calendar

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`,
  },

  {
    path: '/sitemap.xml',
    contentType: 'application/xml; charset=utf-8',
    body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${ORIGIN}/</loc><lastmod>2026-03-28</lastmod></url>
  <url><loc>${ORIGIN}/about</loc><lastmod>2026-03-28</lastmod></url>
  <url><loc>${ORIGIN}/services/drain-cleaning</loc><lastmod>2026-03-14</lastmod></url>
  <url><loc>${ORIGIN}/services/water-heaters</loc><lastmod>2026-02-02</lastmod></url>
  <url><loc>${ORIGIN}/services/emergency</loc><lastmod>2026-03-01</lastmod></url>
  <url><loc>${ORIGIN}/services/fixtures</loc><lastmod>2026-01-10</lastmod></url>
  <url><loc>${ORIGIN}/faq</loc><lastmod>2026-03-20</lastmod></url>
  <url><loc>${ORIGIN}/contact</loc><lastmod>2026-03-02</lastmod></url>
  <url><loc>${ORIGIN}/blog/how-to-spot-a-leak</loc><lastmod>2026-03-28</lastmod></url>
</urlset>
`,
  },
];

export const FIXTURE_ORIGIN = ORIGIN;

/** Score band the fixture is expected to land in. Asserted by the tests. */
export const FIXTURE_EXPECTED_SCORE_RANGE = { min: 45, max: 92 } as const;
