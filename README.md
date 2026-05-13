# Monorepo

Monorepo with multiple packages and security checks.

## Setup

### 1. Install Required Tools

```bash
brew install trufflehog
brew install semgrep
```

### 2. Install Dependencies

```bash
npm install
```

This will automatically run `husky install` via the `prepare` script.

## Security Checks

### Run Manually

```bash
npm run security:check
```

### Test the Hook

```bash
bash .husky/pre-commit
```

**Note:** If you get `ENOLOCK` error, run `npm i --package-lock-only` first.

## Workspace Commands

### Run in All Workspaces

```bash
npm run build --workspaces
npm run test --workspaces
```
