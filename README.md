# CleanOps starter kit — START HERE

This folder is the hand-off to Claude Code. It contains no app code yet, on purpose. It contains
the things Claude Code is bad at inventing and good at executing: the spec, the rules, a tested
database schema, and the exact prompts to type, in order.

```
README.md                      ← you are here
CLAUDE.md                      ← Claude Code reads this automatically every session
SPEC.md                        ← what we're building; the source of truth
docs/PROMPTS.md                ← the prompts to paste, one session at a time
docs/IMPORT_MAPPING.md         ← how your 4 Google Sheet tabs map into the database
supabase/migrations/0001_init.sql  ← the database, already written and tested
data/imports/*.csv             ← CSV templates with your exact column headers
templates/proposal.md          ← placeholder proposal template; replace with yours
.env.example                   ← every key the app needs and where to get it
```

## Step 1 — Figure out what you have (2 minutes)

You have two ways to run Claude Code. Either is fine; the desktop app is easier if you have
never used a terminal.

**Option A: the Claude desktop app (no install beyond the app).**
Open the Claude app. If there is a **Code** tab at the top center, you already have Claude Code.
Click it, choose **Local**, click **Select folder**, and pick this folder. If clicking Code asks
you to upgrade, you need a Pro or Max subscription. The desktop app bundles Claude Code, so there
is nothing else to install.

**Option B: the terminal.**
Open Terminal (Mac) or PowerShell (Windows) and type:

```
claude --version
```

If it prints a version number, you're installed. If it says "command not found", install it:

- Mac: `curl -fsSL https://claude.ai/install.sh | bash`
- Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`

Then open a new terminal window and run `claude --version` again. First run of `claude` asks you
to log in with your Claude account (Pro or Max).

## Step 2 — Put this folder where you'll work

Unzip it somewhere sensible, for example `~/Projects/cleanops`. Rename the folder if you like;
nothing depends on the name.

## Step 3 — Create the accounts (do this early; some take days)

You don't need these for Session 0 or 1, but start them now because two of them have waits.

| Account | Why | When needed | Notes |
|---|---|---|---|
| supabase.com | database + login + photo storage | Session 0 | Free plan to start. Create a project, copy the URL and keys into `.env.local`. |
| vercel.com | hosting | Session 3 (first deploy) | Pro plan ($20/mo) for commercial use. Connect it to your GitHub repo. |
| github.com | code backup, deploys | Session 0 | Free. Claude Code will create the repo for you if `gh` is installed; otherwise make an empty private repo. |
| stripe.com | payments | Session 4 | Use **test mode** keys first. Enable ACH Direct Debit in Settings → Payment methods. |
| twilio.com | SMS | Session 5 | Start A2P 10DLC registration (sole proprietor) on day one; approval can take days to weeks. Until approved, the app uses email. |
| resend.com | email fallback | Session 5 | Free tier is plenty. Verify your domain. |
| console.anthropic.com | proposal generation inside the app | Session 6 | Pay-as-you-go API key, separate from your Claude subscription. A proposal costs a few cents. |

Generate the lockbox encryption key once and keep it safe (losing it means re-entering codes):

```
openssl rand -base64 32
```

## Step 4 — Start Session 0

Open this folder in Claude Code (desktop app: Code tab → Select folder; terminal: `cd` into the
folder and run `claude`). Paste the first prompt from `docs/PROMPTS.md`. It will read the spec,
ask you a few questions, and wait. Answer them, then paste the second prompt.

Work through the sessions in order. Each ends with tests passing and a commit. Stop after
Session 3 and run the business on it for a few days before doing payments and messaging; the
things you notice in real use are worth more than any spec.

## Step 5 — Replace the placeholders

Before Session 6, drop your real proposal template into `templates/proposal.md`, keeping the
`{{placeholders}}` wherever text should come from the structured fields. Before Session 3,
export your Google Sheet tabs as CSV into `data/imports/` using the headers in the templates.

## If something goes wrong

- "Explain this error to me like I'm not a developer, then fix it." works surprisingly well.
- `/clear` resets the conversation if Claude Code gets stuck in a loop.
- `claude -c` resumes the last conversation in this folder.
- Everything is in git. "Undo the last change" or `git checkout .` gets you back to the last commit.
- Shift+Tab cycles permission modes; "plan" mode makes Claude Code propose before touching files.

## What's intentionally not here

App code, UI components, deploy config. Those are what Claude Code generates, and it does a
better job generating them against this spec than I would do guessing at your taste. The one
piece written by hand is the database, because that's the piece you want to be right before
anything is built on top of it, and it has been tested: the schema applies cleanly, duplicate
job generation is rejected, a cleaner cannot be paid twice for the same job, paid batches are
frozen, and the P&L, AR, owed-to-cleaners, and 1099 views roll up correctly from sample data.
