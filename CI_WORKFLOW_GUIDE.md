# CI Workflow Guide

## Overview

This project uses a production-grade CI workflow that behaves differently for `dev` and `main` branches.

## Workflow Triggers

The CI workflow runs on:
- Push to `dev` branch
- Push to `main` branch
- Pull requests targeting `dev` or `main`
- Manual workflow dispatch via GitHub Actions UI

## Branch-Specific Behavior

### Dev Branch (`dev`)

**Purpose:** Continuous validation of development work

**Steps:**
1. ✅ Install dependencies (`pnpm install --frozen-lockfile`)
2. ✅ Build all packages (`pnpm run build` via turbo)
3. ✅ Run all tests (`pnpm run test`)
4. ✅ Verify package outputs (dist directories and type declarations)

**Failure Behavior:** Fail fast on any error

---

### Main Branch (`main`)

**Purpose:** Release readiness validation (NO automatic publishing)

**Steps:**
1. ✅ Everything from `dev` branch
2. ✅ **Changeset status check** - Verify changesets are properly configured
3. ✅ **Uncommitted changes check** - Ensure build produces no uncommitted files
4. ✅ **Publish dry run** - Validate that packages can be published

**Important:** The workflow does NOT actually publish packages. It only validates release readiness.

---

## Changeset Workflow

### What are Changesets?

Changesets are markdown files that describe changes to packages. They're used to:
- Document changes made to packages
- Automatically determine version bumps (major, minor, patch)
- Generate changelogs
- Coordinate versioning across the monorepo

### Creating a Changeset

When you make changes to publishable packages (`@timeline/core`, `@timeline/react`, `@timeline/ui`):

```bash
# Create a changeset
pnpm changeset

# Follow the interactive prompts:
# 1. Select which packages changed (space to select, enter to confirm)
# 2. Choose bump type (major/minor/patch) for each package
# 3. Write a summary of the changes
```

This creates a file in `.changeset/` with your change description.

### Changeset Example

```markdown
---
"@timeline/core": minor
"@timeline/ui": patch
---

Add region marker creation UI and fix clip snapping behavior
```

### Versioning Packages

```bash
# Consume changesets and update package versions
pnpm changeset:version

# This will:
# - Update package.json versions
# - Update CHANGELOG.md files
# - Delete consumed changeset files
```

### Publishing (Manual)

```bash
# Dry run to verify what would be published
pnpm changeset:publish --dry-run

# Actually publish to npm (NOT automated in CI)
pnpm changeset:publish
```

---

## CI Validation Steps

### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

- Uses frozen lockfile to ensure reproducible builds
- Leverages pnpm cache for faster installs

### 2. Build All Packages

```bash
pnpm run build
```

- Uses Turborepo for optimized builds
- Builds packages in correct dependency order
- Enables turbo caching for subsequent runs

### 3. Run Tests

```bash
pnpm run test
```

- Runs all 40 tests across packages
- Uses `tsx` for TypeScript execution in core package
- Fail fast on any test failure

### 4. Verify Package Outputs

Checks that all packages have:
- `dist/` directory created
- `dist/index.d.ts` type declarations
- Core package has `dist/internal.d.ts`

### 5. Changeset Status (Main Only)

```bash
pnpm changeset status
```

Validates:
- Changesets exist for modified packages
- Versioning would succeed
- No conflicts or issues with changeset files

### 6. Uncommitted Changes Check (Main Only)

```bash
git diff --exit-code
```

Ensures:
- Build process is deterministic
- No generated files are missing from git
- CI environment matches local development

### 7. Publish Dry Run (Main Only)

```bash
pnpm changeset publish --dry-run
```

Validates:
- Packages can be published successfully
- Package manifests are correct
- No blocking issues exist

**Note:** This is validation only. No packages are actually published.

---

## Workflow Configuration

**File:** `.github/workflows/ci.yml`

**Key Features:**
- Single job with conditional steps
- Node.js 20
- pnpm 10.28.2
- pnpm caching enabled
- Turbo caching enabled
- Minimal but professional
- Clear separation of dev vs main behavior

**Main-only steps use:**
```yaml
if: github.ref == 'refs/heads/main'
```

---

## Local Development Commands

```bash
# Run full CI suite locally
pnpm install --frozen-lockfile
pnpm run build
pnpm run test

# Additional changeset commands
pnpm changeset                 # Create a changeset
pnpm changeset status          # Check changeset status
pnpm changeset:version         # Version packages
pnpm changeset:publish --dry-run  # Dry run publish
```

---

## Package Configuration

### Ignored Packages

Demo and docs apps are ignored from changesets (defined in `.changeset/config.json`):
- `@timeline/demo` - Demo application (not published)
- `@timeline/docs` - Documentation site (not published)

### Publishable Packages

These packages require changesets when modified:
- `@timeline/core` - Core timeline engine
- `@timeline/react` - React hooks and provider
- `@timeline/ui` - UI components

---

## Branch Protection Recommendations

For production use, configure GitHub branch protection:

### Main Branch
- ✅ Require CI checks to pass
- ✅ Require pull request reviews
- ✅ Require linear history
- ✅ Require branches to be up to date
- ❌ Allow force pushes
- ❌ Allow deletions

### Dev Branch
- ✅ Require CI checks to pass
- ✅ Allow force pushes (for rebasing)
- ✅ Allow deletions (for cleanup)

---

## Troubleshooting

### CI Fails on Changeset Status

**Problem:** `pnpm changeset status` fails on main branch

**Solution:** Ensure changesets exist for all modified packages:
```bash
pnpm changeset
```

### CI Fails on Uncommitted Changes

**Problem:** Build produces uncommitted files

**Solution:** 
1. Run `pnpm build` locally
2. Check `git status` for uncommitted files
3. Either commit the files or update `.gitignore`

### Publish Dry Run Fails

**Problem:** `pnpm changeset publish --dry-run` fails

**Common causes:**
- Missing `repository` field in package.json
- Missing `license` field in package.json
- Package name conflicts on npm registry
- Missing npm authentication (not needed for dry-run)

**Solution:** Update package.json with required fields

---

## References

- [Changesets Documentation](https://github.com/changesets/changesets)
- [pnpm Workspace Guide](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## Status

**Current State:** ✅ Production-ready

- CI workflow configured for dev and main branches
- Changesets initialized and configured
- All validation steps operational
- No automatic publishing (manual release process)
