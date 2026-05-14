# Monorepo

Monorepo with multiple packages and security checks.

https://github.com/MasuRii/pi-permission-system

## Setup

### 1. Install Required Tools

```bash
brew install trufflehog
brew install semgrep
```

### 2. Install Dependencies

```bash
bun install
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
