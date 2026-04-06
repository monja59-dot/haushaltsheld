import { getUser } from '@netlify/identity'

export default async (req, context) => {
  try {
    const user = await getUser()

    if (!user) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Nicht eingeloggt.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const role = user?.roles?.[0] || 'member'
    const metadata = user?.app_metadata || {}

    const rights = {
      user: {
        id: user.id,
        email: user.email,
        role,
        roles: user.roles || [],
      },
      permissions: {
        private: metadata.permissions?.private || {},
        family: metadata.permissions?.family || {},
        partner: metadata.permissions?.partner || {},
        admin: metadata.permissions?.admin || {},
      },
    }

    return new Response(
      JSON.stringify({
        ok: true,
        rights,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Fehler beim Laden der Rechte.',
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}