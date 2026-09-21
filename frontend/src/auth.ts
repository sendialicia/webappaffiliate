import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

/**
 * Microsoft SSO through Entra ID, per IT's standard: one app registration per dashboard, the
 * callback registered as /api/auth/callback/azure-ad. Auth.js v5 renamed the provider to
 * "microsoft-entra-id", so the id is pinned back to "azure-ad" to keep that registered path.
 *
 * Every account in the tenant may sign in; the tenant-specific issuer is what shuts out
 * personal and other-tenant Microsoft accounts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      id: "azure-ad",
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      // The stock profile() also pulls the Graph photo and stores it base64 in the session
      // cookie, which slows every sign-in and bloats the cookie past a single chunk.
      profile(profile) {
        return {
          // `oid` is the user's id across the tenant; `sub` differs per app registration, so a
          // new or split registration would orphan every comment written before it.
          id: (profile.oid as string | undefined) ?? profile.sub,
          name: profile.name,
          email: (profile.email as string | undefined) ?? (profile.preferred_username as string | undefined),
          image: null,
        }
      },
    }),
  ],
  pages: { signIn: "/login" },
  // Behind the VM's reverse proxy the host comes from forwarded headers; Auth.js only trusts
  // those when told to. Without it every request fails with UntrustedHost.
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
