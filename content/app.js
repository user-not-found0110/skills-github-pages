(function () {
  'use strict';

  // ============================================================
  // Splash Pressure Washing - Daily Content Creator
  // ============================================================

  const HISTORY_KEY = 'splash_pw_content_history';
  const TODAY_KEY = 'splash_pw_content_today';
  const WEEK_KEY = 'splash_pw_content_week';

  const BUSINESS = {
    name: 'Splash Pressure Washing',
    site: 'splashwashing.com',
    primaryCity: 'Chesapeake',
    state: 'VA',
    region: 'Hampton Roads',
    cities: ['Chesapeake', 'Virginia Beach', 'Norfolk', 'Suffolk', 'Portsmouth'],
    ownership: 'veteran and firefighter owned',
    phone: '', // intentionally blank — user can paste in
    services: ['house washing', 'soft washing', 'driveway cleaning', 'concrete cleaning', 'gutter cleaning', 'fence cleaning', 'commercial pressure washing']
  };

  // ============================================================
  // TOPIC POOL
  // Each topic provides "substance"; generators format per platform.
  // ============================================================

  const TOPICS = [
    {
      id: 'house-wash-curb-appeal',
      title: 'House Washing for Instant Curb Appeal',
      service: 'house washing',
      keyword: 'house washing in Chesapeake VA',
      seasons: ['spring','summer','fall'],
      emoji: '🏡',
      hooks: [
        "Your siding is one paint shade darker than it should be — and you might not even notice until it's clean.",
        "Drive by your house tonight. Then drive by it the day after a soft wash. You won't believe it's the same home.",
        "Curb appeal isn't about a new front door. It's about siding that actually looks the color you painted it."
      ],
      points: [
        'Soft washing safely lifts dirt, mildew, pollen, and algae from siding without damaging it.',
        'A clean exterior can boost perceived home value before a single dollar of renovation.',
        'Cleaning every 12-18 months prevents long-term staining and costly replacement.'
      ],
      question: 'How often should I have my house pressure washed?',
      answer: "Most homes in coastal Virginia benefit from a professional soft wash every 12 to 18 months. Humidity, salt air, and pollen create the perfect environment for mildew and algae, especially on north-facing walls. Annual cleaning keeps siding warranties intact and prevents permanent staining."
    },
    {
      id: 'soft-wash-vs-pressure',
      title: 'Soft Washing vs Pressure Washing — What\'s the Difference?',
      service: 'soft washing',
      keyword: 'soft washing vs pressure washing',
      seasons: ['all'],
      emoji: '💧',
      hooks: [
        "Not every surface should meet 3,000 PSI. Here's what the pros use instead.",
        "If a contractor wants to blast your siding at full pressure, run.",
        "Soft wash. Pressure wash. Same goal, very different machines."
      ],
      points: [
        'Soft washing uses low pressure plus a biodegradable cleaning solution to safely treat siding, roofs, and screens.',
        'Pressure washing uses high-pressure water and is reserved for hard surfaces like concrete, brick, and stone.',
        'Using the wrong method voids siding warranties and can drive water under panels.'
      ],
      question: 'Is soft washing safe for vinyl siding?',
      answer: "Yes. Soft washing is the manufacturer-recommended method for vinyl, Hardie board, stucco, and aluminum. It uses pressure no stronger than a garden hose combined with a cleaning solution that kills the algae and mildew at the root, so growth doesn't return as quickly."
    },
    {
      id: 'driveway-concrete',
      title: 'Driveway Cleaning Brings Concrete Back to Life',
      service: 'driveway cleaning',
      keyword: 'driveway pressure washing Chesapeake',
      seasons: ['spring','summer','fall'],
      emoji: '🚗',
      hooks: [
        "Your driveway isn't gray. It used to be. Then it spent five years collecting tire marks.",
        "The fastest way to make your house look newer: clean the concrete in front of it.",
        "Most people forget the driveway is part of curb appeal. Until they see a freshly washed one."
      ],
      points: [
        'Surface cleaners deliver an even, stripe-free finish that wand washing cannot match.',
        'We treat oil, rust, and organic stains with targeted solutions before the wash.',
        'Sealing after cleaning extends results by 1-3 years.'
      ],
      question: 'Will pressure washing damage my concrete driveway?',
      answer: "Not when it's done correctly. We use a flat-surface cleaner that distributes pressure evenly, so concrete is cleaned without etching, pitting, or zebra stripes. Aggressive wand washing in a single zone is what causes damage, which is why a professional rig matters."
    },
    {
      id: 'gutter-cleaning',
      title: 'Why Skipping Gutter Cleaning Costs More Than You Think',
      service: 'gutter cleaning',
      keyword: 'gutter cleaning Chesapeake VA',
      seasons: ['fall','spring'],
      emoji: '🍂',
      hooks: [
        "Clogged gutters are the cheapest way to ruin a foundation.",
        "If water is running over the side of your gutters, the damage has already started.",
        "A weekend on a ladder versus 20 minutes from the ground — your call."
      ],
      points: [
        'Clogged gutters send water into the foundation, fascia boards, and basement.',
        'Twice-a-year cleaning (spring and fall) prevents 95% of gutter-related damage.',
        'Our crew bags the debris and rinses the downspouts — no mess left behind.'
      ],
      question: 'How often should gutters be cleaned in Virginia?',
      answer: "Twice a year is the sweet spot for most Hampton Roads homes — once in late spring after the pollen and seed pods drop, and once in late fall after the leaves are down. Homes with overhanging trees often need a third cleaning in midsummer."
    },
    {
      id: 'gutter-face-streak',
      title: 'Those Black Stripes on Your Gutters Aren\'t Dirt',
      service: 'gutter cleaning',
      keyword: 'gutter brightening near me',
      seasons: ['all'],
      emoji: '🪣',
      hooks: [
        "The black streaks on your gutters aren't from rain — they're oxidation, and pressure alone won't touch them.",
        "Gutters that look 'dirty' from the street are usually oxidized, not just clogged.",
        "Painting your gutters? Try gutter brightening first. It's a fraction of the cost."
      ],
      points: [
        "Gutter face oxidation comes from UV breaking down the aluminum's outer layer.",
        'A specialty brightening agent reverses the oxidation in a single application.',
        "Most homeowners think they need to replace their gutters when really they just need brightening."
      ],
      question: 'What are the black streaks on my gutters?',
      answer: "Those streaks are oxidation — a chemical reaction between the aluminum surface and air pollutants. Plain pressure washing won't remove them, which is why most homeowners assume they're stuck. A gutter brightening treatment dissolves the oxidation and restores the original finish in one visit."
    },
    {
      id: 'mold-mildew-removal',
      title: 'Green and Black Stuff on Your Siding? Here\'s What That Is',
      service: 'soft washing',
      keyword: 'mildew removal siding',
      seasons: ['summer','fall'],
      emoji: '🧪',
      hooks: [
        "Coastal Virginia humidity is paradise for siding algae. Your house just happens to be in the way.",
        "Green tint = algae. Black spots = mildew. Both eat into your siding.",
        "If you can run your finger through it, you can wash it off — but only the right way."
      ],
      points: [
        'Algae and mildew thrive in our humid coastal climate, especially on shaded north-facing walls.',
        'Pressure alone removes the surface stain but not the root, so growth returns in weeks.',
        'A proper soft wash kills the organism and prevents return for 12+ months.'
      ],
      question: "What's the green stuff growing on my siding?",
      answer: "It's most likely algae (gloeocapsa) or mildew, both extremely common in humid Hampton Roads neighborhoods. They feed on pollen, dust, and the limestone in your siding. A surfactant-based soft wash kills them at the root, so the growth doesn't come back the next month."
    },
    {
      id: 'fence-cleaning',
      title: 'Vinyl and Wood Fence Cleaning, Done Right',
      service: 'fence cleaning',
      keyword: 'fence cleaning service',
      seasons: ['spring','summer'],
      emoji: '🪵',
      hooks: [
        "Fences age twice as fast as siding. Yours is doing the heavy lifting.",
        "If your white vinyl fence has gone gray-green, it's not stained. It's algae.",
        "A clean fence finishes a yard the same way trim finishes a room."
      ],
      points: [
        'Vinyl fences soft wash beautifully back to factory white in one visit.',
        'Wood fences clean with low pressure and an enzymatic solution to avoid splintering.',
        'Cleaning before staining or sealing dramatically extends the result.'
      ],
      question: 'Can a vinyl fence be cleaned without damage?',
      answer: "Yes. Vinyl fences should be soft washed, never blasted. Low pressure plus a cleaning solution removes years of algae and mildew without etching the surface. Most fences come back to within one shade of factory white in a single visit."
    },
    {
      id: 'pool-deck',
      title: 'Pool Deck and Patio Cleaning — Before the Cookouts Start',
      service: 'concrete cleaning',
      keyword: 'pool deck cleaning Virginia Beach',
      seasons: ['spring','summer'],
      emoji: '🏊',
      hooks: [
        "The pool deck is where summer happens. Make it look like it.",
        "Slippery pool deck? That's algae, not rough texture.",
        "Pavers, stamped concrete, travertine — all of it cleans, none of it cleans the same way."
      ],
      points: [
        'Pool decks accumulate sunscreen, organic stains, and algae fast in our climate.',
        'Different deck surfaces (concrete, pavers, travertine) require different pressure and chemistry.',
        'Cleaning before sealing protects the surface and the joints between pavers.'
      ],
      question: 'Is the slippery feel on my pool deck dangerous?',
      answer: "Yes — that slick texture is almost always a thin algae film, not the surface itself. It's the leading cause of pool-area falls. A professional cleaning kills the algae and restores traction without damaging stamped concrete or pavers."
    },
    {
      id: 'pre-listing',
      title: 'Selling Your House? Wash It Before You List It',
      service: 'house washing',
      keyword: 'pre-listing pressure washing',
      seasons: ['all'],
      emoji: '🏷️',
      hooks: [
        "Listing photos last forever. Wash the house first.",
        "Most realtors stage the inside. Few think about the outside. That's your edge.",
        "A $400 wash adds $4,000 to the perceived list price. Math checks out."
      ],
      points: [
        'A clean exterior is the #1 inexpensive change that boosts listing photo quality.',
        'Buyers driving by see the house before they see the listing.',
        'We can usually turn a property around in a single day for closing-date timelines.'
      ],
      question: 'Should I pressure wash my house before selling?',
      answer: "Almost always, yes. Real estate agents consistently rate exterior cleaning as one of the highest ROI pre-listing improvements — typical cost is a few hundred dollars and the visual impact rivals a fresh coat of paint. Schedule it the week before listing photos."
    },
    {
      id: 'spring-refresh',
      title: 'Spring Refresh: The Pollen-and-Mildew Reset',
      service: 'house washing',
      keyword: 'spring pressure washing',
      seasons: ['spring'],
      emoji: '🌸',
      hooks: [
        "The pollen has settled. Time to wash it off everything.",
        "Spring in Hampton Roads = yellow cars, yellow siding, yellow porches. Reset week is here.",
        "If you're doing one outdoor project this spring, make it the wash."
      ],
      points: [
        'Spring pollen mixes with winter mildew to bond hard against siding and concrete.',
        'A single comprehensive wash sets the tone for the rest of the outdoor season.',
        'Bundle pricing for house + driveway + walkway is most cost-effective in spring.'
      ],
      question: 'Is spring or fall a better time to pressure wash?',
      answer: "Spring is the most popular for good reason — it removes a winter's worth of mildew and the season's pollen in one pass. Fall is the better time for gutter cleaning and a final concrete cleanup. Many homeowners do a light wash each season."
    },
    {
      id: 'fall-prep',
      title: 'Fall Cleanup: Get Ahead of the Storms',
      service: 'gutter cleaning',
      keyword: 'fall pressure washing Hampton Roads',
      seasons: ['fall'],
      emoji: '🍁',
      hooks: [
        "Storm season hits Hampton Roads twice. Clean gutters are your best defense.",
        "Leaves on the lawn? Already too late for the gutters.",
        "Fall is for prevention. Spring is for restoration."
      ],
      points: [
        'Late-season storms in coastal VA dump heavy rain quickly — gutters need to flow.',
        'Cleaning concrete in fall prevents winter freeze-thaw cycle damage.',
        'Booking ahead of November is smart — schedules fill fast after the first big storm.'
      ],
      question: 'When should I get my gutters cleaned in fall?',
      answer: "Aim for early to mid November, after most of the leaves have dropped but before the first major coastal storm. If your roof is lined with oaks or pines, a second cleaning in early December is worth the small extra cost."
    },
    {
      id: 'veteran-firefighter',
      title: 'Veteran and Firefighter Owned — What That Means for You',
      service: 'house washing',
      keyword: 'veteran owned pressure washing Chesapeake',
      seasons: ['all'],
      emoji: '🇺🇸',
      hooks: [
        "We bring the same standard from the firehouse and the service to your driveway.",
        "Every truck we send out gets inspected the same way we used to inspect engine apparatus.",
        "Service didn't end when the uniform came off. It just changed shape."
      ],
      points: [
        'Splash is veteran and firefighter owned, so attention to detail and accountability are baked in.',
        'We show up on time, in uniform, with insurance and licensing in hand.',
        'Active military, retired military, and first responders get a standing discount — just ask.'
      ],
      question: 'Is Splash Pressure Washing locally owned?',
      answer: "Yes. Splash is locally owned, veteran and firefighter run, and based in Chesapeake, VA. The crew lives in the same neighborhoods we serve, which is why the work has to be right the first time — odds are we'll see you at the grocery store next week."
    },
    {
      id: 'commercial',
      title: 'Commercial Pressure Washing for Storefronts and Properties',
      service: 'commercial pressure washing',
      keyword: 'commercial pressure washing Hampton Roads',
      seasons: ['all'],
      emoji: '🏬',
      hooks: [
        "First impression of your business? It's the sidewalk in front of it.",
        "Gum, grease, mystery stains — your storefront is fighting a quiet battle.",
        "Property managers, this one's for you."
      ],
      points: [
        'We work after hours so foot traffic and customers are never interrupted.',
        'Recurring monthly and quarterly contracts available for plazas, restaurants, and offices.',
        'Insurance on file for commercial properties up to $2M general liability.'
      ],
      question: 'Do you offer scheduled commercial cleaning contracts?',
      answer: "Yes. Most commercial clients in Hampton Roads do best with monthly or quarterly cleaning, depending on traffic. We schedule overnight or early morning so businesses never lose a customer hour, and we send the same crew to each visit for consistency."
    },
    {
      id: 'oil-stains',
      title: 'Oil Stains on the Driveway? Don\'t Just Pressure Wash Them',
      service: 'driveway cleaning',
      keyword: 'oil stain removal driveway',
      seasons: ['all'],
      emoji: '🛢️',
      hooks: [
        "Pressure alone won't lift oil. It just spreads it.",
        "That driveway oil stain has been there since 2019. We can fix it.",
        "Cat litter is for the first hour. Then call a pro."
      ],
      points: [
        "Oil bonds at the molecular level with concrete pores — pressure pushes it deeper without the right pre-treatment.",
        'A degreaser pulls the oil up to the surface, then surface cleaning lifts it off.',
        'Old, deep stains may require two passes; we set expectations honestly upfront.'
      ],
      question: 'Can old oil stains be removed from concrete?',
      answer: "Most can, with the right approach. A degreaser is applied first, then dwells for 10-20 minutes to draw the oil to the surface. After that, hot water surface cleaning lifts most or all of the stain. Stains older than 5+ years may require two treatments."
    },
    {
      id: 'roof-soft-wash',
      title: 'Roof Soft Washing: Why That Black Streak Is Costing You',
      service: 'soft washing',
      keyword: 'roof cleaning Chesapeake VA',
      seasons: ['spring','summer','fall'],
      emoji: '🏠',
      hooks: [
        "The black streaks on your shingles aren't dirt. They're algae, and they're literally eating the granules.",
        "A new roof costs $20K. A roof wash costs a few hundred. Math.",
        "Every year you skip a roof wash, you shave 1-2 years off the shingles."
      ],
      points: [
        'Black streaks are gloeocapsa magma — an algae that consumes shingle granules over time.',
        'Soft washing (never pressure) is the only roof-safe method endorsed by major shingle manufacturers.',
        'A clean roof can extend shingle life by years and lower attic temperatures.'
      ],
      question: 'Is soft washing safe for asphalt shingles?',
      answer: "Yes — soft washing is the only method approved by the Asphalt Roofing Manufacturers Association. It uses very low pressure (less than a garden hose) combined with a cleaning solution. Pressure washing a roof voids most shingle warranties, so always confirm a contractor uses soft washing."
    },
    {
      id: 'algae-mildew-prevention',
      title: 'How to Stop Algae From Coming Back',
      service: 'soft washing',
      keyword: 'algae prevention siding',
      seasons: ['summer'],
      emoji: '🦠',
      hooks: [
        "It came back in three months. That means the wash didn't kill the root.",
        "Algae is a plant. Cutting the leaves doesn't kill the roots.",
        "If your last wash didn't include a treatment, you got cleaning. Not a cure."
      ],
      points: [
        'Cheap pressure washes remove the visible stain but leave the algae root.',
        'A surfactant treatment kills the organism so growth stays away 12+ months.',
        'Trimming back overhanging branches doubles the lifespan of any wash.'
      ],
      question: 'Why does algae keep coming back to my siding?',
      answer: "Because pressure washing alone only removes the surface coating — the algae root system stays alive in the siding's pores. A proper soft wash with a sodium hypochlorite-based solution kills the organism, which is why professional cleanings last 12-18 months versus a few weeks for a DIY pressure wash."
    },
    {
      id: 'storm-cleanup',
      title: 'After-Storm Cleanup: Quick-Turn Property Wash',
      service: 'house washing',
      keyword: 'storm cleanup pressure washing Virginia',
      seasons: ['summer','fall'],
      emoji: '⛈️',
      hooks: [
        "Branches off the lawn is step one. Mud off the siding is step two.",
        "Hurricane debris doesn't just sit on the lawn — it stains.",
        "We open up emergency same-week slots after named storms. Just call."
      ],
      points: [
        'Salt spray, blown debris, and mud streak siding fast and stain over time.',
        'We prioritize storm cleanup calls during named storm aftermath.',
        'Insurance documentation available if part of a claim.'
      ],
      question: 'Should I wash my house after a hurricane?',
      answer: "Yes, ideally within a week. Salt spray, mud, and organic debris bond hard once they dry into the siding's surface. A prompt soft wash prevents permanent staining and is far cheaper than waiting until the next year. We'll provide documentation if it's part of an insurance claim."
    },
    {
      id: 'before-after',
      title: 'Before and After: The 30-Minute Curb Appeal Transformation',
      service: 'house washing',
      keyword: 'before and after pressure washing',
      seasons: ['all'],
      emoji: '✨',
      hooks: [
        "Same house. Same paint. Different decade.",
        "We don't post these to brag. We post them to remind people what their house could look like.",
        "Sometimes the photo on the right is what convinces people to call."
      ],
      points: [
        'A typical single-family soft wash takes 60-90 minutes from setup to drive-away.',
        'No new paint, no contractor weeks — just clean.',
        'We send before-and-after photos to every customer for their records.'
      ],
      question: 'How long does a house pressure washing take?',
      answer: "A typical 2,000-2,800 sq ft home in Chesapeake takes about 60-90 minutes from setup to cleanup. Larger homes or homes with heavy mildew may run longer. We always provide an estimated window when you book and update you if anything changes."
    },
    {
      id: 'bundle-package',
      title: 'House + Driveway + Walkway = Most Popular Bundle',
      service: 'house washing',
      keyword: 'house and driveway cleaning package',
      seasons: ['spring','summer','fall'],
      emoji: '📦',
      hooks: [
        "Most homeowners book a wash, then call back two weeks later for the driveway. Bundle and save.",
        "House. Driveway. Sidewalk. The full reset.",
        "If you're going to do one, you might as well do all three — the truck is already there."
      ],
      points: [
        'Combined house + concrete pricing saves 15-20% vs booking each separately.',
        "We're already on site, so equipment setup is just one trip's worth of work.",
        'Most full bundles complete in a single morning.'
      ],
      question: 'Can I combine house washing and driveway cleaning?',
      answer: "Absolutely — and you should. The bundle is our most popular service because it tackles every visible exterior surface in one visit, which saves on travel and setup costs. Most homes complete in a single morning, and the savings versus booking separately is typically 15-20%."
    },
    {
      id: 'eco-friendly',
      title: 'Eco-Friendly Cleaning: How We Protect Plants and Pets',
      service: 'soft washing',
      keyword: 'eco friendly pressure washing',
      seasons: ['spring','summer'],
      emoji: '🌿',
      hooks: [
        "Yes, the solution is biodegradable. No, your hydrangeas won't notice.",
        "Pets inside, plants pre-rinsed, mulch flagged. That's how we soft wash.",
        "Worried about your azaleas? Good — that means you'll like our process."
      ],
      points: [
        'Cleaning solution breaks down into salt and water within hours of application.',
        'We pre-rinse all landscaping and re-rinse afterward to dilute any overspray.',
        'Pet- and plant-safe protocols on every job, no exceptions.'
      ],
      question: 'Is pressure washing safe for plants and pets?',
      answer: "When done correctly, yes. Our crew pre-rinses landscaping before applying any cleaning solution, then rinses again to dilute any drift. The solution we use is biodegradable and breaks down into harmless byproducts within hours. Pets should stay inside during the wash, but can return to the yard within 30-60 minutes after we leave."
    },
    {
      id: 'rust-stains',
      title: 'Rust Stains on Concrete? Yes, We Can Remove Them',
      service: 'concrete cleaning',
      keyword: 'rust stain removal concrete',
      seasons: ['all'],
      emoji: '🟠',
      hooks: [
        "Bleach won't touch rust. Pressure won't touch rust. The right acid blend will.",
        "Sprinkler heads leaving orange streaks on your driveway? We see you.",
        "If it's orange and it doesn't wash off, it needs chemistry, not pressure."
      ],
      points: [
        'Rust requires a specialty oxalic-acid-based cleaner, not standard pressure washing.',
        'Common sources: well water sprinklers, metal furniture, fertilizer.',
        'Most rust stains lift in a single application; deep penetration may need two.'
      ],
      question: 'How do you remove rust stains from a driveway?',
      answer: "Rust requires a chemical approach — high pressure alone will not remove it. We apply an oxalic-acid-based remover that converts the iron oxide back to a soluble form, then rinse it away. Most stains lift completely in one pass; very old or deeply set stains may need a second application."
    },
    {
      id: 'brick-stucco',
      title: 'Cleaning Brick and Stucco Without Damaging the Mortar',
      service: 'soft washing',
      keyword: 'brick cleaning Hampton Roads',
      seasons: ['all'],
      emoji: '🧱',
      hooks: [
        "High pressure on old mortar = expensive lesson. Soft wash is the answer.",
        "Brick looks bulletproof. Mortar isn't.",
        "Stucco hides dirt until it doesn't. Then it really doesn't."
      ],
      points: [
        'Brick and stucco demand soft washing — high pressure damages mortar joints and stucco texture.',
        'Mildew on north-facing walls is the most common complaint we see.',
        'Cleaning before painting or sealing dramatically improves results.'
      ],
      question: 'Can brick be pressure washed safely?',
      answer: "Brick itself is durable, but the mortar between bricks is not — and aggressive pressure washing erodes it quickly. We always soft wash brick and stucco using a cleaning solution and very low pressure to remove mildew and dirt without compromising the mortar joints."
    },
    {
      id: 'apartment-rental',
      title: 'Landlords and Property Managers — Turn Days Just Got Easier',
      service: 'commercial pressure washing',
      keyword: 'rental property cleaning service',
      seasons: ['all'],
      emoji: '🏘️',
      hooks: [
        "Vacant unit. New listing. Make-ready day. We can be there.",
        "The fastest way to add 10% to a rental's perceived condition? Wash the outside.",
        "Property managers — we'll set you up with a recurring schedule and one invoice."
      ],
      points: [
        'Same-week scheduling for turn-day exteriors.',
        'Single point of contact and one invoice for portfolios.',
        'Soft washing keeps rental siding warranties intact between tenants.'
      ],
      question: 'Do you serve property managers and rental portfolios?',
      answer: "Yes — we work with several property managers and small landlords across Hampton Roads. We can scope individual turn days, set recurring quarterly cleanings, or handle a full portfolio with one POC and one invoice. Pricing scales with volume."
    },
    {
      id: 'free-quote',
      title: 'How a Splash Quote Works (Spoiler: Fast and Free)',
      service: 'house washing',
      keyword: 'free pressure washing quote Chesapeake',
      seasons: ['all'],
      emoji: '📋',
      hooks: [
        "Most quotes take 24-48 hours. Ours usually takes 5 minutes.",
        "Tell us your address and what you want washed. That's it. Quote in your inbox same day.",
        "Free quotes, no pressure (other than the kind that comes out of our truck)."
      ],
      points: [
        'Quotes are free and never include sales pressure.',
        'Most properties can be quoted from satellite imagery in the same hour you ask.',
        'On-site quotes available when needed, usually within 48 hours.'
      ],
      question: 'How do I get a quote for pressure washing?',
      answer: "Easiest path: send us your address and a quick note about what you want cleaned (house, driveway, gutters, etc). For most homes in Chesapeake and Virginia Beach we can quote from satellite imagery within an hour. If your property is more complex or commercial, we'll schedule a free on-site walkthrough."
    },
    {
      id: 'maintenance-schedule',
      title: 'The Annual Wash Schedule for a Coastal Virginia Home',
      service: 'house washing',
      keyword: 'annual pressure washing schedule',
      seasons: ['all'],
      emoji: '📅',
      hooks: [
        "Three appointments a year keeps a house looking new for a decade.",
        "Spring wash, fall gutters, summer concrete refresh. That's the whole plan.",
        "Hampton Roads humidity rewards a schedule. Casual cleaning falls behind."
      ],
      points: [
        'Spring: full house + driveway soft wash to reset from winter.',
        'Summer: light concrete refresh and pool deck.',
        'Fall: gutters, downspouts, a final concrete cleanup before storms.'
      ],
      question: "What's the ideal yearly pressure washing schedule?",
      answer: "For a typical Hampton Roads home: a full house and driveway soft wash in spring, a light concrete refresh in midsummer, and a gutter cleaning plus final wash in late fall. That three-touch schedule keeps siding warranties intact, prevents most algae return, and protects the foundation."
    }
  ];

  // ============================================================
  // HELPERS
  // ============================================================

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function readableDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function dayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = (d - start) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
    return Math.floor(diff / (1000*60*60*24));
  }
  function getSeason(d) {
    const m = d.getMonth();
    if (m <= 1 || m === 11) return 'winter';
    if (m <= 4) return 'spring';
    if (m <= 7) return 'summer';
    return 'fall';
  }
  function pick(arr, seed) {
    if (!arr || arr.length === 0) return '';
    if (typeof seed !== 'number') return arr[Math.floor(Math.random()*arr.length)];
    return arr[seed % arr.length];
  }
  function pickCity(seed) {
    return pick(BUSINESS.cities, seed);
  }

  // Pick today's topic deterministically, biased toward season
  function topicForDate(d) {
    const season = getSeason(d);
    const seasonal = TOPICS.filter(t => t.seasons.includes(season) || t.seasons.includes('all'));
    const idx = dayOfYear(d) % seasonal.length;
    return seasonal[idx];
  }

  // ============================================================
  // PLATFORM GENERATORS
  // ============================================================

  // -------- Google Business Profile (Google-friendly) --------
  function makeGBP(topic, ctx) {
    const city = ctx.city || BUSINESS.primaryCity;
    const opener = pick(topic.points, ctx.seed);
    const second = pick(topic.points, ctx.seed + 1);
    const ctas = [
      `Call ${BUSINESS.name} for a free quote, or visit ${BUSINESS.site}.`,
      `Get a no-obligation quote at ${BUSINESS.site}.`,
      `Schedule a free estimate today at ${BUSINESS.site}.`,
      `Request a quote in under a minute at ${BUSINESS.site}.`
    ];
    const intros = [
      `${topic.title} — what ${city} homeowners should know.`,
      `Serving ${city} and ${BUSINESS.region}: ${topic.title.toLowerCase()}.`,
      `${topic.title}.`
    ];
    const intro = pick(intros, ctx.seed);
    const cta = pick(ctas, ctx.seed);

    return [
      intro,
      '',
      opener,
      second !== opener ? second : '',
      '',
      `${BUSINESS.name} is a ${BUSINESS.ownership} pressure washing company based in ${BUSINESS.primaryCity}, ${BUSINESS.state}, serving ${BUSINESS.cities.slice(0,4).join(', ')}, and surrounding ${BUSINESS.region} communities.`,
      '',
      cta
    ].filter(Boolean).join('\n');
  }

  // -------- Facebook (friendly + light emojis + 1-2 hashtags) --------
  function makeFB(topic, ctx) {
    const city = ctx.city || BUSINESS.primaryCity;
    const hook = pick(topic.hooks, ctx.seed);
    const point = pick(topic.points, ctx.seed + 2);
    const emojiPool = [topic.emoji, '✨', '💪', '👀', '✅'];
    const emoji = topic.emoji;
    const closer = emojiPool[(ctx.seed + 1) % emojiPool.length];
    const ctas = [
      `Free quote in your inbox today — splashwashing.com ${closer}`,
      `Message us or grab a free quote at splashwashing.com ${closer}`,
      `Comment "QUOTE" or visit splashwashing.com ${closer}`,
      `DM us or hit splashwashing.com for a 5-minute quote ${closer}`
    ];
    const cta = pick(ctas, ctx.seed);
    const tagOptions = [
      `#${city.replace(/\s+/g,'')}VA`,
      `#PressureWashing`,
      `#CurbAppeal`,
      `#${BUSINESS.region.replace(/\s+/g,'')}`,
      `#HomeMaintenance`
    ];
    const tag1 = tagOptions[ctx.seed % tagOptions.length];
    const tag2 = tagOptions[(ctx.seed + 2) % tagOptions.length];

    return `${emoji} ${hook}\n\n${point}\n\n${cta}\n\n${tag1} ${tag2}`;
  }

  // -------- Instagram (hook line + body + 5 hashtags) --------
  function makeIG(topic, ctx) {
    const city = ctx.city || BUSINESS.primaryCity;
    const hook = pick(topic.hooks, ctx.seed + 3);
    const point = pick(topic.points, ctx.seed + 1);

    const closers = [
      `📲 Tap the link in bio for a free quote.`,
      `💧 DM us to book — we'll quote it from your address.`,
      `✨ Free quotes at splashwashing.com (link in bio).`,
      `🚿 Comment "QUOTE" and we'll send one over.`
    ];
    const closer = pick(closers, ctx.seed);

    // Hashtag strategy: 1 brand, 1-2 local, 1-2 niche.
    const localTags = [`#${city.replace(/\s+/g,'')}VA`, `#${BUSINESS.region.replace(/\s+/g,'')}`, `#757Living`];
    const nicheTags = [`#PressureWashing`, `#SoftWashing`, `#CurbAppeal`, `#CleanHome`, `#HomeMaintenance`, `#HouseWashing`, `#DrivewayCleaning`, `#PowerWashing`, `#ExteriorCleaning`, `#BeforeAndAfter`];
    const brandTag = `#SplashPressureWashing`;

    const local1 = localTags[ctx.seed % localTags.length];
    const local2 = localTags[(ctx.seed + 1) % localTags.length];
    const niche1 = nicheTags[ctx.seed % nicheTags.length];
    const niche2 = nicheTags[(ctx.seed + 3) % nicheTags.length];
    // Ensure 5 unique
    const tags = Array.from(new Set([brandTag, local1, niche1, niche2, local2])).slice(0,5);
    while (tags.length < 5) {
      const t = nicheTags[(ctx.seed + tags.length) % nicheTags.length];
      if (!tags.includes(t)) tags.push(t);
    }

    return `${topic.emoji} ${hook}\n\n${point}\n\n${closer}\n.\n.\n${tags.join(' ')}`;
  }

  // -------- Blog / Article (SEO + AEO friendly) --------
  function makeBlog(topic, ctx) {
    const city = ctx.city || BUSINESS.primaryCity;
    const region = BUSINESS.region;

    const titleVariants = [
      `${topic.title} (${city}, ${BUSINESS.state})`,
      `${topic.title} — A Guide for ${region} Homeowners`,
      topic.title
    ];
    const title = pick(titleVariants, ctx.seed);

    const metaVariants = [
      `Local guide to ${topic.service} in ${city}, ${BUSINESS.state} from ${BUSINESS.name}. What to expect, how often to do it, and how to get a quote.`,
      `${topic.service.charAt(0).toUpperCase()+topic.service.slice(1)} in ${city}: practical advice from a ${BUSINESS.ownership} crew. Free quotes at ${BUSINESS.site}.`,
      `What every ${region} homeowner should know about ${topic.service.toLowerCase()}. Plain-English answers from ${BUSINESS.name}.`
    ];
    const meta = pick(metaVariants, ctx.seed).slice(0, 158);

    // Intro: include primary keyword + city, natural tone
    const intro = `If you're looking into ${topic.service} in ${city}, ${BUSINESS.state}, this is the short, honest guide. We're ${BUSINESS.name} — a ${BUSINESS.ownership} crew based right here in ${BUSINESS.primaryCity} — and we get the same questions every week. Below, we've answered the most common ones in plain English, the same way we'd answer them on a phone call.`;

    // AEO question block (the headlining question + concise answer)
    const aeo = `## ${topic.question}\n\n${topic.answer}`;

    // Three H2 sections derived from key points
    const sectionTitles = [
      `Why it matters for ${region} homes`,
      `What we actually do on the job`,
      `How to know it's time to book`
    ];
    const sectionBodies = topic.points.map(p => p);

    const sec1 = `## ${sectionTitles[0]}\n\nLiving on the coast means dealing with humidity, salt air, and a generous pollen season. All three accelerate the wear and grime that ${topic.service} addresses. ${sectionBodies[0]} For homeowners in ${city} and across ${region}, that translates to maintenance you don't want to skip — but also one you don't need to overthink.`;

    const sec2 = `## ${sectionTitles[1]}\n\nA visit from our crew is straightforward. We arrive on time, walk the property with you (or send a video walk-through if you're not home), pre-rinse landscaping, and complete the work. ${sectionBodies[1] || sectionBodies[0]} Before we leave, we walk the property again with you, send before-and-after photos, and answer anything that comes up.`;

    const sec3 = `## ${sectionTitles[2]}\n\nMost homeowners realize it's time when they notice green or black streaking, slick patches on concrete, or gutters running slow. ${sectionBodies[2] || sectionBodies[0]} If you're already on the fence, the quote is free and takes about five minutes — we usually pull it from satellite imagery for residential properties in ${city} and ${BUSINESS.cities[1]}.`;

    // FAQ block (extra AEO juice)
    const faqs = [
      { q: `How much does ${topic.service} cost in ${city}?`,
        a: `Most ${topic.service} jobs in ${city} fall between a couple hundred and a few hundred dollars depending on size, surface, and condition. We give exact pricing in writing before any work starts — no surprises.` },
      { q: `Are you licensed and insured?`,
        a: `Yes. ${BUSINESS.name} carries general liability insurance and is fully licensed in ${BUSINESS.state}. We can email a current Certificate of Insurance on request, which property managers and HOAs sometimes require.` },
      { q: `What areas do you serve?`,
        a: `We work across ${BUSINESS.cities.join(', ')}, and the surrounding ${region} communities. If you're nearby and not sure, send us your address and we'll confirm same day.` }
    ];
    const faqMd = `## Frequently Asked Questions\n\n` + faqs.map(f => `### ${f.q}\n\n${f.a}`).join('\n\n');

    // Closing CTA
    const closer = `## Get a free quote\n\nReady to see what your home looks like clean? Send us your address through ${BUSINESS.site} and we'll send back a no-pressure quote, usually the same day. We're a ${BUSINESS.ownership} business, we live in the same neighborhoods we serve, and the work has to be right the first time.`;

    const article = [
      `# ${title}`,
      '',
      intro,
      '',
      aeo,
      '',
      sec1,
      '',
      sec2,
      '',
      sec3,
      '',
      faqMd,
      '',
      closer
    ].join('\n');

    return { title, meta, article };
  }

  // ============================================================
  // GENERATE BUNDLE for a given topic + context
  // ============================================================
  function generateAll(topic, ctx) {
    return {
      topicId: topic.id,
      topicTitle: topic.title,
      gbp: makeGBP(topic, ctx),
      fb: makeFB(topic, ctx),
      ig: makeIG(topic, ctx),
      blog: makeBlog(topic, ctx),
      generatedAt: Date.now(),
      seed: ctx.seed,
      city: ctx.city
    };
  }

  // ============================================================
  // STORAGE
  // ============================================================
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 60))); }
    catch (e) {}
  }
  function loadToday() {
    try { return JSON.parse(localStorage.getItem(TODAY_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveToday(obj) {
    try { localStorage.setItem(TODAY_KEY, JSON.stringify(obj)); }
    catch (e) {}
  }
  function loadWeek() {
    try { return JSON.parse(localStorage.getItem(WEEK_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveWeek(obj) {
    try { localStorage.setItem(WEEK_KEY, JSON.stringify(obj)); }
    catch (e) {}
  }

  // ============================================================
  // UI WIRING
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const tabPanels = document.querySelectorAll('.tab-panel');
  const navBtns = document.querySelectorAll('.nav-btn');

  function switchTab(name) {
    tabPanels.forEach(p => p.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    const panel = $('tab-' + name);
    if (panel) panel.classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
    if (btn) btn.classList.add('active');
    if (name === 'history') renderHistory();
    if (name === 'calendar') renderWeek();
  }
  navBtns.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // Toast
  const toastEl = $('toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // Populate topic select
  const topicSelect = $('topicSelect');
  TOPICS.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    topicSelect.appendChild(opt);
  });

  // Date display
  const today = new Date();
  $('todayDate').textContent = readableDate(today);

  // Counter helpers
  function updateCounts() {
    const gbp = $('gbpText').value;
    $('gbpCount').textContent = `${gbp.length} chars`;
    $('gbpCount').classList.toggle('over', gbp.length > 1500);

    const fb = $('fbText').value;
    $('fbCount').textContent = `${fb.length} chars`;
    $('fbCount').classList.toggle('over', fb.length > 500);

    const ig = $('igText').value;
    $('igCount').textContent = `${ig.length} chars`;
    $('igCount').classList.toggle('over', ig.length > 2200);

    const blog = $('blogText').value;
    const words = blog.trim() ? blog.trim().split(/\s+/).length : 0;
    $('blogCount').textContent = `${words} words`;
  }
  ['gbpText','fbText','igText','blogText'].forEach(id => {
    $(id).addEventListener('input', updateCounts);
  });

  // Render generated bundle into UI
  function renderBundle(bundle) {
    $('gbpText').value = bundle.gbp;
    $('fbText').value = bundle.fb;
    $('igText').value = bundle.ig;
    $('blogTitle').value = bundle.blog.title;
    $('blogMeta').value = bundle.blog.meta;
    $('blogText').value = bundle.blog.article;
    $('todayTopic').textContent = bundle.topicTitle;
    const customNote = bundle.customFocus ? ` — ${bundle.customFocus}` : '';
    $('todayMeta').textContent = `Topic: ${bundle.topicTitle}${customNote}`;
    $('contentArea').style.display = 'block';
    $('regenBtn').style.display = 'inline-block';
    updateCounts();
  }

  // Generate handler
  function generate(opts) {
    opts = opts || {};
    const overrideId = topicSelect.value;
    const topic = overrideId ? TOPICS.find(t => t.id === overrideId) : topicForDate(today);
    if (!topic) { toast('No topic selected'); return; }

    const customFocus = $('customFocus').value.trim();
    const seed = opts.fresh ? Math.floor(Math.random()*1000000) : (dayOfYear(today) + (today.getFullYear()*7));
    const city = pickCity(seed);
    const ctx = { seed, city, customFocus };

    const bundle = generateAll(topic, ctx);
    if (customFocus) {
      // Append custom focus into platform text and blog intro
      bundle.fb = bundle.fb.replace(/\n\n/, `\n(Focus: ${customFocus})\n\n`);
      bundle.ig = bundle.ig.replace(/\n\n/, `\n(${customFocus})\n\n`);
      bundle.gbp = bundle.gbp.replace(/\n\n/, `\nFocus: ${customFocus}.\n\n`);
      bundle.blog.article = bundle.blog.article.replace(
        '## ' + topic.question,
        `> Note: this article focuses on ${customFocus}.\n\n## ${topic.question}`
      );
      bundle.customFocus = customFocus;
    }
    bundle.dateKey = dateKey(today);
    saveToday(bundle);
    renderBundle(bundle);
  }

  $('generateBtn').addEventListener('click', () => generate({ fresh: false }));
  $('regenBtn').addEventListener('click', () => generate({ fresh: true }));

  // Restore today's content if already generated
  const existingToday = loadToday();
  if (existingToday && existingToday.dateKey === dateKey(today)) {
    renderBundle(existingToday);
  }

  // Copy buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.target;
      const text = $(id).value;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('copied');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = orig; }, 1500);
      } catch (e) {
        // Fallback
        $(id).select();
        document.execCommand('copy');
        toast('Copied');
      }
    });
  });

  // Mini action buttons
  document.querySelectorAll('.btn-mini').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'open-gbp') {
        window.open('https://business.google.com/posts', '_blank');
      } else if (action === 'open-fb') {
        window.open('https://www.facebook.com/', '_blank');
      } else if (action === 'open-ig') {
        window.open('https://www.instagram.com/', '_blank');
      } else if (action === 'copy-blog-html') {
        const md = $('blogText').value;
        const html = mdToHtml(md);
        try { await navigator.clipboard.writeText(html); toast('HTML copied'); }
        catch (e) { toast('Copy failed'); }
      } else if (action === 'copy-blog-bundle') {
        const bundle = `TITLE: ${$('blogTitle').value}\n\nMETA: ${$('blogMeta').value}\n\n---\n\n${$('blogText').value}`;
        try { await navigator.clipboard.writeText(bundle); toast('Title + Meta + Body copied'); }
        catch (e) { toast('Copy failed'); }
      }
    });
  });

  // Minimal markdown → HTML for blog export
  function mdToHtml(md) {
    const lines = md.split('\n');
    const out = [];
    let inList = false;
    for (let line of lines) {
      if (/^# /.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h1>' + esc(line.slice(2)) + '</h1>'); }
      else if (/^## /.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h2>' + esc(line.slice(3)) + '</h2>'); }
      else if (/^### /.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h3>' + esc(line.slice(4)) + '</h3>'); }
      else if (/^> /.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<blockquote>' + esc(line.slice(2)) + '</blockquote>'); }
      else if (/^- /.test(line)) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + esc(line.slice(2)) + '</li>'); }
      else if (line.trim() === '') { if (inList) { out.push('</ul>'); inList = false; } out.push(''); }
      else { if (inList) { out.push('</ul>'); inList = false; } out.push('<p>' + esc(line) + '</p>'); }
    }
    if (inList) out.push('</ul>');
    return out.filter(l => l !== undefined).join('\n');
  }
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Save to history
  $('saveContentBtn').addEventListener('click', () => {
    const t = loadToday();
    if (!t) { toast('Generate something first'); return; }
    const hist = loadHistory();
    // Avoid duplicate same-day same-topic entries
    const dedup = hist.filter(h => !(h.dateKey === t.dateKey && h.topicId === t.topicId));
    dedup.unshift({ ...t, savedAt: Date.now() });
    saveHistory(dedup);
    toast('Saved to history');
  });

  // History rendering
  function renderHistory() {
    const list = $('historyList');
    const hist = loadHistory();
    list.innerHTML = '';
    if (hist.length === 0) {
      $('histEmpty').style.display = 'block';
      return;
    }
    $('histEmpty').style.display = 'none';
    hist.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'hist-item';
      const when = new Date(item.savedAt || item.generatedAt);
      div.innerHTML = `
        <div class="hist-item-head">
          <div class="hist-title">${escHtml(item.topicTitle)}</div>
          <div class="hist-date">${when.toLocaleDateString()}</div>
        </div>
        <div class="hist-preview">${escHtml((item.fb || '').slice(0,180))}</div>
        <div class="hist-actions">
          <button data-act="restore" data-idx="${idx}">Restore</button>
          <button data-act="copy-fb" data-idx="${idx}">FB</button>
          <button data-act="copy-ig" data-idx="${idx}">IG</button>
          <button data-act="delete" data-idx="${idx}" class="danger">Delete</button>
        </div>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', async () => {
        const act = b.dataset.act;
        const idx = parseInt(b.dataset.idx, 10);
        const hist = loadHistory();
        const item = hist[idx];
        if (!item) return;
        if (act === 'restore') {
          renderBundle(item);
          switchTab('today');
          toast('Restored');
        } else if (act === 'copy-fb') {
          await navigator.clipboard.writeText(item.fb);
          toast('Facebook post copied');
        } else if (act === 'copy-ig') {
          await navigator.clipboard.writeText(item.ig);
          toast('Instagram post copied');
        } else if (act === 'delete') {
          hist.splice(idx, 1);
          saveHistory(hist);
          renderHistory();
        }
      });
    });
  }
  function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  $('clearHistBtn').addEventListener('click', () => {
    if (confirm('Delete all saved content?')) {
      saveHistory([]);
      renderHistory();
    }
  });

  // ============================================================
  // 7-Day calendar
  // ============================================================
  function buildWeek() {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const topic = topicForDate(d);
      const seed = dayOfYear(d) + d.getFullYear()*7;
      const city = pickCity(seed);
      const ctx = { seed, city, customFocus: '' };
      const bundle = generateAll(topic, ctx);
      bundle.dateKey = dateKey(d);
      bundle.dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      bundle.dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      week.push(bundle);
    }
    saveWeek({ generatedAt: Date.now(), startKey: dateKey(today), days: week });
    renderWeek();
    toast('Week built');
  }
  function renderWeek() {
    const list = $('weekList');
    list.innerHTML = '';
    const w = loadWeek();
    if (!w || w.startKey !== dateKey(today)) {
      list.innerHTML = '<p class="empty-msg">Tap "Build This Week" to generate 7 days of content.</p>';
      return;
    }
    w.days.forEach((d, idx) => {
      const div = document.createElement('div');
      div.className = 'week-day';
      div.innerHTML = `
        <div class="week-day-head">
          <div class="week-day-name">${escHtml(d.dayName)}</div>
          <div class="week-day-date">${escHtml(d.dayLabel)}</div>
        </div>
        <div class="week-topic">${escHtml(d.topicTitle)}</div>
        <div class="week-snippet">${escHtml((d.fb || '').slice(0,140))}…</div>
        <div class="week-platforms">
          <button data-day="${idx}" data-p="gbp">Copy Google</button>
          <button data-day="${idx}" data-p="fb">Copy Facebook</button>
          <button data-day="${idx}" data-p="ig">Copy Instagram</button>
          <button data-day="${idx}" data-p="blog">Copy Blog</button>
        </div>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', async () => {
        const dayIdx = parseInt(b.dataset.day, 10);
        const p = b.dataset.p;
        const w = loadWeek();
        const day = w.days[dayIdx];
        let txt;
        if (p === 'blog') {
          txt = `TITLE: ${day.blog.title}\n\nMETA: ${day.blog.meta}\n\n---\n\n${day.blog.article}`;
        } else {
          txt = day[p];
        }
        try {
          await navigator.clipboard.writeText(txt);
          toast(`${p.toUpperCase()} for ${day.dayName} copied`);
        } catch (e) { toast('Copy failed'); }
      });
    });
  }
  $('buildWeekBtn').addEventListener('click', buildWeek);

  // PWA install prompt
  let deferredPrompt = null;
  const installBtn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-block';
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
  });

  // Service worker registration (only if served over HTTP/S)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
