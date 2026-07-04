# Security Policy

## Supported versions

This is a single static web app; only the latest version published to the
`main` branch (and served on GitHub Pages) is supported.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, use GitHub's **[Private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
on this repository:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** to open a private advisory.

If private reporting is unavailable, open a regular
[GitHub Issue](../../issues) that describes the problem **without** including
exploit details, and a maintainer will follow up on a private channel.

Please include, where possible:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected browser / environment.

We'll acknowledge your report and keep you updated on the fix.

## Scope note

This app runs entirely client-side and stores data only in your browser's
`localStorage`. It has no backend, accounts, or server-side data.
