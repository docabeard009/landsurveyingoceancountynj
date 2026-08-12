/* ============================================================================
   Lakeland Surveying — Site Assistant  v3  (FOUND)
   ----------------------------------------------------------------------------
   One integrated assistant. Three capabilities that hand off to each other:

     1. SERVICES     what each survey is, what's included, which one you need
     2. SERVICE AREA 256 towns + 9 counties, matched from free text or typos
     3. COST         guided estimator using the EXACT pricing model published
                     at /survey-cost-calculator.html  (keep the two in sync)

   Answers are generated locally in the browser — instant, no API cost, works
   offline-ish. A single AI call to /.netlify/functions/chat is attempted once
   per session, and only for questions the local engine can't confidently
   answer. If it times out or fails, the user never sees an error.

   Install: <script src="/assets/chat-widget.js" defer></script>
   (Already injected sitewide via Netlify Snippet Injection — no page edits.)

   No cookies. No localStorage. No API keys.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__lakelandChat) return;
  window.__lakelandChat = true;

  /* ==========================================================================
     1. CONFIG
     ========================================================================== */
  var BIZ = {
    name: "Lakeland Surveying",
    tel: "917.463.6042",
    telHref: "9174636042",
    sms: "+19174636042",
    formspree: "https://formspree.io/f/xnjywovb",
    endpoint: "/.netlify/functions/chat",
    calculator: "/survey-cost-calculator.html",
    areasIndex: "/areas/",
    aiTimeoutMs: 7000
  };

  /* ==========================================================================
     2. SERVICE AREA DATA
     slug~Display Name~countyIndex[~1 = coastal/flood-zone town]
     ========================================================================== */
  var COUNTIES = ["Ocean","Monmouth","Atlantic","Cape May","Burlington","Camden","Gloucester","Cumberland","Salem"];
  var TOWN_BLOB = "aberdeen~Aberdeen~1~1;absecon~Absecon~2~1;allenhurst~Allenhurst~1~1;allentown~Allentown~1;alloway-township~Alloway Township~8;asbury-park~Asbury Park~1~1;atlantic-city~Atlantic City~2~1;atlantic-highlands~Atlantic Highlands~1~1;audubon-park~Audubon Park~5;audubon~Audubon~5;avalon~Avalon~3~1;avon-by-the-sea~Avon-by-the-Sea~1~1;barnegat-light~Barnegat Light~0~1;barnegat~Barnegat~0~1;barrington~Barrington~5;bass-river-township~Bass River Township~4;bay-head~Bay Head~0~1;beach-haven~Beach Haven~0~1;beachwood~Beachwood~0~1;bellmawr~Bellmawr~5;belmar~Belmar~1~1;berkeley~Berkeley Township~0~1;berlin-township~Berlin Township~5;berlin~Berlin~5;beverly~Beverly~4;bordentown-township~Bordentown Township~4;bordentown~Bordentown~4;bradley-beach~Bradley Beach~1~1;brick~Brick~0~1;bridgeton~Bridgeton~7;brielle~Brielle~1~1;brigantine~Brigantine~2~1;brooklawn~Brooklawn~5;buena-vista-township~Buena Vista Township~2~1;buena~Buena~2~1;burlington-city~Burlington City~4;burlington-township~Burlington Township~4;camden-city~Camden~5;cape-may-point~Cape May Point~3~1;cape-may~Cape May~3~1;carneys-point-township~Carneys Point Township~8;cherry-hill~Cherry Hill~5;chesilhurst~Chesilhurst~5;chesterfield-township~Chesterfield Township~4;cinnaminson-township~Cinnaminson Township~4;clayton~Clayton~6;clementon~Clementon~5;collingswood~Collingswood~5;colts-neck~Colts Neck~1;commercial-township~Commercial Township~7;corbin-city~Corbin City~2~1;deal~Deal~1~1;deerfield-township~Deerfield Township~7;delanco-township~Delanco Township~4;delran-township~Delran Township~4;dennis-township~Dennis Township~3~1;deptford-township~Deptford Township~6;downe-township~Downe Township~7;eagleswood~Eagleswood~0~1;east-greenwich-township~East Greenwich Township~6;eastampton-township~Eastampton Township~4;eatontown~Eatontown~1;edgewater-park-township~Edgewater Park Township~4;egg-harbor-city~Egg Harbor City~2~1;egg-harbor-township~Egg Harbor Township~2~1;elk-township~Elk Township~6;elmer~Elmer~8;elsinboro-township~Elsinboro Township~8;englishtown~Englishtown~1;estell-manor~Estell Manor~2~1;evesham-township~Evesham Township~4;fair-haven~Fair Haven~1~1;fairfield-township-cumberland~Fairfield Township~7;farmingdale~Farmingdale~1;fieldsboro~Fieldsboro~4;florence-township~Florence Township~4;folsom~Folsom~2~1;franklin-township-gloucester~Franklin Township~6;freehold-borough~Freehold Borough~1;freehold-township~Freehold Township~1;galloway-township~Galloway Township~2~1;gibbsboro~Gibbsboro~5;glassboro~Glassboro~6;gloucester-city~Gloucester City~5;gloucester-township~Gloucester Township~5;greenwich-township-cumberland~Greenwich Township~7;greenwich-township-gloucester~Greenwich Township~6;haddon-heights~Haddon Heights~5;haddon-township~Haddon Township~5;haddonfield~Haddonfield~5;hainesport-township~Hainesport Township~4;hamilton-township~Hamilton Township~2~1;hammonton~Hammonton~2~1;harrison-township~Harrison Township~6;harvey-cedars~Harvey Cedars~0~1;hazlet~Hazlet~1;hi-nella~Hi-Nella~5;highlands~Highlands~1~1;holmdel~Holmdel~1;hopewell-township-cumberland~Hopewell Township~7;howell~Howell~1;interlaken~Interlaken~1;island-heights~Island Heights~0~1;jackson~Jackson Township~0;keansburg~Keansburg~1~1;keyport~Keyport~1~1;lacey~Lacey Township~0~1;lake-como~Lake Como~1~1;lakehurst~Lakehurst~0;lakewood~Lakewood Township~0~1;laurel-springs~Laurel Springs~5;lavallette~Lavallette~0~1;lawnside~Lawnside~5;lawrence-township-cumberland~Lawrence Township~7;lindenwold~Lindenwold~5;linwood~Linwood~2~1;little-egg-harbor~Little Egg Harbor Township~0~1;little-silver~Little Silver~1~1;loch-arbour~Loch Arbour~1~1;logan-township~Logan Township~6;long-beach-island~Long Beach Island~0~1;long-beach-township~Long Beach Township~0~1;long-branch~Long Branch~1~1;longport~Longport~2~1;lower-alloways-creek-township~Lower Alloways Creek Township~8;lower-township~Lower Township~3~1;lumberton-township~Lumberton Township~4;magnolia~Magnolia~5;manalapan~Manalapan~1;manasquan~Manasquan~1~1;manchester~Manchester Township~0;mannington-township~Mannington Township~8;mansfield-township~Mansfield Township~4;mantoloking~Mantoloking~0~1;mantua-township~Mantua Township~6;maple-shade-township~Maple Shade Township~4;margate-city~Margate City~2~1;marlboro~Marlboro~1;matawan~Matawan~1;maurice-river-township~Maurice River Township~7;medford-lakes~Medford Lakes~4;medford-township~Medford Township~4;merchantville~Merchantville~5;middle-township~Middle Township~3~1;middletown~Middletown~1;millstone~Millstone~1;millville~Millville~7;monmouth-beach~Monmouth Beach~1~1;monroe-township-gloucester~Monroe Township~6;moorestown-township~Moorestown Township~4;mount-ephraim~Mount Ephraim~5;mount-holly-township~Mount Holly Township~4;mount-laurel-township~Mount Laurel Township~4;mullica-township~Mullica Township~2~1;national-park~National Park~6;neptune-city~Neptune City~1;neptune-township~Neptune Township~1~1;new-hanover-township~New Hanover Township~4;newfield~Newfield~6;north-hanover-township~North Hanover Township~4;north-wildwood~North Wildwood~3~1;northfield~Northfield~2~1;oaklyn~Oaklyn~5;ocean-city~Ocean City~3~1;ocean-gate~Ocean Gate~0~1;ocean-township-oakhurst~Ocean Township (Oakhurst)~1;ocean-township-waretown~Ocean Township (Waretown)~0~1;oceanport~Oceanport~1~1;oldmans-township~Oldmans Township~8;ortley-beach~Ortley Beach~0~1;palmyra~Palmyra~4;paulsboro~Paulsboro~6;pemberton-township~Pemberton Township~4;pemberton~Pemberton~4;penns-grove~Penns Grove~8;pennsauken-township~Pennsauken Township~5;pennsville-township~Pennsville Township~8;pilesgrove-township~Pilesgrove Township~8;pine-beach~Pine Beach~0~1;pine-hill~Pine Hill~5;pitman~Pitman~6;pittsgrove-township~Pittsgrove Township~8;pleasantville~Pleasantville~2~1;plumsted~Plumsted Township~0;point-pleasant-beach~Point Pleasant Beach~0~1;point-pleasant~Point Pleasant~0~1;port-republic~Port Republic~2~1;quinton-township~Quinton Township~8;red-bank~Red Bank~1~1;riverside-township~Riverside Township~4;riverton~Riverton~4;roosevelt~Roosevelt~1;rumson~Rumson~1~1;runnemede~Runnemede~5;salem-city~Salem~8;sea-bright~Sea Bright~1~1;sea-girt~Sea Girt~1~1;sea-isle-city~Sea Isle City~3~1;seaside-heights~Seaside Heights~0~1;seaside-park~Seaside Park~0~1;shamong-township~Shamong Township~4;shiloh~Shiloh~7;ship-bottom~Ship Bottom~0~1;shrewsbury-borough~Shrewsbury Borough~1;shrewsbury-township~Shrewsbury Township~1;somerdale~Somerdale~5;somers-point~Somers Point~2~1;south-harrison-township~South Harrison Township~6;south-toms-river~South Toms River~0;southampton-township~Southampton Township~4;spring-lake-heights~Spring Lake Heights~1;spring-lake~Spring Lake~1~1;springfield-township~Springfield Township~4;stafford~Stafford Township~0~1;stone-harbor~Stone Harbor~3~1;stow-creek-township~Stow Creek Township~7;stratford~Stratford~5;surf-city~Surf City~0~1;swedesboro~Swedesboro~6;tabernacle-township~Tabernacle Township~4;tavistock~Tavistock~5;tinton-falls~Tinton Falls~1;toms-river~Toms River~0~1;tuckerton~Tuckerton~0~1;union-beach~Union Beach~1~1;upper-deerfield-township~Upper Deerfield Township~7;upper-freehold~Upper Freehold Township~1;upper-pittsgrove-township~Upper Pittsgrove Township~8;upper-township~Upper Township~3~1;ventnor-city~Ventnor City~2~1;vineland~Vineland~7;voorhees-township~Voorhees Township~5;wall-township~Wall Township~1;washington-township-burlington~Washington Township~4;washington-township-gloucester~Washington Township~6;waterford-township~Waterford Township~5;wenonah~Wenonah~6;west-cape-may~West Cape May~3~1;west-deptford-township~West Deptford Township~6;west-long-branch~West Long Branch~1;west-wildwood~West Wildwood~3~1;westampton-township~Westampton Township~4;westville~Westville~6;weymouth-township~Weymouth Township~2~1;wildwood-crest~Wildwood Crest~3~1;wildwood~Wildwood~3~1;willingboro-township~Willingboro Township~4;winslow-township~Winslow Township~5;woodbine~Woodbine~3~1;woodbury-heights~Woodbury Heights~6;woodbury~Woodbury~6;woodland-township~Woodland Township~4;woodlynne~Woodlynne~5;woodstown~Woodstown~8;woolwich-township~Woolwich Township~6;wrightstown~Wrightstown~4;atlantic-county~Atlantic County~2~1;burlington-county~Burlington County~4~1;camden-county~Camden County~5~1;cape-may-county~Cape May County~3~1;cumberland-county~Cumberland County~7~1;gloucester-county~Gloucester County~6~1;monmouth-county~Monmouth County~1~1;ocean-county~Ocean County~0~1;salem-county~Salem County~8~1";

  var TOWNS = TOWN_BLOB.split(";").map(function (row) {
    var p = row.split("~");
    return { slug: p[0], name: p[1], county: COUNTIES[+p[2]], coastal: p[3] === "1" };
  });

  /* Nicknames, abbreviations and the things people actually type. */
  var TOWN_ALIASES = {
    "lbi": "long-beach-island",
    "long beach island": "long-beach-island",
    "beach haven west": "stafford",
    "manahawkin": "stafford",
    "waretown": "ocean-township-waretown",
    "oakhurst": "ocean-township-oakhurst",
    "ortley": "ortley-beach",
    "pt pleasant": "point-pleasant",
    "point pleasant bch": "point-pleasant-beach",
    "ppb": "point-pleasant-beach",
    "tr": "toms-river",
    "toms river nj": "toms-river",
    "seaside": "seaside-heights",
    "silverton": "toms-river",
    "normandy beach": "lavallette",
    "chadwick beach": "lavallette",
    "holgate": "long-beach-township",
    "loveladies": "long-beach-township",
    "north beach": "long-beach-township",
    "brant beach": "long-beach-township",
    "spray beach": "long-beach-township",
    "haven beach": "long-beach-township",
    "beach haven crest": "long-beach-township",
    "forked river": "lacey",
    "lanoka harbor": "lacey",
    "bayville": "berkeley",
    "seaside hts": "seaside-heights",
    "atl city": "atlantic-city",
    "ac": "atlantic-city",
    "egg harbor": "egg-harbor-township",
    "eht": "egg-harbor-township",
    "whiting": "manchester",
    "cape may ct house": "middle-township",
    "cape may court house": "middle-township",
    "rio grande": "middle-township",
    "wildwood nj": "wildwood",
    "villas": "lower-township",
    "north cape may": "lower-township",
    "erma": "lower-township",
    "tuckahoe": "upper-township",
    "marmora": "upper-township",
    "ocean gate nj": "ocean-gate"
  };

  /* ==========================================================================
     3. SERVICE KNOWLEDGE
     ========================================================================== */
  var SERVICES = {
    flood: {
      key: "flood",
      label: "FEMA elevation certificate",
      short: "Elevation certificate",
      url: "/services/flood-elevation-certificates.html",
      priceable: "flat",
      words: ["elevation certificate","elevation cert","ec ","fema","flood","flood zone","flood insurance","loma","bfe","base flood","ae zone","ve zone","freeboard","nfip","premium","insurance"],
      blurb: "An elevation certificate documents exactly how high your lowest floor sits relative to the Base Flood Elevation. It's what your insurer uses to rate your NFIP premium, what the town wants for elevation permits, and the survey data a LOMA is built on.",
      includes: ["Site visit and elevation shots tied to NAVD 88","Completed FEMA Elevation Certificate form for the current FIRM panel","Photos and building diagram","Sealed by a licensed NJ Professional Land Surveyor"],
      turnaround: "Fieldwork is brief — most single-family shore certificates are done within a few business days of the site visit. If a closing or policy renewal is driving it, say so and we move it up."
    },
    boundary: {
      key: "boundary",
      label: "Boundary survey",
      short: "Boundary survey",
      url: "/services/boundary-surveys.html",
      priceable: "calc",
      words: ["boundary","property line","property lines","lot line","lot lines","corners","fence","neighbor","dispute","encroach","shed","pool","addition","setback","stake my lot","where is my line","survey my property"],
      blurb: "A boundary survey establishes where your property lines and corners actually fall, based on the deed, the record chain and physical evidence on the ground. It's the survey you need before a fence, a shed, a pool, an addition — or a disagreement with a neighbor.",
      includes: ["Deed and record research","Recovery of existing monuments, new markers set at missing corners","Located improvements, fences and visible encroachments","Sealed plan of survey"],
      turnaround: "Depends on lot complexity, vegetation and how much record research is involved. You'll get a realistic timeline with your quote, and we move fast when a permit or closing deadline is driving it."
    },
    title: {
      key: "title",
      label: "Title / ALTA survey",
      short: "Title / ALTA survey",
      url: "/services/title-surveys.html",
      priceable: "calc",
      words: ["title","alta","nsps","closing","close","refinance","refi","mortgage","lender","bank","attorney","title company","buying","purchase","sale","selling","settlement","commitment","easement"],
      blurb: "A title survey covers the boundary plus the improvements, easements and rights-of-way a lender or title company needs confirmed before closing. An ALTA/NSPS survey follows the national standard with its Table A options — typically required on commercial deals and by institutional lenders.",
      includes: ["Everything in a boundary survey","Easements, rights-of-way and encroachments located","Title-commitment items addressed by reference","Certification to the buyer, lender and title company"],
      turnaround: "This is what we're known for. We've turned surveys next-day for time-sensitive closings — tell us the closing date up front and we'll work to it."
    },
    topo: {
      key: "topo",
      label: "Topographic survey",
      short: "Topographic survey",
      url: "/services/topographic-surveys.html",
      priceable: "calc",
      words: ["topo","topographic","contour","contours","grading","grade","drainage","stormwater","elevations","site plan","architect","engineer","design","cad","permit","variance","new construction"],
      blurb: "A topographic survey maps the elevations and physical features of your site — contours, spot grades, structures, utilities, trees — so your architect or engineer can design to real ground conditions and your town can review the grading and drainage.",
      includes: ["Contours and spot elevations tied to NAVD 88 (same datum as FEMA)","Existing structures, pavement, utilities and significant features","Delivered in CAD for your design professional, plus the sealed plan","Scope and contour interval confirmed with you before we mobilize"],
      turnaround: "Set with your quote — we confirm limits and detail level up front so nothing gets re-flown or re-drafted."
    },
    stakeout: {
      key: "stakeout",
      label: "Construction stakeout",
      short: "Construction stakeout",
      url: "/services/construction-stakeout.html",
      priceable: "quote",
      words: ["stakeout","stake out","staking","layout","lay out","foundation","footing","piles","piling","excavat","builder","contractor","as-built","as built","build","utilities","offset"],
      blurb: "Construction stakeout puts your approved plans on the ground — building corners, foundations, piles, utilities and grades staked so your crews build straight to the drawings. On the barrier island that includes pile layout and elevations for elevated homes.",
      includes: ["Layout points confirmed with you before mobilizing","Staking sequenced around your build schedule","Pile and foundation layout for elevated shore construction","As-built surveys at completion for CO or lender sign-off"],
      turnaround: "Scheduled around your build sequence — rough grade, foundation, utilities — so the right stakes are in when each trade needs them."
    },
    condo: {
      key: "condo",
      label: "Condominium survey",
      short: "Condominium survey",
      url: "/services/condominium-surveys.html",
      priceable: "quote",
      words: ["condo","condominium","unit","master deed","hoa","association","conversion","common element","multi-family","multi family","duplex"],
      blurb: "Condominium work covers master-deed survey exhibits, unit certifications and conversions — the plans that define units, common elements and limited common elements, and the surveyor's certification lenders require before financing an individual unit.",
      includes: ["Master-deed survey exhibits and unit plans","Unit certifications for lender financing","Condominium conversion survey work","Coordination with the developer's or association's attorney"],
      turnaround: "Scoped with your attorney — tell us the recording or closing date and we'll build to it."
    }
  };
  var SERVICE_ORDER = ["flood","boundary","title","topo","stakeout","condo"];

  /* Real Q&A pulled from the service pages' FAQ schema — kept verbatim in
     substance so the bot never contradicts the site or the AI answer layer. */
  var FAQ = [
    { k: ["lower","reduce","save","premium","insurance","cheaper","cost of insurance"], s: "flood",
      q: "Will an elevation certificate lower my flood insurance?",
      a: "It depends how high your lowest floor sits above the Base Flood Elevation. Each additional foot of freeboard generally reduces the NFIP premium, and a home documented above the BFE can sometimes come out of the high-risk zone entirely through a LOMA. The certificate is the document that proves it." },
    { k: ["how long does","turnaround","how fast","how quick","how soon","business days","take to get"], s: "flood",
      q: "How long does an elevation certificate take?",
      a: "Fieldwork is brief. Most single-family shore certificates are completed within a few business days of the site visit. If you're up against a closing or a policy deadline, say so — fast turnaround is one of the reasons attorneys keep our number." },
    { k: ["old","existing","already have","previous","expire","expired","still valid","update"], s: "flood",
      q: "Do I need a new certificate if I already have one?",
      a: "Possibly. If the flood maps for your area were revised, if the home was elevated or renovated, or if your insurer is working off a pre-2010 form, a current certificate tied to the effective FIRM panel may be required. Send us what you have and we'll tell you." },
    { k: ["loma","letter of map","difference between a loma","remove","map amendment"], s: "flood",
      q: "What's the difference between a LOMA and an elevation certificate?",
      a: "The elevation certificate documents your building's elevation. A LOMA is FEMA's official determination — supported by that certificate — that the structure sits above the BFE and can be removed from the high-risk flood zone. We prepare the survey data both processes need." },
    { k: ["ve","ae","zone","barrier","coastal high hazard","v zone"], s: "flood",
      q: "Do you handle VE and AE coastal zones?",
      a: "Yes. AE, VE and coastal high-hazard work is routine for our shore crews — Lavallette, Seaside Heights, Seaside Park, Ortley Beach, Mantoloking and Long Beach Island regularly." },
    { k: ["difference","versus","vs","boundary or title","which is which"], s: "boundary",
      q: "Boundary survey vs. title survey — what's the difference?",
      a: "A boundary survey locates your property lines and corners. A title or ALTA survey adds what lenders and title companies require for a transaction — improvements, easements, rights-of-way and title-commitment items. A closing usually needs the title survey; a fence or a dispute usually needs the boundary survey." },
    { k: ["marker","markers","monument","stake","pin","iron","corner","corners"], s: "boundary",
      q: "Will you set markers at my corners?",
      a: "Where appropriate, yes. We recover existing monuments and set new ones at corners that are missing or disturbed, so your lines are physically marked on the ground, not just on paper." },
    { k: ["neighbor","dispute","disagree","argument","court","legal","fence fight","settle"], s: "boundary",
      q: "Can a survey settle a dispute with my neighbor?",
      a: "A sealed boundary survey is the professional, defensible determination of where the line falls based on the records and the evidence on the ground. It's what attorneys and courts rely on, and it frequently resolves disputes before they escalate." },
    { k: ["old records","past survey","history","previous survey","archive","records for my"], s: "boundary",
      q: "Do you have old records for my property?",
      a: "Possibly. We've acquired the survey histories of a number of respected New Jersey surveyors who are no longer in business, which can include records for shore parcels. Give the office your address and we'll check." },
    { k: ["closing","deadline","close","settlement date","next day","attorney"], s: "title",
      q: "Can you meet my closing deadline?",
      a: "It's what we're known for. We've delivered surveys next-day for time-sensitive closings, and attorneys keep us on speed-dial precisely because we produce when the clock is running. Tell us the closing date up front." },
    { k: ["alta","nsps","table a","commercial","institutional","standard"], s: "title",
      q: "What's the difference between a title survey and an ALTA survey?",
      a: "A title survey covers the boundary and improvements needed for a typical residential transaction. An ALTA/NSPS survey follows a national standard with a defined set of optional Table A items, and is commonly required for commercial deals and institutional lenders. We provide both." },
    { k: ["easement","encroach","right of way","right-of-way","overlap"], s: "title",
      q: "Will the survey show easements and encroachments?",
      a: "Yes — locating recorded easements, rights-of-way and any encroachments crossing the line in either direction is a core part of a title survey. Those are exactly the items title companies and lenders want confirmed before closing." },
    { k: ["attorney","title company","lender","bank","work with","coordinate"], s: "title",
      q: "Do you work directly with my attorney and title company?",
      a: "Routinely. We coordinate with attorneys, title agents and lenders and deliver the survey in the form they need, referencing the title commitment, so closing isn't held up by back-and-forth." },
    { k: ["cad","dwg","autocad","architect","engineer","file","digital","format"], s: "topo",
      q: "Can you deliver in CAD for my architect?",
      a: "Yes. Topographic surveys come in formats your design professional can work in directly, along with the sealed plan — no re-drafting, no lost detail." },
    { k: ["datum","navd","vertical","fema datum","tie"], s: "topo",
      q: "Do you tie elevations to FEMA datum?",
      a: "We tie topographic work to NAVD 88, the same vertical reference used for FEMA elevation certificates — useful when the project also involves flood compliance." },
    { k: ["permit","town","municipal","zoning","variance","grading plan","required"], s: "topo",
      q: "Do I need a topographic survey for my permit?",
      a: "Many municipalities require a topographic or grading plan for new construction, additions and stormwater review. Tell us your town and project and we'll confirm exactly what's needed." },
    { k: ["what do you need","plans","provide","bring","schedule"], s: "stakeout",
      q: "What do you need from me to stake a site?",
      a: "Your approved site and building plans, the property survey or control if it exists, and your schedule. We confirm the layout points with you, then stake the site so your crew can build straight to the drawings." },
    { k: ["pile","piling","elevated","foundation","footing","raised"], s: "stakeout",
      q: "Do you handle pile layout for elevated shore homes?",
      a: "Yes. Elevated construction is standard on the barrier island — we lay out pile locations and elevations tied to your approved plans and the flood-elevation requirements for the lot." },
    { k: ["as-built","as built","certificate of occupancy","co ","completion"], s: "stakeout",
      q: "Do you provide as-built surveys?",
      a: "We do. An as-built documents what was actually built relative to the plan and the property lines — often required by the town for a certificate of occupancy or by a lender at completion." },
    { k: ["unit certification","certification","lender","finance","unit"], s: "condo",
      q: "What is a condominium unit certification?",
      a: "It's a surveyor's certification that a built unit conforms to the unit described in the recorded master deed and plans. Lenders frequently require it before financing the purchase of an individual condominium unit." },
    { k: ["master deed","exhibit","regime","conversion","convert"], s: "condo",
      q: "Do you prepare master-deed exhibits and conversions?",
      a: "Yes. We prepare the survey plans and exhibits that define units, common elements and limited common elements for the master deed, and the work required to convert an existing building to condominium ownership — coordinated with your counsel." },
    { k: ["licensed","license","credential","professional","qualified","registered"], s: null,
      q: "Are you licensed in New Jersey?",
      a: "Yes — Lakeland Surveying, Inc. has been a licensed New Jersey land surveying firm since 1972. Every survey is signed and sealed by a licensed NJ Professional Land Surveyor." },
    { k: ["been in business","in business","how long have you","how many years","years in","established","how old is","since 1972","1972","company history","how experienced"], s: null,
      q: "How long have you been in business?",
      a: "Since 1972 — more than fifty years surveying the Jersey Shore, from our Lavallette office. We've also acquired the survey records of several respected NJ firms no longer in business." },
    { k: ["hours","open","office","weekend","saturday"], s: null,
      q: "What are your hours?",
      a: "The office runs standard business hours, but survey work doesn't always. If it's urgent, call " + BIZ.tel + " or text us — deadline jobs get handled." },
    { k: ["where are you","located","office address","based","lavallette"], s: null,
      q: "Where are you located?",
      a: "Our office is in Lavallette, on the Ocean County barrier island. Crews work out from there across nine South Jersey counties." },
    { k: ["free","estimate","no charge","obligation"], s: null,
      q: "Is a quote free?",
      a: "Yes — quotes are free and there's no obligation. I can give you a ballpark range right here in about four taps if you want a number first." }
  ];

  /* ==========================================================================
     4. PRICING MODEL
     MUST STAY IDENTICAL TO /survey-cost-calculator.html — if you change one,
     change the other, or the bot and the calculator will disagree.
     ========================================================================== */
  var BASE  = { low: 450, high: 650 };
  var TIERS = [
    { cap: 5,        low: 150, high: 220 },
    { cap: 20,       low: 95,  high: 165 },
    { cap: Infinity, low: 70,  high: 120 }
  ];
  var TYPE = {
    boundary: { factor: 1.00, baseAdd: 0,   label: "Boundary survey" },
    topo:     { factor: 1.60, baseAdd: 150, label: "Topographic survey" },
    title:    { factor: 2.60, baseAdd: 800, label: "Title / ALTA survey" }
  };
  var FLOOD = { low: 600, high: 900 };
  var RUSH  = 0.30;

  function acreageCost(acres, key) {
    var remaining = acres, cost = 0, prevCap = 0;
    for (var i = 0; i < TIERS.length; i++) {
      var span = TIERS[i].cap - prevCap;
      var used = Math.min(remaining, span);
      if (used <= 0) break;
      cost += used * TIERS[i][key];
      remaining -= used;
      prevCap = TIERS[i].cap;
    }
    return cost;
  }
  function terrainFactor(t) { return 1 + (t / 100) * 0.60; }
  function round25(v) { return Math.round(v / 25) * 25; }
  function money(v) { return "$" + Math.round(v).toLocaleString("en-US"); }

  function estimate(s) {
    // s: {service, acres, terrain, flood, rush}
    if (s.service === "flood") {
      var lo = FLOOD.low, hi = FLOOD.high;
      if (s.rush) { lo *= (1 + RUSH); hi *= (1 + RUSH); }
      return { low: round25(lo), high: round25(hi), rows: floodRows(s) };
    }
    var t = TYPE[s.service] || TYPE.boundary;
    var tf = terrainFactor(s.terrain);
    function side(key, floodVal) {
      var sub = BASE[key] + acreageCost(s.acres, key);
      sub = sub * t.factor + t.baseAdd;
      sub = sub * tf;
      if (s.rush) sub *= (1 + RUSH);
      if (s.flood) sub += floodVal;
      return sub;
    }
    var rows = [
      ["Mobilization & records", money(BASE.low) + "–" + money(BASE.high)],
      [acresLabel(s.acres) + " of fieldwork", money(round25(acreageCost(s.acres, "low"))) + "–" + money(round25(acreageCost(s.acres, "high")))],
      [t.label.replace(" survey", ""), "×" + t.factor.toFixed(2)],
      ["Terrain — " + terrainWord(s.terrain).toLowerCase(), "×" + tf.toFixed(2)]
    ];
    if (s.rush)  rows.push(["Rush / deadline service", "+30%"]);
    if (s.flood) rows.push(["FEMA elevation certificate", money(FLOOD.low) + "–" + money(FLOOD.high)]);
    return { low: round25(side("low", FLOOD.low)), high: round25(side("high", FLOOD.high)), rows: rows };
  }
  function floodRows(s) {
    var rows = [["FEMA elevation certificate", money(FLOOD.low) + "–" + money(FLOOD.high)]];
    if (s.rush) rows.push(["Rush / deadline service", "+30%"]);
    return rows;
  }
  function terrainWord(t) {
    if (t < 20) return "Open";
    if (t < 45) return "Light brush";
    if (t < 70) return "Wooded";
    if (t < 90) return "Heavy woods";
    return "Hilly / wetland";
  }
  function acresLabel(a) {
    if (a < 1) return a + " acre";
    if (a === 1) return "1 acre";
    return a + " acres";
  }

  /* ==========================================================================
     5. MATCHING / PARSING
     ========================================================================== */
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function stripSuffix(s) {
    return s.replace(/\b(township|twp|borough|boro|city|village|town|nj|new jersey)\b/g, "").replace(/\s+/g, " ").trim();
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  var TOWN_INDEX = TOWNS.map(function (t) {
    return { t: t, full: norm(t.name), bare: stripSuffix(norm(t.name)) };
  });

  /* Names that are also ordinary English words — only accepted when the
     sentence actually reads like a location ("in Brick", "Deal NJ", or a
     message that is just the town name). */
  var AMBIGUOUS = { deal:1, wall:1, brick:1, beverly:1, folsom:1, buena:1, highlands:1,
                    shiloh:1, elmer:1, newfield:1, clayton:1, pitman:1, roosevelt:1,
                    tavistock:1, salem:1, berlin:1, audubon:1, oceangate:1, surfcity:1 };
  var STOPWORDS = { survey:1, surveys:1, property:1, please:1, around:1, thanks:1, quote:1,
                    price:1, close:1, closing:1, house:1, acres:1, about:1, needs:1, need:1,
                    cost:1, elevation:1, certificate:1, boundary:1, title:1, there:1, would:1 };
  /* Ambiguous shorthand -> offer the user a choice instead of guessing. */
  var ALIAS_CHOICES = {
    "seaside": ["seaside-heights", "seaside-park"],
    "greenwich": ["greenwich-township-cumberland", "greenwich-township-gloucester"],
    "washington township": ["washington-township-burlington", "washington-township-gloucester"]
  };

  function wordMatch(hay, needle) {
    var idx = hay.indexOf(needle);
    while (idx !== -1) {
      var before = idx === 0 ? " " : hay.charAt(idx - 1);
      var after  = idx + needle.length >= hay.length ? " " : hay.charAt(idx + needle.length);
      if (before === " " && after === " ") return true;
      idx = hay.indexOf(needle, idx + 1);
    }
    return false;
  }
  function locationCue(q, nm) {
    if (q === nm) return true;
    if (q.split(" ").length <= 2) return true;
    var esc = nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b(in|at|near|to|around|for|of|from)\\s+" + esc + "\\b").test(q) ||
           new RegExp("\\b" + esc + "\\s+(nj|new jersey|township|twp|borough|boro|county)\\b").test(q);
  }

  /* Returns a town, or {choices:[towns]} when the input is genuinely ambiguous. */
  function findTown(text) {
    var q = norm(text);
    if (!q) return null;
    var qs = stripSuffix(q);
    var i, k, hits;

    // 1. the whole message is an alias  ("lbi", "manahawkin", "seaside")
    if (ALIAS_CHOICES[q]) return choicesFor(ALIAS_CHOICES[q]);
    if (TOWN_ALIASES[q]) return byslug(TOWN_ALIASES[q]);

    // 2. exact full name  ("Egg Harbor City" and "Neptune Township" must win
    //    over any alias or shorter sibling)
    hits = [];
    for (i = 0; i < TOWN_INDEX.length; i++) if (TOWN_INDEX[i].full === q) hits.push(TOWN_INDEX[i].t);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return { choices: hits };

    // 3. exact name minus the suffix  ("neptune" -> ambiguous, ask)
    hits = [];
    for (i = 0; i < TOWN_INDEX.length; i++) if (TOWN_INDEX[i].bare === qs) hits.push(TOWN_INDEX[i].t);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return { choices: hits };

    // 3b. alias on the suffix-stripped message
    if (ALIAS_CHOICES[qs]) return choicesFor(ALIAS_CHOICES[qs]);
    if (TOWN_ALIASES[qs]) return byslug(TOWN_ALIASES[qs]);

    // 4. name appearing in the sentence, longest first so "Point Pleasant Beach"
    //    beats "Point Pleasant" and "North Wildwood" beats "Wildwood"
    var contained = [];
    for (i = 0; i < TOWN_INDEX.length; i++) {
      var full = TOWN_INDEX[i].full, bare = TOWN_INDEX[i].bare;
      var nm = null;
      if (full.length >= 4 && wordMatch(q, full)) nm = full;
      else if (bare.length >= 4 && wordMatch(q, bare)) nm = bare;
      if (!nm) continue;
      if (AMBIGUOUS[nm.replace(/ /g, "")] && !locationCue(q, nm)) continue;
      contained.push({ t: TOWN_INDEX[i].t, len: nm.length, nm: nm });
    }
    if (contained.length) {
      contained.sort(function (a, b) { return b.len - a.len; });
      var top = contained.filter(function (c) { return c.len === contained[0].len && c.nm === contained[0].nm; });
      if (top.length > 1) return { choices: top.map(function (c) { return c.t; }) };
      return contained[0].t;
    }

    // 5. alias appearing inside a longer sentence
    for (k in ALIAS_CHOICES) {
      if (Object.prototype.hasOwnProperty.call(ALIAS_CHOICES, k) && wordMatch(q, k)) return choicesFor(ALIAS_CHOICES[k]);
    }
    for (k in TOWN_ALIASES) {
      if (Object.prototype.hasOwnProperty.call(TOWN_ALIASES, k) && wordMatch(q, k)) return byslug(TOWN_ALIASES[k]);
    }

    // 6. fuzzy over 1-3 word windows, so a typo survives inside a full sentence
    var words = qs.split(" ").filter(Boolean);
    for (var win = Math.min(3, words.length); win >= 1; win--) {
      for (var st = 0; st + win <= words.length; st++) {
        var frag = words.slice(st, st + win).join(" ");
        if (frag.length < 5 || STOPWORDS[frag]) continue;
        var tol = frag.length >= 6 ? Math.min(3, Math.floor(frag.length / 4)) : 1;
        var best = null, bestD = 99, tie = false;
        for (i = 0; i < TOWN_INDEX.length; i++) {
          var d = Math.min(lev(frag, TOWN_INDEX[i].bare), lev(frag, TOWN_INDEX[i].full));
          if (d < bestD) { bestD = d; best = TOWN_INDEX[i]; tie = false; }
          else if (d === bestD && best && TOWN_INDEX[i].t.slug !== best.t.slug) tie = true;
        }
        if (best && !tie && bestD <= tol && !AMBIGUOUS[best.bare.replace(/ /g, "")]) return best.t;
      }
    }
    return null;
  }
  function choicesFor(slugs) {
    return { choices: slugs.map(byslug).filter(Boolean) };
  }
  function byslug(sl) {
    for (var i = 0; i < TOWNS.length; i++) if (TOWNS[i].slug === sl) return TOWNS[i];
    return null;
  }

  function findService(text) {
    var q = " " + norm(text) + " ";
    var best = null, bestScore = 0;
    SERVICE_ORDER.forEach(function (k) {
      var sv = SERVICES[k], score = 0;
      sv.words.forEach(function (w) {
        if (q.indexOf(" " + norm(w).trim()) !== -1 || q.indexOf(norm(w)) !== -1) score += w.length;
      });
      if (score > bestScore) { bestScore = score; best = sv; }
    });
    return bestScore >= 4 ? best : null;
  }

  /* Acreage from free text: "half acre", ".25 acres", "1.5ac", "50x100",
     "8000 sq ft", "quarter acre lot" */
  function findAcres(text) {
    /* norm() strips punctuation, which would turn "0.25 acres" into 25 acres —
       a 100x pricing error. Use a decimal-safe normalisation here. */
    var q = String(text).toLowerCase()
      .replace(/[^a-z0-9. /]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    var m;
    m = q.match(/(\d{2,5})\s*(?:x|by)\s*(\d{2,5})/);
    if (m) return round1((+m[1] * +m[2]) / 43560);
    m = q.match(/(\d[\d,]*)\s*(?:sq(?:uare)?\s*(?:ft|feet)|sf)\b/);
    if (m) return round1(parseFloat(m[1].replace(/,/g, "")) / 43560);
    m = q.match(/(\d+(?:\.\d+)?)\s*(?:acres?|ac)\b/);
    if (m) return round1(parseFloat(m[1]));
    if (/\bquarter acre|1\/4 acre|\.25 acre/.test(q)) return 0.25;
    if (/\bhalf acre|1\/2 acre|\.5 acre/.test(q)) return 0.5;
    if (/\bthree quarter|3\/4 acre/.test(q)) return 0.75;
    if (/\bten acres?\b/.test(q)) return 10;
    if (/\bfive acres?\b/.test(q)) return 5;
    if (/\btwo acres?\b/.test(q)) return 2;
    if (/\bone acre\b|\ban acre\b/.test(q)) return 1;
    return null;
  }
  function round1(v) { return Math.max(0.05, Math.round(v * 100) / 100); }

  function wantsCost(text) {
    return /how much|cost|price|pricing|charge|fee|rate|quote|estimate|ballpark|expensive|afford|\$/i.test(text);
  }
  function wantsArea(text) {
    return /do you (cover|serve|service|work|go|come)|service area|areas you|cover my|serve my|come out to|travel to|near me|my town/i.test(text);
  }
  function wantsHuman(text) {
    return /talk to|speak to|human|person|call me|someone|representative|rep\b|jack\b/i.test(text);
  }
  function wantsTriage(text) {
    return /which survey|what survey|what kind|what type|which one|not sure|dont know|do i need|help me (pick|choose|decide)/i.test(text);
  }
  function isRush(text) {
    return /rush|asap|urgent|emergency|this week|tomorrow|by (friday|monday|closing)|deadline|expedite|fast|quick|hurry/i.test(text);
  }

  /* ==========================================================================
     6. STYLES
     ========================================================================== */
  var CSS = [
".lk-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:inline-flex;align-items:center;gap:10px;cursor:pointer;background:#E2731B;color:#fff;border:none;border-radius:999px;padding:14px 20px 14px 16px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;letter-spacing:.04em;font-weight:500;box-shadow:0 18px 40px -18px rgba(196,95,18,.75);transition:transform .18s ease,box-shadow .18s ease}",
".lk-fab:hover{transform:translateY(-2px);box-shadow:0 24px 50px -20px rgba(196,95,18,.85)}",
".lk-fab svg{width:20px;height:20px;flex:0 0 auto}",
".lk-fab .lk-close-x{display:none}",
".lk-fab.is-open .lk-open-i{display:none}.lk-fab.is-open .lk-close-x{display:block}.lk-fab.is-open .lk-fab-label{display:none}",
".lk-panel{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:382px;max-width:calc(100vw - 24px);height:600px;max-height:calc(100vh - 110px);background:#FBFAF6;border:1px solid #d9e1e7;border-radius:16px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 30px 70px -30px rgba(7,26,44,.55);font-family:'IBM Plex Sans',system-ui,sans-serif;color:#0B2A45;opacity:0;transform:translateY(10px) scale(.98);transition:opacity .2s ease,transform .2s ease}",
".lk-panel.is-open{display:flex;opacity:1;transform:none}",
"@media (max-width:480px){.lk-panel{right:8px;left:8px;bottom:78px;width:auto;height:calc(100vh - 96px)}.lk-fab{right:14px;bottom:14px;padding:13px 17px 13px 14px}}",
".lk-head{background:#071a2c;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:11px;flex:0 0 auto}",
".lk-head .lk-dot{width:9px;height:9px;border-radius:50%;background:#2f7d5b;box-shadow:0 0 0 4px rgba(47,125,91,.22);flex:0 0 auto}",
".lk-head b{font-family:'Space Grotesk','Segoe UI',sans-serif;font-size:15px;font-weight:600;display:block;line-height:1.2}",
".lk-head span{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:#9fb3c0;display:block;margin-top:3px}",
".lk-restart{margin-left:auto;background:none;border:1px solid rgba(255,255,255,.22);color:#cfe0ea;border-radius:7px;padding:5px 9px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;cursor:pointer}",
".lk-restart:hover{background:rgba(255,255,255,.08)}",
".lk-log{flex:1 1 auto;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:11px;-webkit-overflow-scrolling:touch}",
".lk-msg{max-width:90%;padding:11px 14px;border-radius:13px;font-size:14.5px;line-height:1.52;word-wrap:break-word}",
".lk-bot{align-self:flex-start;background:#fff;border:1px solid #e3e9ee;border-bottom-left-radius:4px}",
".lk-user{align-self:flex-end;background:#2C7DA0;color:#fff;border-bottom-right-radius:4px}",
".lk-msg b{font-weight:600}",
".lk-msg a.lk-inline{color:#2C7DA0;font-weight:600;border-bottom:1px solid rgba(44,125,160,.35);text-decoration:none}",
".lk-msg ul{margin:8px 0 0;padding-left:17px}.lk-msg li{margin:3px 0}",
".lk-typing{align-self:flex-start;background:#fff;border:1px solid #e3e9ee;border-radius:13px;border-bottom-left-radius:4px;padding:13px 15px;display:inline-flex;gap:4px}",
".lk-typing i{width:7px;height:7px;border-radius:50%;background:#9fb3c0;animation:lkb 1s infinite ease-in-out}",
".lk-typing i:nth-child(2){animation-delay:.15s}.lk-typing i:nth-child(3){animation-delay:.3s}",
"@keyframes lkb{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}",
".lk-step{align-self:flex-start;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7d919f;padding:0 4px;display:flex;align-items:center;gap:8px}",
".lk-bar{width:64px;height:3px;border-radius:2px;background:#dfe6eb;overflow:hidden}",
".lk-bar i{display:block;height:100%;background:#E2731B;transition:width .3s ease}",
".lk-opts{align-self:stretch;display:flex;flex-direction:column;gap:7px;margin:-2px 0 2px}",
".lk-opt{width:100%;text-align:left;background:#fff;border:1px solid #cfdae2;color:#0B2A45;border-radius:11px;padding:12px 14px;font-family:inherit;font-size:14px;line-height:1.35;cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .1s ease;min-height:44px}",
".lk-opt:hover{border-color:#2C7DA0;background:#eef5f9}",
".lk-opt:active{transform:scale(.99)}",
".lk-opt small{display:block;font-size:12px;color:#68808f;margin-top:2px;line-height:1.3}",
".lk-opt.lk-alt{background:#f4f1e9;border-style:dashed}",
".lk-back{align-self:flex-start;background:none;border:none;color:#7d919f;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.06em;cursor:pointer;padding:2px 4px}",
".lk-back:hover{color:#2C7DA0}",
".lk-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 14px 8px;flex:0 0 auto}",
".lk-chip{border:1px solid #cfdae2;background:#fff;color:#13395a;cursor:pointer;border-radius:999px;padding:7px 12px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.02em;transition:all .15s ease}",
".lk-chip:hover{border-color:#2C7DA0;background:#e8f1f6}",
".lk-card{align-self:stretch;background:#0C2339;color:#EFE7D4;border-radius:14px;padding:16px;box-shadow:0 18px 40px -22px rgba(12,35,57,.7)}",
".lk-card .lk-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#E2731B;margin:0 0 8px}",
".lk-card .lk-range{font-family:'Space Grotesk','Archivo',sans-serif;font-weight:700;font-size:29px;line-height:1.1;letter-spacing:-.01em;color:#fff}",
".lk-card .lk-sub{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#9fb3c0;margin-top:6px;letter-spacing:.03em;line-height:1.5}",
".lk-ledger{margin-top:13px;border-top:1px solid rgba(239,231,212,.16);padding-top:10px;display:grid;gap:6px}",
".lk-li{display:flex;justify-content:space-between;gap:12px;font-size:12.5px}",
".lk-li .k{color:#b9c9d4}.lk-li .v{font-family:'IBM Plex Mono',monospace;color:#EFE7D4;white-space:nowrap}",
".lk-note{margin-top:12px;font-size:11.5px;line-height:1.5;color:#9fb3c0;border-top:1px solid rgba(239,231,212,.16);padding-top:10px}",
".lk-cta{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}",
".lk-cta a,.lk-cta button{flex:1 1 auto;text-align:center;text-decoration:none;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.03em;padding:11px 10px;border-radius:9px;white-space:nowrap;border:none;cursor:pointer;min-height:42px}",
".lk-cta .lk-call{background:#E2731B;color:#fff}",
".lk-cta .lk-text{background:#0B2A45;color:#fff}",
".lk-cta .lk-quote{background:#C7972F;color:#071a2c;font-weight:600}",
".lk-form{background:#fff;border:1px solid #e3e9ee;border-radius:13px;padding:13px;display:grid;gap:8px}",
".lk-form label{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#5b7184;margin-bottom:-4px}",
".lk-form input,.lk-form select,.lk-form textarea{width:100%;font-family:inherit;font-size:16px;padding:10px;border:1px solid #cfdae2;border-radius:8px;color:#0B2A45;background:#fff}",
".lk-form textarea{resize:vertical;min-height:52px}",
".lk-form button{background:#E2731B;color:#fff;border:none;border-radius:8px;padding:12px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;letter-spacing:.04em;cursor:pointer;font-weight:500;min-height:44px}",
".lk-form button:hover{background:#c45f12}",
".lk-form .lk-err{color:#c0392b;font-size:12px;margin:0}",
".lk-form .lk-pre{background:#f4f7f9;border:1px solid #e3e9ee;border-radius:8px;padding:9px 11px;font-size:12.5px;line-height:1.5;color:#3d566b}",
".lk-foot{flex:0 0 auto;padding:9px 12px;border-top:1px solid #e6ebef;background:#fff;display:flex;gap:8px;align-items:center}",
".lk-foot input{flex:1;border:1px solid #cfdae2;border-radius:999px;padding:11px 15px;font-family:inherit;font-size:16px;color:#0B2A45;min-width:0}",
".lk-foot input:focus{outline:none;border-color:#2C7DA0}",
".lk-foot button{background:#0B2A45;color:#fff;border:none;border-radius:50%;width:40px;height:40px;flex:0 0 auto;cursor:pointer;display:grid;place-items:center}",
".lk-foot button:disabled{opacity:.45;cursor:default}",
".lk-foot button svg{width:17px;height:17px}",
".lk-log::-webkit-scrollbar{width:7px}.lk-log::-webkit-scrollbar-thumb{background:#cfdae2;border-radius:4px}",
"@media (prefers-reduced-motion:reduce){.lk-fab,.lk-panel,.lk-typing i,.lk-opt{transition:none;animation:none}}"
  ].join("\n");

  /* ==========================================================================
     7. DOM SCAFFOLD
     ========================================================================== */
  function el(h) { var d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstChild; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var fab = el('<button class="lk-fab" aria-label="Open chat with Lakeland Surveying"><span class="lk-open-i" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span><span class="lk-close-x" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span><span class="lk-fab-label">Price my survey</span></button>');

  var panel = el('<div class="lk-panel" role="dialog" aria-label="Lakeland Surveying assistant"><div class="lk-head"><span class="lk-dot" aria-hidden="true"></span><div><b>' + BIZ.name + '</b><span>Licensed NJ surveyors · since 1972</span></div><button class="lk-restart" type="button" title="Start over">Restart</button></div><div class="lk-log" aria-live="polite"></div><div class="lk-chips"></div><form class="lk-foot" autocomplete="off"><input type="text" placeholder="Ask anything, or type your town…" aria-label="Type your question" /><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg></button></form></div>');

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log      = panel.querySelector(".lk-log"),
      chipWrap = panel.querySelector(".lk-chips"),
      form     = panel.querySelector(".lk-foot"),
      input    = form.querySelector("input"),
      sendBtn  = form.querySelector("button"),
      restart  = panel.querySelector(".lk-restart");

  /* ==========================================================================
     8. SESSION STATE
     ========================================================================== */
  var S;
  function reset() {
    S = {
      step: null,              // null | service | town | acres | terrain | result
      service: null,           // key into SERVICES
      town: null,              // town object
      acres: null,
      terrain: null,
      flood: false,
      rush: false,
      mode: null,              // "area" when the user is just checking coverage
      history: [],             // for the AI fallback
      aiUsed: false,
      busy: false,
      greeted: false
    };
  }
  reset();

  /* ==========================================================================
     9. RENDER HELPERS
     ========================================================================== */
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function addUser(t) { log.appendChild(el('<div class="lk-msg lk-user">' + esc(t) + "</div>")); scrollDown(); }
  function addBot(html) { var n = el('<div class="lk-msg lk-bot">' + html + "</div>"); log.appendChild(n); scrollDown(); return n; }
  function addNode(n) { log.appendChild(n); scrollDown(); return n; }
  function typing(on) {
    var t = document.getElementById("lk-typing");
    if (on && !t) { t = el('<div class="lk-typing"><i></i><i></i><i></i></div>'); t.id = "lk-typing"; log.appendChild(t); scrollDown(); }
    if (!on && t) t.remove();
  }
  function think(fn, ms) { typing(true); setTimeout(function () { typing(false); fn(); }, ms || 340); }

  function stepBadge(n, total) {
    return addNode(el('<div class="lk-step">Step ' + n + " of " + total + '<span class="lk-bar"><i style="width:' + Math.round((n / total) * 100) + '%"></i></span></div>'));
  }

  /* options: [{label, sub, value}] ; cb(value, label) */
  function addOptions(options, cb, opts) {
    opts = opts || {};
    var wrap = el('<div class="lk-opts"></div>');
    options.forEach(function (o) {
      var b = el('<button class="lk-opt' + (o.alt ? " lk-alt" : "") + '" type="button">' + esc(o.label) + (o.sub ? "<small>" + esc(o.sub) + "</small>" : "") + "</button>");
      b.addEventListener("click", function () {
        if (S.busy) return;
        wrap.remove();
        if (opts.echo !== false) addUser(o.label);
        cb(o.value, o.label);
      });
      wrap.appendChild(b);
    });
    if (opts.back) {
      var bk = el('<button class="lk-back" type="button">← back</button>');
      bk.addEventListener("click", function () { wrap.remove(); opts.back(); });
      wrap.appendChild(bk);
    }
    return addNode(wrap);
  }

  function setChips(list) {
    chipWrap.innerHTML = "";
    (list || []).forEach(function (c) {
      var b = el('<button class="lk-chip" type="button">' + esc(c) + "</button>");
      b.addEventListener("click", function () { if (!S.busy) handle(c, true); });
      chipWrap.appendChild(b);
    });
  }

  var CTA_ROW = '<div class="lk-cta"><a class="lk-call" href="tel:' + BIZ.telHref + '">Call ' + BIZ.tel + '</a><a class="lk-text" href="sms:' + BIZ.sms + '">Text us</a></div>';

  /* ==========================================================================
     10. CONVERSATION — ENTRY
     ========================================================================== */
  function greet() {
    addBot("Hi — I'm Lakeland's assistant. I can price a survey for you in about four taps, tell you which survey you actually need, or check that we cover your town.<br><br>What brings you in?");
    addOptions([
      { label: "How much will it cost?",       sub: "Get a real range in ~4 taps", value: "cost" },
      { label: "Which survey do I need?",      sub: "Answer one question and I'll tell you", value: "triage" },
      { label: "Do you cover my town?",        sub: "256 towns across 9 NJ counties", value: "area" },
      { label: "I have a specific question",   sub: "Flood zones, closings, permits, records", value: "ask" }
    ], function (v) {
      if (v === "cost")   return startCost();
      if (v === "triage") return startTriage();
      if (v === "area")   return askTown("area");
      typing(true);
      setTimeout(function () {
        typing(false);
        addBot("Go ahead — type it below. I know our services, our whole service area, and roughly what things cost.");
        setChips(["Do I need an elevation certificate?", "How fast can you turn a survey?", "What's a boundary survey?"]);
        input.focus();
      }, 300);
    });
  }


  /* findTown may return {choices:[...]}. Ask the user which one they meant. */
  function resolveTown(res, cb) {
    if (!res) return cb(null);
    if (!res.choices) return cb(res);
    think(function () {
      addBot("A couple of places go by that name — which one?");
      addOptions(res.choices.map(function (t) {
        return { label: t.name, sub: t.county + " County", value: t.slug };
      }).concat([{ label: "Neither — I'll type it", value: "__type", alt: true }]), function (v) {
        if (v === "__type") { addBot("Go ahead — type the town below."); input.focus(); return; }
        cb(byslug(v));
      });
    }, 260);
  }

  /* ==========================================================================
     11. FLOW — COST ESTIMATOR
     ========================================================================== */
  function startCost(prefill) {
    S.step = "service";
    if (prefill && prefill.service) S.service = prefill.service;
    if (prefill && prefill.town)    S.town    = prefill.town;
    if (prefill && prefill.acres)   S.acres   = prefill.acres;
    nextCostStep(true);
  }

  function nextCostStep(first) {
    if (!S.service) return askService();
    if (!S.town)    return askTown("cost");
    if (SERVICES[S.service].priceable === "quote") return quoteOnlyService();
    if (SERVICES[S.service].priceable === "flat")  return showResult();   // elevation cert: flat range
    if (S.acres === null)   return askAcres();
    if (S.terrain === null) return askTerrain();
    showResult();
  }

  function askService() {
    S.step = "service";
    think(function () {
      stepBadge(1, 4);
      addBot("What kind of survey is this for?");
      addOptions([
        { label: "FEMA elevation certificate", sub: "Flood insurance, LOMA, elevation permit", value: "flood" },
        { label: "Boundary survey",            sub: "Property lines, corners, fence, addition", value: "boundary" },
        { label: "Title / ALTA survey",        sub: "Buying, refinancing, closing", value: "title" },
        { label: "Topographic survey",         sub: "Grading, drainage, architect or permit", value: "topo" },
        { label: "Construction stakeout",      sub: "Foundation, piles, layout for a build", value: "stakeout" },
        { label: "Condominium survey",         sub: "Unit certification, master deed", value: "condo" },
        { label: "I'm not sure — help me pick", value: "__triage", alt: true }
      ], function (v) {
        if (v === "__triage") return startTriage();
        S.service = v;
        nextCostStep();
      });
    });
  }

  function askTown(mode) {
    S.step = "town";
    think(function () {
      if (mode === "cost") stepBadge(2, 4);
      addBot(mode === "area"
        ? "Which town is the property in? Type it below — or pick one of our core towns."
        : "Where's the property? Type the town below — or pick one of our core towns.");
      addOptions([
        { label: "Lavallette",      value: "lavallette" },
        { label: "Toms River",      value: "toms-river" },
        { label: "Seaside Heights", value: "seaside-heights" },
        { label: "Brick",           value: "brick" },
        { label: "Point Pleasant",  value: "point-pleasant" },
        { label: "Long Beach Island", value: "long-beach-island" },
        { label: "Somewhere else — I'll type it", value: "__type", alt: true }
      ], function (v) {
        if (v === "__type") { addBot("Go ahead — type the town name below."); input.focus(); return; }
        S.town = byslug(v);
        afterTown(mode);
      });
      input.focus();
    });
  }

  function afterTown(mode) {
    var t = S.town;
    if (mode === "area") return showCoverage();
    // inside the cost flow — confirm coverage inline, then continue
    think(function () {
      addBot("Good — <b>" + esc(t.name) + "</b> is in " + esc(t.county) + " County and we survey there regularly." +
        (t.coastal && S.service !== "flood"
          ? " It's also a flood-zone town, so I'll ask about an elevation certificate in a moment."
          : ""));
      nextCostStep();
    }, 280);
  }

  function coverageCopy(t) {
    var s = "Yes — we cover <b>" + esc(t.name) + "</b>, " + esc(t.county) + " County. Lakeland has been a licensed NJ surveying firm since 1972, working out of our Lavallette office across nine South Jersey counties.<br><br>";
    s += t.coastal
      ? "Because " + esc(t.name) + " sits in mapped flood zones, the work we do most there is <b>FEMA elevation certificates</b> — for insurance ratings, LOMAs and elevation permits — alongside boundary and title surveys."
      : "In " + esc(t.name) + " the work is mostly <b>boundary, title and topographic surveys</b> — property lines, closings, and grading or permit plans.";
    s += '<br><br><a class="lk-inline" href="/areas/' + esc(t.slug) + '.html">See our ' + esc(t.name) + " page →</a>";
    return s;
  }

  function askAcres() {
    S.step = "acres";
    think(function () {
      stepBadge(3, 4);
      addBot("Roughly how big is the lot? A ballpark is fine — you can also type dimensions like <b>60x100</b> or a number of acres.");
      addOptions([
        { label: "Typical in-town or shore lot", sub: "Under ¼ acre — most barrier-island lots", value: 0.2 },
        { label: "About ½ acre",                 sub: "Standard suburban lot", value: 0.5 },
        { label: "About 1 acre",                 value: 1 },
        { label: "2 to 5 acres",                 value: 3.5 },
        { label: "5 to 20 acres",                value: 12 },
        { label: "More than 20 acres",           value: 30 },
        { label: "I'll type the exact size",     value: "__type", alt: true }
      ], function (v) {
        if (v === "__type") { addBot("Type it below — acres, square feet, or dimensions like 75x150."); input.focus(); return; }
        S.acres = v;
        nextCostStep();
      }, { back: function () { S.town = null; askTown("cost"); } });
    });
  }

  function askTerrain() {
    S.step = "terrain";
    think(function () {
      stepBadge(4, 4);
      addBot("Last one — what's the site like? This drives how long the crew is on the ground.");
      addOptions([
        { label: "Open and cleared",       sub: "Lawn, sand, pavement — easy sight lines", value: 10 },
        { label: "Some brush and trees",   sub: "Typical residential lot", value: 35 },
        { label: "Wooded",                 sub: "Cutting sight lines to shoot corners", value: 65 },
        { label: "Heavy woods or wetland", sub: "Marsh, dense growth, difficult access", value: 92 }
      ], function (v) {
        S.terrain = v;
        // Coastal upsell before result — this is where area + service + cost meet
        if (S.town && S.town.coastal && S.service !== "flood" && !S.flood) return askFloodAddOn();
        showResult();
      }, { back: function () { S.acres = null; askAcres(); } });
    });
  }

  function askFloodAddOn() {
    think(function () {
      addBot("One thing worth deciding now: <b>" + esc(S.town.name) + "</b> is in a mapped flood zone. If this is tied to a purchase, a refinance, an insurance renewal or an elevation permit, a <b>FEMA elevation certificate</b> is usually wanted alongside the survey — and it's far cheaper to add while our crew is already on site.");
      addOptions([
        { label: "Yes, add the elevation certificate", sub: "Adds $600–$900 · same site visit", value: true },
        { label: "No, just the survey for now",        value: false },
        { label: "What is an elevation certificate?",  value: "__what", alt: true }
      ], function (v) {
        if (v === "__what") {
          think(function () {
            addBot(SERVICES.flood.blurb + '<br><br><a class="lk-inline" href="' + SERVICES.flood.url + '">Read the full page →</a>');
            askFloodAddOn();
          });
          return;
        }
        S.flood = !!v;
        showResult();
      });
    });
  }

  function quoteOnlyService() {
    var sv = SERVICES[S.service];
    think(function () {
      addBot("<b>" + esc(sv.label) + "</b> is priced per project rather than per acre — it depends on the number of trips, the plan set and your build schedule, so any number I threw at you would be fiction.<br><br>" +
        esc(sv.turnaround) + "<br><br>Give me the details and Jack will come back with a real number, usually same day.");
      addOptions([
        { label: "Send my details for a quote", value: "quote" },
        { label: "Call " + BIZ.tel,             value: "call" },
        { label: "Actually, price a different survey", value: "other", alt: true }
      ], function (v) {
        if (v === "quote") return openQuote();
        if (v === "call")  { window.location.href = "tel:" + BIZ.telHref; return; }
        S.service = null; S.acres = null; S.terrain = null;
        askService();
      });
    });
  }

  function showResult() {
    S.step = "result";
    var sv = SERVICES[S.service];
    var r  = estimate({ service: S.service, acres: S.acres || 0.2, terrain: S.terrain === null ? 20 : S.terrain, flood: S.flood, rush: S.rush });

    think(function () {
      var sub = [sv.label];
      if (S.town) sub.push(S.town.name);
      if (S.acres && sv.priceable === "calc") sub.push(acresLabel(S.acres));
      if (S.terrain !== null && sv.priceable === "calc") sub.push(terrainWord(S.terrain).toLowerCase() + " terrain");
      if (S.flood) sub.push("+ elevation certificate");
      if (S.rush)  sub.push("rush");

      var ledger = r.rows.map(function (row) {
        return '<div class="lk-li"><span class="k">' + esc(row[0]) + '</span><span class="v">' + esc(row[1]) + "</span></div>";
      }).join("");

      var card = el('<div class="lk-card">' +
        '<p class="lk-eyebrow">Estimated range</p>' +
        '<div class="lk-range">' + money(r.low) + " – " + money(r.high) + "</div>" +
        '<div class="lk-sub">' + esc(sub.join(" · ")) + "</div>" +
        '<div class="lk-ledger">' + ledger + "</div>" +
        '<div class="lk-note">Planning estimate, not a formal quote. Final pricing depends on site conditions, records research and scope, and is confirmed by a licensed NJ Professional Land Surveyor after review.</div>' +
        '<div class="lk-cta"><button class="lk-quote" type="button" data-act="quote">Lock in a real quote →</button></div>' +
        CTA_ROW +
        "</div>");
      addNode(card);
      card.querySelector('[data-act="quote"]').addEventListener("click", openQuote);

      var opts = [];
      if (!S.rush)  opts.push({ label: "I'm on a deadline", sub: "Rush scheduling — adds about 30%", value: "rush" });
      if (S.rush)   opts.push({ label: "Remove the rush", value: "unrush" });
      if (!S.flood && S.service !== "flood") opts.push({ label: "Add a FEMA elevation certificate", sub: "+$600–$900 on the same visit", value: "addflood" });
      if (S.flood)  opts.push({ label: "Remove the elevation certificate", value: "unflood" });
      if (sv.priceable === "calc") opts.push({ label: "Change the lot size", value: "acres" });
      opts.push({ label: "Price a different survey", value: "service" });
      opts.push({ label: "What's actually included?", value: "included", alt: true });

      addOptions(opts, function (v) {
        if (v === "rush")     { S.rush = true;   return showResult(); }
        if (v === "unrush")   { S.rush = false;  return showResult(); }
        if (v === "addflood") { S.flood = true;  return showResult(); }
        if (v === "unflood")  { S.flood = false; return showResult(); }
        if (v === "acres")    { S.acres = null;  S.terrain = null; return askAcres(); }
        if (v === "service")  { S.service = null; S.acres = null; S.terrain = null; S.flood = false; return askService(); }
        if (v === "included") {
          think(function () {
            addBot("<b>" + esc(sv.label) + " — what you get</b><ul>" +
              sv.includes.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
              "</ul><br><b>Timing.</b> " + esc(sv.turnaround) +
              '<br><br><a class="lk-inline" href="' + sv.url + '">Full ' + esc(sv.short.toLowerCase()) + " page →</a>");
            setChips(["Lock in a real quote", "Price a different survey", "Do you cover my town?"]);
          });
        }
      }, { echo: false });

      setChips(["Lock in a real quote", "Text us", "Full calculator"]);
    }, 480);
  }

  /* ==========================================================================
     12. FLOW — TRIAGE ("which survey do I need?")
     ========================================================================== */
  function startTriage() {
    S.step = "triage";
    think(function () {
      addBot("Easy enough. What are you actually trying to get done?");
      addOptions([
        { label: "Lower my flood insurance, or FEMA asked for something", value: "flood" },
        { label: "Buying, selling or refinancing a property",             value: "title" },
        { label: "Fence, shed, pool, addition — or a neighbor issue",     value: "boundary" },
        { label: "My architect, engineer or town needs a plan",           value: "topo" },
        { label: "I'm building now and need the site staked",             value: "stakeout" },
        { label: "It's a condo unit or a master deed",                    value: "condo" },
        { label: "Something else entirely",                               value: "__other", alt: true }
      ], function (v) {
        if (v === "__other") {
          think(function () {
            addBot("No problem — describe the situation below in your own words and I'll point you at the right survey.");
            input.focus();
          });
          return;
        }
        S.service = v;
        var sv = SERVICES[v];
        think(function () {
          addBot("You want a <b>" + esc(sv.label) + "</b>.<br><br>" + esc(sv.blurb) +
            '<br><br><a class="lk-inline" href="' + sv.url + '">Full details →</a>');
          addOptions([
            { label: "How much would that cost?", value: "cost" },
            { label: "What's included?",          value: "inc" },
            { label: "Have someone call me",      value: "quote" }
          ], function (x) {
            if (x === "cost") { S.acres = null; S.terrain = null; return nextCostStep(); }
            if (x === "quote") return openQuote();
            think(function () {
              addBot("<b>" + esc(sv.label) + " — what you get</b><ul>" +
                sv.includes.map(function (y) { return "<li>" + esc(y) + "</li>"; }).join("") +
                "</ul><br><b>Timing.</b> " + esc(sv.turnaround));
              addOptions([
                { label: "How much would that cost?", value: "cost" },
                { label: "Have someone call me",      value: "quote" }
              ], function (y) { y === "cost" ? nextCostStep() : openQuote(); });
            });
          });
        }, 420);
      });
    });
  }

  /* ==========================================================================
     13. QUOTE FORM — pre-filled with everything gathered
     ========================================================================== */
  function summaryLine() {
    var bits = [];
    if (S.service) bits.push(SERVICES[S.service].label);
    if (S.town)    bits.push(S.town.name + ", " + S.town.county + " County");
    if (S.acres)   bits.push(acresLabel(S.acres));
    if (S.terrain !== null) bits.push(terrainWord(S.terrain).toLowerCase() + " terrain");
    if (S.flood)   bits.push("+ elevation certificate");
    if (S.rush)    bits.push("rush / deadline");
    return bits.join(" · ");
  }

  function openQuote() {
    var summary = summaryLine();
    var est = "";
    if (S.service && SERVICES[S.service].priceable !== "quote" && (S.acres !== null || SERVICES[S.service].priceable === "flat")) {
      var r = estimate({ service: S.service, acres: S.acres || 0.2, terrain: S.terrain === null ? 20 : S.terrain, flood: S.flood, rush: S.rush });
      est = money(r.low) + "–" + money(r.high);
    }

    var serviceOptions = SERVICE_ORDER.map(function (k) {
      return '<option value="' + k + '"' + (S.service === k ? " selected" : "") + ">" + esc(SERVICES[k].label) + "</option>";
    }).join("") + '<option value="other"' + (S.service ? "" : " selected") + ">Not sure / other</option>";

    var node = el('<div class="lk-msg lk-bot" style="max-width:100%">' +
      '<b style="font-family:\'Space Grotesk\',sans-serif;font-size:14px;display:block;margin-bottom:8px">Get a real quote</b>' +
      (summary ? '<div class="lk-pre" style="margin-bottom:9px"><b>Your job so far:</b><br>' + esc(summary) + (est ? "<br>Estimated " + est : "") + "</div>" : "") +
      '<form class="lk-form" novalidate>' +
      "<label>Name</label><input name=\"name\" required placeholder=\"Your name\" autocomplete=\"name\" />" +
      "<label>Phone</label><input name=\"phone\" required placeholder=\"Best number to reach you\" inputmode=\"tel\" autocomplete=\"tel\" />" +
      "<label>Email (optional)</label><input name=\"email\" placeholder=\"you@email.com\" inputmode=\"email\" autocomplete=\"email\" />" +
      "<label>Property address or town</label><input name=\"location\" required placeholder=\"Street address or town, NJ\" value=\"" + esc(S.town ? S.town.name + ", NJ" : "") + '" />' +
      "<label>What do you need?</label><select name=\"service\">" + serviceOptions + "</select>" +
      "<label>Deadline or anything else</label><textarea name=\"message\" placeholder=\"Closing date, permit deadline, lot size, questions…\"></textarea>" +
      '<p class="lk-err" style="display:none"></p>' +
      "<button type=\"submit\">Send to Lakeland</button>" +
      "</form></div>");

    addNode(node);
    setChips([]);

    var qform = node.querySelector("form"),
        err   = node.querySelector(".lk-err"),
        btn   = node.querySelector("button");

    qform.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      ["name", "phone", "email", "location", "service", "message"].forEach(function (k) {
        var n = qform.querySelector('[name="' + k + '"]');
        data[k] = n ? n.value.trim() : "";
      });
      if (!data.name || !data.phone || !data.location) {
        err.textContent = "Please add your name, phone and the property location.";
        err.style.display = "block";
        return;
      }
      err.style.display = "none";
      btn.disabled = true;
      btn.textContent = "Sending…";

      data.service = (SERVICES[data.service] && SERVICES[data.service].label) || data.service;
      data.job_summary = summary || "(not specified)";
      data.chat_estimate = est || "(none generated)";
      data.county = S.town ? S.town.county + " County" : "";
      data.lot_size = S.acres ? acresLabel(S.acres) : "";
      data.site_conditions = S.terrain !== null ? terrainWord(S.terrain) : "";
      data.rush = S.rush ? "YES — deadline driven" : "no";
      data.source_page = location.pathname;
      data._subject = "Chat quote — " + data.service + (S.town ? " — " + S.town.name : "");

      fetch(BIZ.formspree, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (r) { if (!r.ok) throw new Error("bad"); })
        .then(function () {
          node.remove();
          addBot("Got it — thank you, " + esc(data.name.split(" ")[0]) + ". Your request is in with everything we talked through, so nobody's going to make you repeat it. We'll reach out to " + esc(data.phone) + " shortly." +
            "<br><br>Need it faster than that? Call " + BIZ.tel + " and ask for Jack." + CTA_ROW);
          setChips(["Price another survey", "Do you cover my town?"]);
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Send to Lakeland";
          err.innerHTML = "That didn't go through. Please call <b>" + BIZ.tel + "</b> or text us instead.";
          err.style.display = "block";
        });
    });
  }

  /* ==========================================================================
     14. FREE-TEXT HANDLER
     ========================================================================== */
  function handle(text, fromChip) {
    if (S.busy) return;
    /* typing instead of tapping should retire any buttons still on screen,
       so old choices can't be tapped out of context later */
    Array.prototype.forEach.call(log.querySelectorAll(".lk-opts"), function (n) { n.remove(); });
    addUser(text);
    S.history.push({ role: "user", content: text });

    // chips that map straight to actions
    if (/^lock in a real quote$/i.test(text) || /^have someone call me$/i.test(text)) return openQuote();
    if (/^price another survey$/i.test(text) || /^price a different survey$/i.test(text)) {
      S.service = null; S.acres = null; S.terrain = null; S.flood = false; S.rush = false;
      return askService();
    }
    if (/^full calculator$/i.test(text)) { window.open(BIZ.calculator, "_blank"); return addBot('Opened the full calculator — it has a live slider if you want to play with the numbers. <a class="lk-inline" href="' + BIZ.calculator + '">Survey cost calculator →</a>'); }
    if (/^text us$/i.test(text)) { window.location.href = "sms:" + BIZ.sms; return; }

    // mid-flow typed answers take priority over intent detection
    if (S.step === "town") {
      var t0 = findTown(text);
      if (t0) return resolveTown(t0, function (t) {
        if (!t) return;
        S.town = t;
        afterTown(S.mode === "area" ? "area" : "cost");
      });
      return think(function () {
        addBot("I couldn't place that one. Try the town name on its own — like <b>Lavallette</b>, <b>Stafford</b> or <b>Ship Bottom</b>. If it's a section rather than a town (Normandy Beach, Holgate, Bayville), give me the nearest township and I'll take it from there.");
      });
    }
    if (S.step === "acres") {
      var a0 = findAcres(text);
      if (a0) { S.acres = a0; addBot("Got it — working from <b>" + acresLabel(a0) + "</b>."); return nextCostStep(); }
      return think(function () {
        addBot("Give me a number I can work with — <b>0.25</b>, <b>2 acres</b>, <b>8000 sq ft</b>, or dimensions like <b>60x100</b>.");
      });
    }

    // slot harvesting from anywhere
    var svc  = findService(text);
    var townRes = findTown(text);
    var town = townRes && !townRes.choices ? townRes : null;
    var ac   = findAcres(text);
    if (town) S.town = town;
    if (ac)   S.acres = ac;

    /* Ambiguous town name — settle it before anything else. */
    if (townRes && townRes.choices) {
      if (svc) S.service = svc.key;
      return resolveTown(townRes, function (t) {
        if (!t) return;
        S.town = t;
        if (wantsCost(text) || S.service) return nextCostStep();
        showCoverage();
      });
    }
    if (isRush(text)) S.rush = true;

    if (wantsHuman(text)) return openQuote();

    if (wantsCost(text)) {
      if (svc) S.service = svc.key;
      var known = [];
      if (S.service) known.push(SERVICES[S.service].label.toLowerCase());
      if (S.town)    known.push(S.town.name);
      if (S.acres)   known.push(acresLabel(S.acres));
      return think(function () {
        if (known.length) addBot("Let's price it. I've got " + esc(known.join(" · ")) + " — I'll fill in the rest.");
        nextCostStep();
      });
    }

    if (wantsArea(text)) {
      if (S.town) return showCoverage();
      S.mode = "area";
      return askTown("area");
    }

    if (wantsTriage(text) && !svc) return startTriage();

    // FAQ bank
    var f = matchFAQ(text, svc);
    if (f) {
      return think(function () {
        var extra = "";
        if (f.s) extra = '<br><br><a class="lk-inline" href="' + SERVICES[f.s].url + '">More on ' + esc(SERVICES[f.s].short.toLowerCase()) + "s →</a>";
        addBot(esc(f.a).replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>") + extra);
        if (f.s) S.service = S.service || f.s;
        addOptions([
          { label: "What would that cost?", value: "cost" },
          { label: "Have someone call me",  value: "quote" }
        ], function (v) { v === "cost" ? nextCostStep() : openQuote(); }, { echo: false });
      }, 400);
    }

    // known service, no specific question → explain it
    if (svc) {
      S.service = svc.key;
      return think(function () {
        addBot("<b>" + esc(svc.label) + "</b><br><br>" + esc(svc.blurb) +
          '<br><br><a class="lk-inline" href="' + svc.url + '">Full details →</a>');
        addOptions([
          { label: "What would that cost?", value: "cost" },
          { label: "What's included?",      value: "inc" },
          { label: "Have someone call me",  value: "quote" }
        ], function (v) {
          if (v === "cost") return nextCostStep();
          if (v === "quote") return openQuote();
          think(function () {
            addBot("<b>" + esc(svc.label) + " — what you get</b><ul>" +
              svc.includes.map(function (y) { return "<li>" + esc(y) + "</li>"; }).join("") +
              "</ul><br><b>Timing.</b> " + esc(svc.turnaround));
          });
        }, { echo: false });
      }, 400);
    }

    // they named a town but nothing else landed — confirm coverage and offer
    // the next useful thing rather than burning an AI call
    if (town) return showCoverage();

    // last resort: one AI call per session, then the menu
    askAI(text);
  }

  function showCoverage() {
    S.mode = "area";
    think(function () {
      addBot(coverageCopy(S.town));
      addOptions([
        { label: "Price a survey here",     value: "cost" },
        { label: "Which survey do I need?", value: "triage" },
        { label: "Have someone call me",    value: "quote" }
      ], function (v) {
        if (v === "cost")   { S.step = null; return startCost({ town: S.town }); }
        if (v === "triage") return startTriage();
        openQuote();
      });
    });
  }

  function matchFAQ(text, svc) {
    var q = " " + norm(text) + " ";
    var best = null, bestScore = 0;
    FAQ.forEach(function (f) {
      var score = 0;
      f.k.forEach(function (w) { if (q.indexOf(norm(w)) !== -1) score += norm(w).length; });
      if (score === 0) return;
      if (svc && f.s === svc.key) score += 6;
      if (score > bestScore) { bestScore = score; best = f; }
    });
    return bestScore >= 7 ? best : null;
  }

  function askAI(text) {
    if (S.aiUsed) return fallbackMenu();
    S.aiUsed = true;
    S.busy = true; sendBtn.disabled = true; typing(true);

    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; finish(null); } }, BIZ.aiTimeoutMs);

    function finish(reply) {
      clearTimeout(timer);
      typing(false);
      S.busy = false; sendBtn.disabled = false;
      if (reply) {
        S.history.push({ role: "assistant", content: reply });
        addBot(esc(reply).replace(/\n/g, "<br>"));
        addOptions([
          { label: "Price my survey", value: "cost" },
          { label: "Have someone call me", value: "quote" }
        ], function (v) { v === "cost" ? nextCostStep() : openQuote(); }, { echo: false });
      } else {
        fallbackMenu();
      }
    }

    fetch(BIZ.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: S.history.slice(-8) })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!done) { done = true; finish(d && d.reply ? d.reply : null); } })
      .catch(function () { if (!done) { done = true; finish(null); } });
  }

  function fallbackMenu() {
    addBot("That one's better answered by a person — Jack knows the parcels around here better than any script does. In the meantime, here's what I can do on the spot:");
    addOptions([
      { label: "Price a survey",          sub: "Real range in about four taps", value: "cost" },
      { label: "Which survey do I need?", value: "triage" },
      { label: "Do you cover my town?",   value: "area" },
      { label: "Have Jack call me",       value: "quote" }
    ], function (v) {
      if (v === "cost")   return startCost();
      if (v === "triage") return startTriage();
      if (v === "area")   { S.mode = "area"; return askTown("area"); }
      openQuote();
    }, { echo: false });
  }

  /* ==========================================================================
     15. WIRING
     ========================================================================== */
  function openPanel() {
    panel.classList.add("is-open");
    fab.classList.add("is-open");
    if (!S.greeted) { S.greeted = true; greet(); }
    setTimeout(function () { if (window.innerWidth > 640) input.focus(); }, 80);
  }
  function closePanel() {
    panel.classList.remove("is-open");
    fab.classList.remove("is-open");
  }

  fab.addEventListener("click", function () {
    panel.classList.contains("is-open") ? closePanel() : openPanel();
  });
  restart.addEventListener("click", function () {
    reset();
    log.innerHTML = "";
    setChips([]);
    S.greeted = true;
    greet();
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v || S.busy) return;
    input.value = "";
    handle(v);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) closePanel();
  });

  /* Any element on the site with data-lk-open="1" (or href="#chat") opens the
     assistant — handy for adding "Ask about pricing" links into page copy. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('[data-lk-open],a[href="#chat"]');
    if (!a) return;
    e.preventDefault();
    openPanel();
    var pre = a.getAttribute("data-lk-open");
    if (pre === "cost" && !S.step) setTimeout(function () { startCost(); }, 120);
  });
})();
