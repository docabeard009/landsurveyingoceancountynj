// geo/clients/lakeland.mjs
// One client = one config file. To add a client later, copy this file, edit the
// fields, and register it in geo/clients/index.mjs. Nothing else changes.

export default {
  slug: 'lakeland',
  brand: 'Lakeland Surveying',
  brandAliases: ['Lakeland Surveying, Inc', 'Lakeland Surveying Inc', 'Lakeland Land Surveying'],
  clientDomain: 'landsurveyingoceancountynj.com',

  // Fill these in with the firms you actually compete with for these queries.
  // Leave empty to just track "am I invisible" — competitor tracking is a bonus
  // layer that upgrades a gap from "open" to "high priority".
  competitors: [
    // 'somecompetitor.com',
  ],

  // Set enabled:false (or just remove the env key) to skip an assistant.
  // Bump model strings here when providers ship newer versions.
  assistants: {
    perplexity: { enabled: true, model: 'sonar' },
    openai: { enabled: true, model: 'gpt-5.5' },
    gemini: { enabled: true, model: 'gemini-2.5-flash' },
    claude: { enabled: true, model: 'claude-sonnet-5' },
  },

  // The query universe — phrased the way a homeowner or contractor would type
  // into an AI assistant. Reconcile against your existing 26-query tracker.
  clusters: [
    {
      id: 'flood-elevation',
      label: 'Flood & Elevation (the moat)',
      queries: [
        'who can do an elevation certificate in Ocean County NJ',
        'land surveyor for FEMA flood zone determination near Lavallette NJ',
        'how do I get a LOMA in Toms River NJ',
        'elevation certificate cost for a shore house in New Jersey',
        'AE flood zone survey Seaside Heights NJ',
      ],
    },
    {
      id: 'ocean-county',
      label: 'Ocean County',
      queries: [
        'best land surveyor in Ocean County NJ',
        'property boundary survey Toms River NJ',
        'land surveyor near me Brick NJ',
        'how much does a property survey cost in Ocean County NJ',
      ],
    },
    {
      id: 'monmouth-county',
      label: 'Monmouth County',
      queries: [
        'land surveyor Monmouth County NJ',
        'boundary survey Wall Township NJ',
        'property line survey near Freehold NJ',
      ],
    },
    {
      id: 'camden-county',
      label: 'Camden County (high demand from chat)',
      queries: [
        'land surveyor Camden County NJ',
        'property survey Cherry Hill NJ',
        'boundary survey cost Camden County NJ',
      ],
    },
    {
      id: 'gloucester-county',
      label: 'Gloucester County (high demand from chat)',
      queries: [
        'land surveyor Gloucester County NJ',
        'boundary survey Washington Township NJ',
        'property survey Deptford NJ',
      ],
    },
    {
      id: 'service-types',
      label: 'Service types',
      queries: [
        'what is a topographic survey and who does it in South Jersey',
        'title survey for a real estate closing in New Jersey',
        'subdivision survey New Jersey surveyor',
        'ALTA survey New Jersey commercial property',
        'how to find property corners with a surveyor NJ',
      ],
    },
  ],
};
