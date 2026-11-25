# PCI Ingest corrected ZIP — install v2

The original `integration.patch` failed because its synthetic hunk locations did not match the real updated repository files. This package replaces that patch with **exact, bounded text substitutions** and a full-file preflight. It does not rewrite the repository or use bulk `git add`.

## PowerShell from your PCI_Clean folder

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\pci-ingest-two-phases-FIXED.zip" -DestinationPath ".\pci-ingest-two-phases-FIXED" -Force
& ".\pci-ingest-two-phases-FIXED\apply-update.ps1"
```

Prerequisites: branch `main`, target tracked files clean, Node dependencies/install available. The tool safely accepts untracked new target files only when byte-identical to the packaged version. It stops before writing when any target differs or anchor is missing. It runs `npm --prefix Module_1_Adapter run check` before committing/pushing. A failure leaves edited files uncommitted and their originals backed up in the system temp directory.

**Does not enable HTTP collection by default.** Existing ranking inputs and public website remain unchanged unless feature flags are enabled after validation. The package is an incremental two-phase backend update, not proof that live HTTP providers or the Fifi demo pages are production-integrated.
