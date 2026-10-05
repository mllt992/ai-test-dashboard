# Issue #1: deployment and identity decisions still required

The checked-in entry point is a Qoder Sites Deno Function using a runtime-supplied Supabase URL and anonymous key. The adapter forwards a gateway-supplied instance identifier to REST, discards inbound Authorization/Cookie before calling the app, and always uses the anonymous database identity. The repository has no server-side application sessions, user roles, project membership or API-key revocation authority. Browser-local users/roles/keys therefore provide demonstration state only; they do not authenticate REST or MCP. The existing browser seed includes a hardcoded demo login and must not be treated as a production credential or reused elsewhere. Its value is intentionally omitted here.

Responsibility boundaries:

| Layer | Required responsibility | Repository evidence / unknowns |
| --- | --- | --- |
| Deployment gateway | Establish tenant routing, prevent public callers forging instance identity, validate public origin and transport | Adapter consumes a header; gateway policy and deployed configuration are unknown |
| Application identity | Validate sessions and API keys; authorize roles and project access consistently for REST/MCP; enforce revocation | Not implemented by the current app |
| Database | Enforce tenant/project access with reviewed RLS and grants; protect all direct database paths and invoker RPCs | Actual policies, schema and deployed roles are unknown |

The owner must confirm these decisions before an implementation can reliably satisfy #1:

1. Is this an isolated demonstration, a single-user internal tool, or a multi-user production service? Which deployed gateway/domain and tenant isolation model are intended?
2. Which identity provider and issuer/audience should the Function verify (for example the existing platform identity or an already configured Supabase Auth deployment)? Which server-side credential verification mechanism is approved?
3. Which server authority owns users, admin/member roles and project memberships? Which operations are admin-only, and should API keys inherit user membership or have explicit scopes?
4. Where will hashed API keys and revocation state persist? Does “immediate” revocation prohibit cache delay, and how should sessions expire?
5. How should the demonstration be isolated from real data, and how should existing local users/keys be discarded or migrated? Provide configuration names and policy expectations without pasting secret values into issues or chat.

No identity provider, credentials, roles, grants, production settings or persistent access were invented or changed in this repair. #1 remains open. Do not claim that the new business RPCs secure the existing anonymous deployment; they run as SECURITY INVOKER under existing database permissions. Production multi-user use requires the decisions above and session/role/revocation/project-access tests.

## Minimal owner questions and recommendation

The coordinating task reports an existing independent auth-center project. No connection to it was made and compatibility is not assumed. If this dashboard is intended for real multi-user data, prefer reusing an approved identity authority rather than introducing a second local account/password system. Auth-center is the first candidate only after the owner explicitly chooses that integration and its supported verification contract is inspected.

The minimum owner decisions are:

1. **Usage and isolation**: Is this dashboard an isolated demonstration, an internal multi-user service, or an externally reachable service? For a demonstration, use fixture-only data and visibly label local roles/keys as demonstration state. For real data, require server identity before enabling it.
2. **Identity authority**: Should this dashboard integrate with the existing auth-center, another approved identity provider, or remain demonstration-only? Recommended for an approved multi-user deployment: auth-center, subject to compatibility review. Confirm the integration choice before any read or connection to that project.
3. **Access policy**: May admins access/manage all projects, while members access only explicitly assigned projects and API keys inherit the owner's project access with narrower read/write scopes? Should revocation take effect on every next request? These are proposed defaults, not permissions already granted.

Once these choices are confirmed, technical details can usually be resolved from the existing project/provider contract rather than asking the user to invent them: issuer/audience and verification/introspection endpoint, established deployment host and gateway routing, session lifetime, authoritative role/membership fields, hashed-key storage, revocation API, and the database RLS integration. Never request or copy secret values into chat. Existing repository conventions already establish admin/member role names, read/write scope vocabulary, and the need for one shared REST/MCP authorization path; these names can be preserved. The deployment trust boundary, auth-center integration choice, actual project access policy and persistent authority cannot be inferred from browser-local demonstration data.

The other seven repairs continue independently of these decisions.
