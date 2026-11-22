PCI five-tab header deployment - narrow patch

Changes only these tracked paths:
- Module_2_Public_Website/src/components/SiteHeader.tsx
- Module_2_Public_Website/tests/public-header-template.test.mjs
- Module_2_Public_Website/tests/sleek-navigation.test.mjs

Does not remove /rankings or /creators routes, creator profiles, ranking data, or API. Untracked backups and other files are untouched.

In PowerShell, from C:\Users\sasph\Documents\PCI_Clean:

Expand-Archive "$env:USERPROFILE\Downloads\PCI_NAV_FIVE_TABS_ONE_CLICK.zip" -DestinationPath "$env:USERPROFILE\Downloads" -Force
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\PCI_NAV_FIVE_TABS_ONE_CLICK\DEPLOY_PCI_FIVE_TABS.ps1" -RepoRoot "$PWD"

It checks branch, remote, staged changes, applies the patch, runs the full public website check, stages exactly three files, commits and pushes origin/main. Any failed step stops. Deployment requires Hostinger to have GitHub auto-deployment enabled.
