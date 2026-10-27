# GitBook and domain setup

Manual steps to publish this folder at [docs.canhav.com](https://docs.canhav.com).

## 1. Create the GitBook space

1. Sign in at [gitbook.com](https://www.gitbook.com) and create an organization if needed.
2. Create a new docs site named **CanHav Docs**.
3. Prefer starting from **Sync with Git** (or blank, then connect Git Sync).

## 2. Git Sync

1. Open the content section for CanHav Docs.
2. Set up Git Sync to this GitHub repository.
3. Prefer **Project directory** = repository root so GitBook reads [`.gitbook.yaml`](../.gitbook.yaml) (`root: ./docs/`, homepage = Welcome, sidebar = `SUMMARY.md`).
4. Alternatively set Project directory to `docs/` and sync that folder directly.
5. Confirm `SUMMARY.md` drives the sidebar. Landing page should be **Welcome to CanHav** (see `.gitbook.yaml`).
6. Push or sync once and verify pages appear in the GitBook UI.

## 3. Theme and branding (light / white background)

Site appearance is controlled only in GitBook **Customization**. It is not set by markdown in this repo. Someone with GitBook access must apply these steps and publish.

1. Open the CanHav Docs site in the GitBook dashboard.
2. Open the **Customization** tab (site overview).
3. Choose theme **Clean** (plain page background; avoid Muted or Gradient if you want a white page).
4. Set **Default mode** to **Light**.
5. Optionally turn off **Show mode toggle** so visitors only see light mode. Leave it on if you want dark as an opt-in.
6. Set accent / primary to `#3D7BFF` (electric blue) where GitBook allows.
7. Site title: **CanHav Docs**. Logo: CanHav mark from the product site. Header link: `https://canhav.com`.
8. Enable search.
9. Click **Publish** so the live site picks up the change.

| Setting | Suggested value |
|---------|-----------------|
| Theme | Clean |
| Default mode | Light |
| Mode toggle | Off (light only) or on with light default |
| Accent | `#3D7BFF` |
| Font | GitBook default |
| Search | Enabled |
| Header link | `https://canhav.com` |

Do not use emoji icons in titles, sidebar labels, or callouts.

## 4. Custom domain: docs.canhav.com

1. In the GitBook site: **Settings → Domain and URL → Set up a custom domain**.
2. Enter `docs.canhav.com`.
3. Copy the **CNAME** target GitBook shows (do not use an A record).
4. At the DNS provider for `canhav.com`, create:

| Type | Name | Target |
|------|------|--------|
| CNAME | `docs` | (value from GitBook) |

5. If using Cloudflare, set the record to **DNS only** (grey cloud), not proxied.
6. Wait for DNS propagation and GitBook SSL (often minutes, up to 48 hours).
7. Verify `https://docs.canhav.com` loads the Welcome page.

## 5. Publish the site (required)

Domain setup alone is not enough. Until you click **Publish** in GitBook, `https://docs.canhav.com` responds with **307** and redirects visitors to the editor URL:

`https://app.gitbook.com/o/.../sites/.../`

That matches a sidebar status of **This site is not published.**

1. Open the CanHav Docs site in GitBook.
2. Click **Finish** on the domain success modal if it is still open.
3. Click **Publish** (top right).
4. Confirm the preview URL / custom domain, then publish.
5. Recheck: `curl -sI https://docs.canhav.com` should return **200** (or a path redirect that stays on `docs.canhav.com`), not a redirect to `app.gitbook.com`.

## 6. Publish checklist

- [ ] Site status is published (not "This site is not published")
- [ ] `https://docs.canhav.com` serves docs without redirecting to `app.gitbook.com`
- [ ] Sidebar matches `SUMMARY.md` (Getting started, Projects, Token Launch, …)
- [ ] Welcome is the default landing page (not `README.md`)
- [ ] Default mode is Light with a white / Clean background
- [ ] Search works
- [ ] Link to canhav.com is present
- [ ] No emojis in published pages
- [ ] Product site Nav **Docs** link points to `https://docs.canhav.com`
