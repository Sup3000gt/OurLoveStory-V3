# Private Media Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and deploy the approved Our Story gallery with two-owner authentication, public/private media rules, direct uploads, and original downloads.

**Architecture:** React/Vite frontend on Cloudflare, Clerk authentication, D1 metadata, private R2 media. The checked-in first PR delivers the complete responsive UI, schema, data contracts, and setup documentation; the next task wires the Worker endpoints after credentials exist.

**Tech Stack:** React 19, TypeScript, Vite, Clerk, Cloudflare Workers, D1, R2, Vitest.

## Global Constraints
- No public registration.
- Exactly two independent owner users are allowlisted.
- Private assets never receive permanent public URLs.
- Photos and videos are supported by the data model and upload UI.
- Each original can be downloaded only by viewers authorized for its memory.

### Task 1: Responsive gallery UI
- Create the approved homepage, gallery, navigation, owner-aware visibility behavior, and downloads.
- Verify desktop and mobile layouts.

### Task 2: Owner Studio UI
- Create multi-file image/video selection, metadata form, public/private choice, featured choice, and live preview.
- Verify guests cannot access the studio experience.

### Task 3: Clerk production authentication
- Replace demo auth state with ClerkProvider, SignInButton/UserButton, and protected route behavior.
- Configure restricted sign-up and manually create the two owner accounts.

### Task 4: D1 and R2 Worker API
- Add authenticated endpoints for upload authorization, memory publication, list/read, edit/delete, and original download.
- Enforce visibility at the API layer and return 404 for unauthorized private resources.

### Task 5: Cloudflare deployment and verification
- Create D1/R2 resources, apply schema, set secrets, deploy, verify public/private behavior and mobile upload.
