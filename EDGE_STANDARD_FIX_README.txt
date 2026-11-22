SSM_Tool v2.2 - STANDARD MICROSOFT EDGE LAUNCHER FIX (Windows)

Why: Google showed "This browser or app may not be secure" and an Edge banner
saying "--no-sandbox". The earlier Edge button was using Playwright.

Fix: The Edge button now starts the installed Microsoft Edge as a normal,
non-automated browser with a separate persistent profile for each SSM proxy.
It does not supply --no-sandbox, remote debugging or automation flags.
SSM_Tool still uses its localhost-only proxy relay to authenticate with
Rayobyte without placing your password on the Edge command line.

HOW TO UPDATE YOUR CURRENT INSTALL:
1) Close all SSM_Tool browsers. In its server CMD window press Ctrl+C.
2) BACK UP your current SSM_Tool/data directory. NEVER delete it.
3) Extract this update ZIP directly into the existing SSM_Tool folder,
   replacing app.py, browser_launch.py and static/app.js.
4) Start start_windows.bat again. Refresh dashboard using Ctrl+F5.
5) On US-Test-01, click Edit to reenter your proxy password if needed,
   then click Save & test proxy.
6) Click "Open Edge (US proxy)".
7) The new *normal Edge* window opens two tabs. The first shows
   api.ipify.org?format=json - confirm it displays the assigned US proxy IP.
   The other opens YouTube. You may then sign in manually.

LIMITATIONS:
- The backend prechecks the proxy exit IP before launching Edge. Since
  this is ordinary Edge, SSM_Tool cannot automatically inspect the
  address inside it; you MUST check the first tab yourself.
- A valid US proxy does not guarantee Google will allow sign-in.
  Google may still reject certain IPs, account or security conditions.
- Chromium's original Playwright button is unchanged, for QA automation.
- Only one normal Edge window per SSM proxy profile can be launched at a time.
- A FRESH Edge profile is created in data/browser_profiles/<id>_edge_standard.
  Existing browser profiles, proxy entries, comments and test data are not deleted.
- Never copy proxy credentials into command-line arguments or public logs.
- No added purchases or cloud services are required.

This patch's automated tests cover command construction and proxy precheck.
A live Edge login on your computer cannot be guaranteed by these tests.
