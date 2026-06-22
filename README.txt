LAKELAND SURVEYING — FULL DEPLOY BUNDLE (FOUND)
Supersedes the earlier "areas-update" and "canonical-fix" packages — this is the
current state of every changed file. Upload these, overwriting, in one pass.

WHAT CHANGED (all three jobs, consolidated)
  1. 75 NEW town pages (53 Monmouth + 22 Ocean) added under /areas/.
  2. Canonical/domain fix — every interior page now self-references
     landsurveyingoceancountynj.com (was wrongly lakelandsurveying.com).
  3. Service-Areas nav expanded site-wide into a county-grouped mega-menu
     listing all 88 towns (was the curated 13), with "All [County]" links.

UPLOAD MAP (GitHub web UI -> Netlify auto-deploy)
  assets/styles.css        -> /assets/   (adds the mega-menu styles)
  sitemap.xml              -> /           (102 URLs incl. the 75 new towns)
  areas/  (89 files)       -> /areas/     (88 town pages + rebuilt hub index.html)
  services/ (7 files)      -> /services/
  index, about, blog, contact, survey-cost-calculator, survey-histories
                           -> /           (root pages — nav update)
  Confirm overwrites on existing files. Netlify redeploys in ~30s.

AFTER DEPLOY
  - Resubmit sitemap.xml in Google Search Console.
  - Run a few new URLs + a couple of canonical-fixed URLs through URL Inspection
    to prompt a recrawl.

NOTES
  - Two distinct "Ocean Township" pages: ocean-township-oakhurst (Monmouth) and
    ocean-township-waretown (Ocean), cross-noted on each.
  - Orphaned duplicate town/service files at the repo ROOT (e.g. /lavallette.html,
    /boundary-surveys.html) are NOT in nav or sitemap and were left untouched —
    safe to delete later for tidiness.
  - land-survey-calculator.html (root) appears to be an older orphan of the cost
    calculator with no standard nav; left as-is.
