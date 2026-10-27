# Studio

The next CanHav platform, rebuilt one step at a time from
[canhav.dev](https://github.com/wazarat/canhav.dev). Only the parts that have
been approved move over; canhav.dev stays as the reference copy.

## Step 1 (this repo today)

- `/` — the landing page from canhav.dev, dark only: nav (logo, Docs, Log in),
  hero video with the two headline lines and the sign up / contact buttons,
  the Protocol analytics section and the Pro Services panel, footer.
- `/login` — a placeholder page in the spot where sign-in will go.
- `/api/leads` — the contact form endpoint, answering "not connected yet"
  until the database and email are wired.
- `docs/` — the markdown behind docs.canhav.com, carried over unchanged for
  when Studio hosts the docs itself. The app does not read it yet.

Not in this step: Clerk, the Neon database, light mode, the custom domain.

## Run

```bash
npm install
npm run dev
```

`DUNE_API_KEY` is optional (see `.env.example`).
