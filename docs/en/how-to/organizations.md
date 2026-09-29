---
title: Run your team's agents as an organization
summary: A page for the team, membership by company email, roles, agents shared with the organization, resource groups, and the audit log — so AIN Teams and ainmem import the organization's agents from one place.
---

# Run your team's agents as an organization

An **organization** on a node is a team's home for its agents: a page with a README, the agents registered under
it, the people in it and what each may do. It exists because two things met. AIN Teams and ainmem import every
agent they show from a node's catalogue, and a company wants *our agents* to be a place — registered under the
company, managed by whoever the company says, private when they should be. And who belongs is already proven by
the sign-in: the email AIN SSO vouched for.

Signing in with `@comcom.ai` puts you in the organization that holds `comcom.ai`. Nobody maintains a list.

## Get in, or make one

Open **Organizations** from the account menu (`/org`). With an AIN account you see the organizations your email
domain and your AIN organizations put you in; a wallet sign-in sees the ones it was invited to.

If no organization holds your domain yet, the page says so and offers **Create an organization**. Fill in a name,
an id (it becomes the page address, `/org/<id>`, and never changes), and tick *Everyone who signs in with
@yourdomain* — that is the one domain you are allowed to claim. The rule is deliberate: **a domain can only be
claimed by someone signed in with an email on it**, and it belongs to one organization, so the first visitor to
type `comcom.ai` does not end up owning every comcom sign-in. You are the first admin.

An operator can also seed an organization before its people arrive (`AINIZE_ORG_SEED="comcom=ComCom:comcom.ai"` on
the node); the first sign-in on the domain then walks straight in.

## The page

`/org/<id>` is for members. At the top sits the **README card** — markdown an admin writes in settings, the same
subset the docs use — then the tabs:

- **Agents** — every agent shared with the organization: its visibility is *organization* and its organization is
  this one (or one of the AIN SSO organizations linked to it). Every member sees all of them; resource groups only
  label them. *Register an agent here* opens the ordinary link form with the organization preselected.
- **Members** — who is in, with role and how they got in (creator, email domain, AIN organization, invite, approved
  request, added by an admin).
- **README** — the card on its own.

A non-member sees the organization's name and a button to **ask to join**; admins approve with a role.

## Roles

| Role | May |
| --- | --- |
| `read` | open the page; see the agents shared with the organization |
| `contributor` | share their own agents with the organization |
| `write` | edit any hosted agent shared with the organization (its spec, code, secrets, logs); manage resource groups |
| `admin` | also delete the organization's agents or change who sees them; members and roles, invites, join requests, settings, billing, security, delete |

The owner of an agent always keeps it: only the owner changes a linked agent's upstream, and only the owner or an
admin deletes an agent or changes its visibility.

People who come in by domain or AIN organization get the organization's *domain role* (`write` by default). Their
row appears in the member list the first time they visit, so an admin can raise or lower them from there; an
explicit role then outranks the default. The last admin cannot be demoted or removed.

## Settings

`/org/<id>/settings`, admins only (write members see Resource groups).

**General** — name, description, README, the admitting domains (an admin can add their own email domain), the
domain role, and the AIN SSO organization ids linked to this organization. Delete is refused while agents remain.

**Members** — change a role from the dropdown in the list, remove someone, add an account you already know by
principal (`0x…` or `sso:<sub>`). Below it, **pending join requests** to approve (with a role) or reject, and
**invite links**: pick a role, optionally pin the invite to one email, choose how long it lives, and copy the link
— it is shown once, the list only ever shows a prefix, and each link is used once. The node sends no email.

**Resource groups** — "these agents are for these members": a label on the organization's page. A group does not
hide an agent from the other members.

**Billing** — what the node can honestly count: the organization's API keys (the keys members made for one of its
linked AIN SSO organizations), calls to each of the organization's agents through this node, and a recorded spend
cap. The node does not meter per-key inference spend yet, and the tab says so where a graph would otherwise show
zeros; when metering lands, the cap is enforced there.

**Security & SSO** — sign-in is the node's AIN SSO; this tab shows how it applies here (issuer, linked AIN
organizations, admitting domains), how each member got in, the admins, how many agents are shared with the
organization only, and the
**audit log**: every change to members, roles, invites, requests, groups and settings, and every agent registered,
changed or removed under the organization, with who did it.

## Agents under an organization

On the agent forms (built on a model, or linked by address), **Visibility** → *Organization* shares the agent with
one organization: the list offers the organizations where you are at least a contributor, and the AIN SSO
organizations your sign-in names. An agent shared with an organization is listed to its members only — not in the
public catalogue.

*Not listed* is not *not reachable*. The agent's address `/agents/<id>` still answers, because a
workspace that imports it calls from a server with no session; the agent enforces its own A2A security scheme, as
every agent in the catalogue does.

## Importing into AIN Teams and ainmem

Both products read this node's catalogue. Set `AINIZE_ORG=<id>` on the workspace deployment and it asks for the
organization's agents only (`GET /api/agents?org=<id>`), so a company workspace imports the company's agents and
nothing else. The catalogue rows carry `org_id` too, so an older node that ignores the parameter cannot leak a personal
agent into an organization-scoped workspace.

## See also

- [Build an agent for AIN Teams](./build-for-ainteams.md) — the agent side, and the import dialog
- [Put an agent on a node](./host-an-agent.md) — registration without an organization
- [`/api/orgs`](../reference/http-api.md) — every route, in the HTTP API reference
