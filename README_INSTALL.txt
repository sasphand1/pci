PAKISTAN CREATOR INDEX — REVIEWED CLAUDE UI UPDATE

This package adapts the 10-file pci-ui.zip supplied in the chat.
Only Module_2_Public_Website is affected. The existing public APIs, database and
admin panel are untouched. The @pci/ui CSS package is shared with Module 3:
its design tokens may visually affect Module 3 when installed together.

WHAT WAS CORRECTED
* White leaderboard styling retained.
* Slim typography and centered Explore / Top 100 / Live Wall navigation.
* More deliberate crown clearance in carousel CSS, same real-data profile links.
* Progress indicator uses styled HTML <progress>, no inline CSS in components.
* Kept centralized styles.css imports and real API calls.

REQUIREMENTS
* Existing repository: C:\Users\sasph\Documents\PCI_Clean
* Previously installed Premium UI V2/V3 (including public/images/islamabad-dusk.webp)
* PowerShell and Node.js 22+ on Windows
* No npm ci required for the script's tests.

INSTALL — Windows PowerShell (ZIP should be in Downloads)

cd "C:\Users\sasph\Documents\PCI_Clean"
Expand-Archive -Path "$env:USERPROFILE\Downloads\PCI_Claude_UI_Reviewed_Installer_v2.zip" -DestinationPath "$env:TEMP\pci-reviewed-ui" -Force
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\pci-reviewed-ui\INSTALL_PCI_UI.ps1" -ProjectRoot "C:\Users\sasph\Documents\PCI_Clean"

Installer validates every path and the hero image, backs up the 10 ORIGINAL
files in PCI_UI_Backups\before-claude-ui-<timestamp>, installs precisely those
10 files, then runs the project's dependency-free Node tests. It restores
replaced files automatically if installation/tests fail.

PUSH ONLY AFTER THE SCRIPT SUCCEEDS:

cd "C:\Users\sasph\Documents\PCI_Clean"
git status --short
git add Module_2_Public_Website
git commit -m "style: refine PCI premium UI from reviewed Claude design"
git push origin main

Hostinger should build the new commit. Check Build/Deployments and the live
homepage. Full Next.js build, real-browser layout, and Hostinger behavior
remain to be verified against your actual current repository and hosting.

MANUAL ROLLBACK (if you dislike the appearance)
Copy the ten files from the printed PCI_UI_Backups path into the matching
locations under Module_2_Public_Website. Or use git revert for a pushed commit.

NO data, API keys, env files, package-locks, or other modules are included.
